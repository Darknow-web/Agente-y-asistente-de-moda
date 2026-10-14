/**
 * Armario: prendas, catalogación por foto, usos, lavado, deseos, resumen (ropa dormida),
 * "tres formas de ponértela" y memoria de ajuste.
 */
import { Router as ExpressRouter } from 'express';
import type { Deseo, NombrePlan, Prenda } from '@shared/types.js';
import type { ReqAjuste, ReqCatalogar, ReqCrearPrenda, ReqRegistrarUso, RespCatalogar, RespFotosCatalogo, RespResumenArmario } from '@shared/api.js';
import { requiereInvitado, requiereSesion } from '../auth/middleware.js';
import {
  actualizarPrenda,
  crearAjuste,
  crearDeseo,
  crearPrenda,
  eliminarDeseo,
  eliminarPrenda,
  leerPrenda,
  listarAjustes,
  listarDeseos,
  listarPrendas,
  marcarLavada,
  registrarUso,
  ultimoUsoPorPrenda,
  contarHoy,
  contarPrendas,
} from '../data/repos.js';
import { borrarFotoPrenda, subirFotoPrenda } from '../data/storage.js';
import { pulirFotoDePrenda, quedaCupoDeRetoque, restaurarFotoOriginal } from '../imagenes/pulir.js';
import { ErrorHttp, asincrono, noEncontrado, peticionInvalida, requierePremium } from '../util/errores.js';
import { alcanzoLimite, limitesDe } from '../config/planes.js';
import { construirContexto } from '../memory/construir.js';
import { calcularResumenArmario } from '../data/resumen-armario.js';
import { catalogarFoto } from '../agents/guardarropa/index.js';
import { formasDeUso } from '../agents/estilismo/index.js';
import { debeRevisar, revisarConCalidad } from '../agents/calidad/index.js';
import { ahora } from '../util/ids.js';

export const rutasArmario = ExpressRouter();

/** Plan Gratis: tope de prendas. Se comprueba antes de catalogar (para no gastar IA) y al guardar. */
async function exigirEspacioEnArmario(uid: string, plan: NombrePlan): Promise<void> {
  const tope = limitesDe(plan).prendasMax;
  if (tope === null) return;
  if (alcanzoLimite(tope, await contarPrendas(uid))) {
    throw requierePremium(`Tu armario Gratis admite ${tope} prendas y ya está lleno. Con Premium no hay límite.`);
  }
}
// Solo a las rutas de este módulo (un `use` sin ruta afectaría a todo /api)
rutasArmario.use(['/prendas', '/deseos', '/armario', '/ajustes'], requiereSesion, requiereInvitado);

/** Resumen del armario con el último uso real de cada prenda (ver data/resumen-armario.ts). */
export async function resumenArmario(uid: string, prendas: Prenda[], moneda = 'PEN'): Promise<RespResumenArmario> {
  const ultimos = await ultimoUsoPorPrenda(uid).catch(() => new Map<string, string>());
  return calcularResumenArmario(prendas, ultimos, moneda);
}

rutasArmario.get(
  '/armario/resumen',
  asincrono(async (req, res) => {
    const ctx = await construirContexto(req.usuario!.uid, req.usuario!.email, { conClima: false });
    res.json(await resumenArmario(ctx.uid, ctx.prendas, ctx.perfil.moneda ?? 'PEN'));
  }),
);

rutasArmario.post(
  '/prendas/:id/formas',
  asincrono(async (req, res) => {
    const ctx = await construirContexto(req.usuario!.uid, req.usuario!.email, { conClima: false });
    const prenda = ctx.prendas.find((p) => p.id === String(req.params.id));
    if (!prenda) throw noEncontrado('Esa prenda no existe.');
    const vigentes = prenda.formasDeUso?.length && req.query.regenerar !== '1';
    if (vigentes) return res.json(prenda);
    if (ctx.prendas.length < 3) throw peticionInvalida('Con menos de tres prendas en el armario no hay con qué combinarla todavía.');
    const { formas } = await formasDeUso(ctx, prenda);
    if (!formas.length) throw new Error('Estilismo no pudo proponer formas de uso ahora. Inténtalo de nuevo en un momento.');
    const actualizada = await actualizarPrenda(ctx.uid, prenda.id, { formasDeUso: formas, formasDeUsoEn: ahora() });
    res.json(actualizada ?? { ...prenda, formasDeUso: formas });
  }),
);

rutasArmario.get(
  '/ajustes',
  asincrono(async (req, res) => {
    res.json(await listarAjustes(req.usuario!.uid));
  }),
);

