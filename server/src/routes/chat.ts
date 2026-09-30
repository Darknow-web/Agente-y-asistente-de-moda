/**
 * POST /api/chat — conversación con Sastra en streaming (SSE).
 * Flujo: límite diario → conversación → Director (delegando a departamentos) → Calidad si aplica → respuesta.
 */
import { Router as ExpressRouter, type Request, type Response } from 'express';
import type { Adjunto, Conversacion, EventoChat, Mensaje, PeticionChat } from '@shared/types.js';
import type { MensajeModelo, Parte } from '../ai/provider.js';
import { requiereInvitado, requiereSesion } from '../auth/middleware.js';
import {
  guardarConversacion,
  leerConversacion,
  listarConversaciones,
  mensajesHoy,
  nuevoMensaje,
  sumarMensajeHoy,
} from '../data/repos.js';
import { asincrono, noEncontrado, peticionInvalida, ErrorHttp } from '../util/errores.js';
import { nuevoId, ahora } from '../util/ids.js';
import { construirContexto } from '../memory/construir.js';
import { correrDirector } from '../agents/director/index.js';
import { debeRevisar, revisarConCalidad, type TipoRevision } from '../agents/calidad/index.js';
import { adjuntoAParte } from '../agents/guardarropa/index.js';
import { leerLimites } from '../config/limites.js';
import { router as motores } from '../ai/router.js';
import { mensajeUsuario } from '../agents/base.js';

export const rutasChat = ExpressRouter();

rutasChat.get(
  '/conversaciones',
  requiereSesion,
  requiereInvitado,
  asincrono(async (req, res) => {
    res.json(await listarConversaciones(req.usuario!.uid));
  }),
);

rutasChat.get(
  '/conversaciones/:id',
  requiereSesion,
  requiereInvitado,
  asincrono(async (req, res) => {
    const c = await leerConversacion(req.usuario!.uid, String(req.params.id));
    if (!c) throw noEncontrado('Esa conversación no existe.');
    res.json(c);
  }),
);

function enviar(res: Response, evento: EventoChat) {
  res.write(`data: ${JSON.stringify(evento)}\n\n`);
}

function validarAdjuntos(adjuntos: Adjunto[] | undefined): Adjunto[] {
  const lim = leerLimites();
  const lista = (adjuntos ?? []).filter((a) => a && a.datos && a.mime);
  for (const a of lista) {
    const mb = (a.datos!.length * 3) / 4 / 1024 / 1024;
    if (a.tipo === 'imagen' && mb > lim.imagenMaxMB) throw peticionInvalida(`La foto pesa ${mb.toFixed(1)} MB. El máximo es ${lim.imagenMaxMB} MB.`);
    if (a.tipo === 'video' && mb > lim.videoMaxMB) throw peticionInvalida(`El video pesa ${mb.toFixed(1)} MB. El máximo es ${lim.videoMaxMB} MB.`);
    if (a.tipo !== 'imagen' && a.tipo !== 'video') throw peticionInvalida('Solo aceptamos fotos y videos.');
  }
  return lista.slice(0, 4);
}

/** Convierte la conversación guardada en mensajes para el modelo (solo texto en el historial; adjuntos solo en el último). */
function historialAModelo(c: Conversacion, adjuntosUltimo: Parte[], max: number): MensajeModelo[] {
  const mensajes = c.mensajes.slice(-max);
  const out: MensajeModelo[] = [];
  if (c.resumen) out.push({ rol: 'usuario', partes: [{ tipo: 'texto', texto: `(Resumen de lo conversado antes: ${c.resumen})` }] });
  mensajes.forEach((m, i) => {
    const esUltimo = i === mensajes.length - 1;
    const partes: Parte[] = [];
    if (esUltimo && m.rol === 'usuario') partes.push(...adjuntosUltimo);
    else if (m.adjuntos?.length) partes.push({ tipo: 'texto', texto: `[${m.rol === 'usuario' ? 'El cliente envió' : 'Se mostró'} ${m.adjuntos.length} archivo(s): ${m.adjuntos.map((a) => a.tipo).join(', ')}]` });
    partes.push({ tipo: 'texto', texto: m.texto || '(sin texto)' });
    out.push({ rol: m.rol === 'usuario' ? 'usuario' : 'modelo', partes });
  });
  // El modelo exige empezar con "usuario"
  while (out.length && out[0]!.rol !== 'usuario') out.shift();
  return out;
}

