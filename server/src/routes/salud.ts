/**
 * GET /api/salud — diagnóstico público (sin datos sensibles): qué está conectado y qué falta.
 */
import { Router as ExpressRouter } from 'express';
import type { RespuestaSalud } from '@shared/types.js';
import { probarFirestore, probarStorage, proyectoId } from '../auth/admin.js';
import { modelosImagen, router as motores, validarModelos } from '../ai/router.js';
import { env } from '../util/env.js';
import { asincrono } from '../util/errores.js';

export const rutasSalud = ExpressRouter();

let cacheModelos: { hasta: number; modelos: RespuestaSalud['modelos']; imagen: RespuestaSalud['imagen'] } | null = null;

/** Primer modelo de imagen de modelos.json que existe en la cuenta de Gemini (para las fotos de catálogo). */
async function modeloDeImagen(): Promise<RespuestaSalud['imagen']> {
  const candidatos = modelosImagen();
  if (!candidatos.length || !motores.proveedorDisponible('gemini')) return { modelo: null, disponible: false };
  const existentes = new Set((await motores.obtenerProveedor('gemini').listarModelos()).map((m) => m.replace(/^models\//, '')));
  const modelo = candidatos.find((m) => existentes.has(m)) ?? null;
  return { modelo, disponible: modelo !== null };
}

rutasSalud.get(
  '/salud',
  asincrono(async (_req, res) => {
    const modo = env('MOTOR_MODO', 'real') === 'simulado' ? 'simulado' : 'real';
    const detalles: string[] = [];
    const [firestore, storage] = await Promise.all([probarFirestore(), probarStorage()]);
    if (firestore !== 'ok') detalles.push(`Firestore: ${firestore === 'sin-configurar' ? 'falta vincular el proyecto de Firebase' : 'configurado pero no responde'}${proyectoId() ? ` (proyecto ${proyectoId()})` : ''}.`);
    if (storage !== 'ok') detalles.push('Storage: las fotos no se podrán guardar hasta vincular el bucket.');

    const gemini: RespuestaSalud['gemini'] = env('GEMINI_API_KEY') ? 'ok' : 'sin-llave';
    const claude: RespuestaSalud['claude'] = env('ANTHROPIC_API_KEY') ? 'ok' : 'sin-llave';
    if (gemini === 'sin-llave' && modo === 'real') detalles.push('Falta GEMINI_API_KEY: el asistente no puede pensar todavía.');
    if (claude === 'sin-llave') detalles.push('Sin llave de Claude: todos los agentes usan Gemini (esto es normal).');

    let modelos: RespuestaSalud['modelos'] = [];
    let imagen: RespuestaSalud['imagen'];
    if (!cacheModelos || cacheModelos.hasta < Date.now()) {
      try {
        const validaciones = await validarModelos(motores);
        modelos = validaciones.map((m) => ({ agente: m.agente, proveedor: m.proveedor, modelo: m.modelo, valido: m.valido, motivo: m.motivo }));
        // Un proveedor que no pudo listar: casi siempre es la llave. Un solo aviso, con la causa.
        const sinLista = new Map<string, string | undefined>();
        for (const m of validaciones) if (m.motivo === 'sin-lista' && !sinLista.has(m.proveedor)) sinLista.set(m.proveedor, m.detalle);
        for (const [prov, detalle] of sinLista) {
          const llave = prov === 'claude' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY';
          const esLlave = /401|403|authentication|api key not valid|invalid x-api-key|permission/i.test(detalle ?? '');
          detalles.push(
            esLlave
              ? `${prov === 'claude' ? 'Claude' : 'Gemini'} rechazó la llave ${llave}. Vuelve a pegarla en la configuración del servidor (sin espacios al inicio o al final).`
              : `No se pudo consultar la lista de modelos de ${prov}${detalle ? ` (${detalle.slice(0, 120)})` : ''}. Puede ser la llave o la red; los agentes de ${prov} caerán al otro motor mientras tanto.`,
          );
        }
        imagen = await modeloDeImagen().catch(() => undefined);
        cacheModelos = { hasta: Date.now() + 10 * 60 * 1000, modelos, imagen };
      } catch (e) {
        detalles.push(`No se pudieron validar los modelos: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      modelos = cacheModelos.modelos;
      imagen = cacheModelos.imagen;
    }
    if (imagen && !imagen.disponible && modo === 'real') {
      detalles.push('Ningún modelo de imagen de modelos.json ("imagen.modelos") está disponible para tu llave de Gemini: las fotos de catálogo quedan con el recorte gratuito.');
    }
    for (const m of modelos) if (!m.valido && m.motivo !== 'sin-lista') detalles.push(`El modelo "${m.modelo}" del agente ${m.agente} no existe en ${m.proveedor}. Revisa server/src/config/modelos.json.`);

    const respuesta: RespuestaSalud = {
      ok: firestore === 'ok' && (gemini === 'ok' || modo === 'simulado') && modelos.every((m) => m.valido),
      firestore,
      storage,
      gemini,
      claude,
      modelos,
      imagen,
      modo,
      detalles,
    };
    res.json(respuesta);
  }),
);