rutasArmario.post(
  '/ajustes',
  asincrono(async (req, res) => {
    const a = (req.body ?? {}) as ReqAjuste;
    if (!['ajustado', 'bien', 'holgado'].includes(a.ajuste)) throw peticionInvalida('Dime si te quedó ajustado, bien u holgado.');
    if (!a.prendaId && !a.marca) throw peticionInvalida('Indica la prenda o la marca.');
    res.status(201).json(await crearAjuste(req.usuario!.uid, { prendaId: a.prendaId, marca: a.marca, categoria: a.categoria, talla: a.talla, ajuste: a.ajuste, nota: a.nota }));
  }),
);

rutasArmario.get(
  '/prendas',
  asincrono(async (req, res) => {
    res.json(await listarPrendas(req.usuario!.uid));
  }),
);

rutasArmario.get(
  '/prendas/:id',
  asincrono(async (req, res) => {
    const p = await leerPrenda(req.usuario!.uid, String(req.params.id));
    if (!p) throw noEncontrado('Esa prenda no existe.');
    res.json(p);
  }),
);

rutasArmario.post(
  '/prendas/catalogar',
  asincrono(async (req, res) => {
    const { foto, pista, rapido } = (req.body ?? {}) as ReqCatalogar;
    if (!foto?.datos || foto.tipo !== 'imagen') throw peticionInvalida('Necesitamos una foto de la prenda.');
    await exigirEspacioEnArmario(req.usuario!.uid, req.usuario!.plan); // antes de gastar IA en catalogar
    const ctx = await construirContexto(req.usuario!.uid, req.usuario!.email, { conClima: false });
    const r = await catalogarFoto(ctx, foto, pista);
    let preguntas = r.preguntas;
    // En lotes no pasa por Calidad: su revisión solo reformula preguntas y duplica el tiempo por foto.
    if (!rapido && debeRevisar('catalogacion', JSON.stringify(r.propuesta))) {
      const rev = await revisarConCalidad(ctx, `Propuesta de catalogación: ${JSON.stringify(r.propuesta)}\nPreguntas: ${preguntas.join(' | ')}`, { tipo: 'catalogacion', pregunta: pista });
      // La revisión de catalogación solo puede aportar preguntas mejor formuladas; los datos ya vienen estructurados.
      if (rev.reviso && !rev.aprobado) {
        const nuevas = rev.texto.split('\n').filter((l) => l.trim().endsWith('?')).map((l) => l.replace(/^[-*\d.\s]+/, '').trim());
        if (nuevas.length) preguntas = nuevas.slice(0, 3);
      }
    }
    const respuesta: RespCatalogar = { propuesta: r.propuesta, preguntas };
    res.json(respuesta);
  }),
);

rutasArmario.post(
  '/prendas',
  asincrono(async (req, res) => {
    const { prenda, foto } = (req.body ?? {}) as ReqCrearPrenda;
    if (!prenda?.nombre || !prenda.categoria) throw peticionInvalida('La prenda necesita nombre y categoría.');
    await exigirEspacioEnArmario(req.usuario!.uid, req.usuario!.plan);
    const creada = await crearPrenda(req.usuario!.uid, {
      ...prenda,
      colores: Array.isArray(prenda.colores) ? prenda.colores : [],
      estado: prenda.estado ?? 'limpia',
      usosDesdeLavado: prenda.usosDesdeLavado ?? 0,
      usosMaxAntesDeLavar: prenda.usosMaxAntesDeLavar ?? 3,
    });
    if (foto?.datos) {
      try {
        const { url } = await subirFotoPrenda(req.usuario!.uid, creada.id, foto);
        const conFoto = await actualizarPrenda(req.usuario!.uid, creada.id, { fotoUrl: url, fotoMiniUrl: url });
        return res.status(201).json(conFoto ?? creada);
      } catch (e) {
        console.warn('[armario] no se pudo subir la foto:', e instanceof Error ? e.message : e);
      }
    }
    res.status(201).json(creada);
  }),
);

// Pulido automático tras subir: recorte gratuito; en Premium, además, foto de catálogo con IA (si queda cupo hoy;
// si no, queda pendiente y la tarea diaria la continúa).
rutasArmario.post(
  '/prendas/:id/foto/pulir',
  asincrono(async (req, res) => {
    const limites = limitesDe(req.usuario!.plan);
    const r = await pulirFotoDePrenda(req.usuario!.uid, String(req.params.id), {
      catalogosPorDia: limites.mejorarFotoPorDia,
      catalogoAutomatico: limites.fotoCatalogoAutomatica,
    });
    res.json(r.prenda);
  }),
);