async function resumirSiHaceFalta(c: Conversacion, uid: string): Promise<void> {
  const lim = leerLimites();
  if (c.mensajes.length < lim.resumirCadaMensajes) return;
  const viejos = c.mensajes.slice(0, c.mensajes.length - lim.mensajesEnContexto);
  if (viejos.length < 4) return;
  const texto = viejos.map((m) => `${m.rol === 'usuario' ? 'Cliente' : 'Sastra'}: ${m.texto}`).join('\n');
  try {
    const { respuesta } = await motores.generar(
      'cuidado', // nivel lite: el más barato
      {
        sistema: 'Resume en máximo 120 palabras, en español, los hechos útiles de esta conversación entre un cliente y su asesora de moda: decisiones, preferencias, prendas mencionadas, pendientes. Sin saludos.',
        mensajes: [mensajeUsuario(`${c.resumen ? 'Resumen previo: ' + c.resumen + '\n\n' : ''}${texto}`)],
        maxTokensSalida: 300,
      },
    );
    c.resumen = respuesta.texto.trim();
    c.mensajes = c.mensajes.slice(-lim.mensajesEnContexto);
    void uid;
  } catch (e) {
    console.warn('[chat] no se pudo resumir:', e instanceof Error ? e.message : e);
  }
}

function tipoRevisionPara(departamentos: string[]): TipoRevision {
  if (departamentos.includes('planificacion')) return 'plan-diario';
  if (departamentos.includes('compras')) return 'lista-compras';
  if (departamentos.includes('probador')) return 'veredicto-probador';
  if (departamentos.includes('guardarropa')) return 'catalogacion';
  return 'chat';
}

