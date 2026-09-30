/**
 * Armario: prendas, catalogación por foto, usos, lavado, deseos.
 */
import { Router as ExpressRouter } from 'express';
import type { Deseo, Prenda } from '@shared/types.js';
import type { ReqCatalogar, ReqCrearPrenda, RespCatalogar } from '@shared/api.js';
import { requiereInvitado, requiereSesion } from '../auth/middleware.js';
import {
  actualizarPrenda,
  crearDeseo,
  crearPrenda,
  eliminarDeseo,
  eliminarPrenda,
  leerPrenda,
  listarDeseos,
  listarPrendas,
  marcarLavada,
  registrarUso,
} from '../data/repos.js';
import { borrarFotoPrenda, subirFotoPrenda } from '../data/storage.js';
import { asincrono, noEncontrado, peticionInvalida } from '../util/errores.js';
import { construirContexto } from '../memory/construir.js';
import { catalogarFoto } from '../agents/guardarropa/index.js';
import { debeRevisar, revisarConCalidad } from '../agents/calidad/index.js';

export const rutasArmario = ExpressRouter();
// Solo a las rutas de este módulo (un `use` sin ruta afectaría a todo /api)
rutasArmario.use(['/prendas', '/deseos'], requiereSesion, requiereInvitado);

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
    const { foto, pista } = (req.body ?? {}) as ReqCatalogar;
    if (!foto?.datos || foto.tipo !== 'imagen') throw peticionInvalida('Necesitamos una foto de la prenda.');
    const ctx = await construirContexto(req.usuario!.uid, req.usuario!.email, { conClima: false });
    const r = await catalogarFoto(ctx, foto, pista);
    let preguntas = r.preguntas;
    if (debeRevisar('catalogacion', JSON.stringify(r.propuesta))) {
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
    const p = await registrarUso(req.usuario!.uid, String(req.params.id), (req.body?.contexto as string | undefined) ?? undefined);
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