// "Pasar mi armario a foto de catálogo": marca como pendientes las prendas con foto que aún no la tienen.
// El cliente las procesa una a una con /foto/mejorar; lo que no alcance hoy lo sigue la tarea diaria.
rutasArmario.post(
  '/armario/fotos-catalogo',
  asincrono(async (req, res) => {
    const { uid, plan } = req.usuario!;
    const limites = limitesDe(plan);
    if (limites.mejorarFotoPorDia <= 0) {
      throw requierePremium('Las fotos de catálogo con IA son parte de Premium. El recorte de fondo sigue siendo gratis.');
    }
    const pendientes = (await listarPrendas(uid)).filter(
      (p) => (p.fotoOriginalUrl || p.fotoUrl) && p.fotoRetoque !== 'catalogo' && p.fotoRetoque !== 'original',
    );
    await Promise.all(pendientes.map((p) => actualizarPrenda(uid, p.id, { fotoCatalogoPendiente: true })));
    const usados = await contarHoy(uid, 'retoques');
    const respuesta: RespFotosCatalogo = {
      pendientes: pendientes.map((p) => p.id),
      cupoHoy: Math.max(0, limites.mejorarFotoPorDia - usados),
    };
    res.json(respuesta);
  }),
);

// Botón "Mejorar foto": foto de catálogo con IA (descuenta del cupo diario) + recorte.
rutasArmario.post(
  '/prendas/:id/foto/mejorar',
  asincrono(async (req, res) => {
    const { uid, plan } = req.usuario!;
    const cupo = limitesDe(plan).mejorarFotoPorDia;
    if (cupo <= 0) throw requierePremium('Las fotos de catálogo con IA son parte de Premium. El recorte de fondo sigue siendo gratis.');
    if (!(await quedaCupoDeRetoque(uid, cupo))) {
      throw new ErrorHttp(429, `Llegaste a las ${cupo} fotos de catálogo de hoy. Las que faltan siguen solas mañana.`, undefined, 'cupo-fotos');
    }
    const r = await pulirFotoDePrenda(uid, String(req.params.id), { forzarCatalogo: true, catalogosPorDia: cupo });
    if (r.resumen === 'descartada') {
      throw new ErrorHttp(422, 'La IA no logró una foto fiel a tu prenda (cambiaba detalles), así que dejamos la tuya. Prueba con una foto más clara, con la prenda sola.');
    }
    if (r.resumen === 'sin-cambios') throw new ErrorHttp(502, 'No pudimos mejorar esta foto. Prueba con otra más iluminada, con la prenda sola sobre un fondo liso.');
    res.json(r.prenda);
  }),
);

rutasArmario.post(
  '/prendas/:id/foto/original',
  asincrono(async (req, res) => {
    res.json(await restaurarFotoOriginal(req.usuario!.uid, String(req.params.id)));
  }),
);

rutasArmario.patch(
  '/prendas/:id',
  asincrono(async (req, res) => {
    const cambios = (req.body ?? {}) as Partial<Prenda>;
    const p = await actualizarPrenda(req.usuario!.uid, String(req.params.id), cambios);
    if (!p) throw noEncontrado('Esa prenda no existe.');
    res.json(p);
  }),
);

rutasArmario.delete(
  '/prendas/:id',
  asincrono(async (req, res) => {
    const id = String(req.params.id);
    await eliminarPrenda(req.usuario!.uid, id);
    borrarFotoPrenda(req.usuario!.uid, id).catch(() => undefined);
    res.json({ ok: true });
  }),
);

rutasArmario.post(
  '/prendas/:id/uso',
  asincrono(async (req, res) => {
    const { contexto, ajuste } = (req.body ?? {}) as ReqRegistrarUso;
    const nivel = ajuste && ['ajustado', 'bien', 'holgado'].includes(ajuste) ? ajuste : undefined;
    const p = await registrarUso(req.usuario!.uid, String(req.params.id), contexto || undefined, nivel);
    if (!p) throw noEncontrado('Esa prenda no existe.');
    res.json(p);
  }),
);

rutasArmario.post(
  '/prendas/:id/lavada',
  asincrono(async (req, res) => {
    const p = await marcarLavada(req.usuario!.uid, String(req.params.id));
    if (!p) throw noEncontrado('Esa prenda no existe.');
    res.json(p);
  }),
);

// ---------------------------------------------------------------- deseos
rutasArmario.get(
  '/deseos',
  asincrono(async (req, res) => {
    res.json(await listarDeseos(req.usuario!.uid));
  }),
);

rutasArmario.post(
  '/deseos',
  asincrono(async (req, res) => {
    const d = (req.body ?? {}) as Omit<Deseo, 'id' | 'creadoEn'>;
    if (!d.nombre) throw peticionInvalida('El deseo necesita un nombre.');
    res.status(201).json(await crearDeseo(req.usuario!.uid, { ...d, prioridad: d.prioridad ?? 'media' }));
  }),
);

rutasArmario.delete(
  '/deseos/:id',
  asincrono(async (req, res) => {
    await eliminarDeseo(req.usuario!.uid, String(req.params.id));
    res.json({ ok: true });
  }),
);