rutasChat.post(
  '/chat',
  requiereSesion,
  requiereInvitado,
  asincrono(async (req: Request, res: Response) => {
    const usuario = req.usuario!;
    const cuerpo = (req.body ?? {}) as PeticionChat;
    const texto = String(cuerpo.texto ?? '').trim();
    const adjuntos = validarAdjuntos(cuerpo.adjuntos);
    if (!texto && !adjuntos.length) throw peticionInvalida('Escribe algo o adjunta una foto.');

    const lim = leerLimites();
    const usadosHoy = await mensajesHoy(usuario.uid);
    if (usadosHoy >= lim.mensajesPorUsuarioPorDia) {
      throw new ErrorHttp(429, `Llegaste al límite de ${lim.mensajesPorUsuarioPorDia} mensajes por hoy. Mañana seguimos.`);
    }

    // Conversación
    let conversacion = cuerpo.conversacionId ? await leerConversacion(usuario.uid, cuerpo.conversacionId) : null;
    if (!conversacion) {
      conversacion = { id: nuevoId('conv'), mensajes: [], actualizadaEn: ahora(), titulo: (texto || 'Foto').slice(0, 60) };
    }
    const msgUsuario = nuevoMensaje('usuario', texto, { adjuntos });
    conversacion.mensajes.push(msgUsuario);

    // SSE
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const mensajeId = nuevoId('m');
    enviar(res, { tipo: 'inicio', conversacionId: conversacion.id, mensajeId });
    const latido = setInterval(() => res.write(': latido\n\n'), 15000);
    const abortar = new AbortController();
    req.on('close', () => abortar.abort());
    // Tope total de la respuesta: si el departamento no termina a tiempo, se avisa en vez de dejar el chat colgado.
    let vencioTiempo = false;
    const tope = setTimeout(() => {
      vencioTiempo = true;
      abortar.abort();
    }, lim.segundosMaxPorRespuesta * 1000);

    try {
      const ctx = await construirContexto(usuario.uid, usuario.email);
      const partesAdjuntos = adjuntos.map(adjuntoAParte).filter((p): p is Parte => !!p);
      const historial = historialAModelo(conversacion, partesAdjuntos, lim.mensajesEnContexto);

      const resultado = await correrDirector({
        ctx,
        historial,
        adjuntosActuales: partesAdjuntos,
        onDepartamento: (agente, estado) => enviar(res, { tipo: 'departamento', agente, estado }),
        senal: abortar.signal,
      });

      let textoFinal = resultado.texto.trim() || 'No supe qué responder. ¿Me lo cuentas de otra forma?';
      const tipo = tipoRevisionPara(resultado.departamentos);
      if (debeRevisar(tipo, textoFinal, resultado.departamentos)) {
        enviar(res, { tipo: 'departamento', agente: 'calidad', estado: 'trabajando' });
        const rev = await revisarConCalidad(ctx, textoFinal, { tipo, pregunta: texto, senal: abortar.signal });
        if (rev.reviso && !rev.aprobado && rev.texto.trim()) textoFinal = rev.texto.trim();
        enviar(res, { tipo: 'departamento', agente: 'calidad', estado: 'listo' });
      }

      // Fuentes de búsqueda web al final, si las hubo
      const fuentes = [...resultado.fuentes, ...resultado.fuentesDepartamentos].slice(0, 6);
      if (fuentes.length) {
        textoFinal += '\n\nFuentes: ' + fuentes.map((f) => `${f.titulo || 'enlace'} (${f.url})`).join(' · ');
      }

      // Emitimos el texto por tramos para una lectura fluida
      for (const tramo of trocear(textoFinal)) {
        if (abortar.signal.aborted) break;
        enviar(res, { tipo: 'texto', delta: tramo });
      }

      const msgSastra: Mensaje = { id: mensajeId, rol: 'sastra', texto: textoFinal, departamentos: resultado.departamentos, creadoEn: ahora() };
      conversacion.mensajes.push(msgSastra);
      conversacion.actualizadaEn = ahora();
      await resumirSiHaceFalta(conversacion, usuario.uid);
      await Promise.all([guardarConversacion(usuario.uid, conversacion), sumarMensajeHoy(usuario.uid)]);
      enviar(res, { tipo: 'fin', mensaje: msgSastra });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      console.error('[chat] error:', e);
      enviar(res, {
        tipo: 'error',
        mensaje: vencioTiempo
          ? `El departamento tardó más de ${Math.round(lim.segundosMaxPorRespuesta / 60)} minutos y se detuvo. Vuelve a intentarlo; si se repite, el motor de IA está saturado.`
          : humanizar(mensaje),
      });
    } finally {
      clearTimeout(tope);
      clearInterval(latido);
      res.end();
    }
  }),
);

function trocear(texto: string, tam = 24): string[] {
  const palabras = texto.split(/(\s+)/);
  const tramos: string[] = [];
  let actual = '';
  for (const p of palabras) {
    actual += p;
    if (actual.length >= tam) {
      tramos.push(actual);
      actual = '';
    }
  }
  if (actual) tramos.push(actual);
  return tramos;
}

function humanizar(mensaje: string): string {
  const m = mensaje.toLowerCase();
  if (m.includes('api key') || m.includes('api_key') || m.includes('401') || m.includes('permission')) {
    return 'Falta configurar la llave del motor de IA (GEMINI_API_KEY). Revisa Diagnóstico.';
  }
  if (m.includes('429') || m.includes('quota') || m.includes('rate')) {
    return 'El motor de IA está saturado en este momento. Espera un minuto e inténtalo de nuevo.';
  }
  if (m.includes('503') || m.includes('unavailable') || m.includes('high demand') || m.includes('overloaded')) {
    return 'El motor de IA tiene mucha demanda ahora mismo. Espera unos segundos y vuelve a enviar el mensaje.';
  }
  if (m.includes('firestore') || m.includes('firebase')) {
    return 'No pudimos acceder a tu armario (Firestore). Revisa Diagnóstico.';
  }
  return 'Algo salió mal al pensar la respuesta. Inténtalo de nuevo en un momento.';
}
