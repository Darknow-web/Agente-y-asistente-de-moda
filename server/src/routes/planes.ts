/**
 * Planes: look de hoy y plan semanal.
 */
import { Router as ExpressRouter } from 'express';
import type { ReqGenerarSemana, RespHoy } from '@shared/api.js';
import { requiereInvitado, requiereSesion } from '../auth/middleware.js';
import { guardarPlan, leerPlan } from '../data/repos.js';
import { asincrono, peticionInvalida } from '../util/errores.js';
import { construirContexto } from '../memory/construir.js';
import { generarSemana, lookDelDia } from '../agents/planificacion/index.js';
import { fechaLocal, lunesDe } from '../util/ids.js';

export const rutasPlanes = ExpressRouter();
rutasPlanes.use('/planes', requiereSesion, requiereInvitado);

rutasPlanes.get(
  '/planes/hoy',
  asincrono(async (req, res) => {
    const ctx = await construirContexto(req.usuario!.uid, req.usuario!.email);
    const hoy = fechaLocal(new Date(), ctx.zona);
    const plan = await leerPlan(ctx.uid, lunesDe(hoy));
    let dia = plan?.dias.find((d) => d.fecha === hoy) ?? null;
    if (!dia && ctx.prendas.length >= 3 && req.query.generar !== '0') {
      dia = (await lookDelDia(ctx, hoy)).dia;
    }
    const ids = new Set(dia?.look.prendaIds ?? []);
    const clima = ctx.clima?.find((c) => c.fecha === hoy);
    const respuesta: RespHoy = {
      dia,
      prendas: ctx.prendas.filter((p) => ids.has(p.id)),
      clima: clima ? { temperaturaC: clima.temperaturaC, descripcion: clima.descripcion, lluvia: clima.lluvia } : undefined,
    };
    res.json(respuesta);
  }),
);

rutasPlanes.get(
  '/planes/semana',
  asincrono(async (req, res) => {
    const inicio = String(req.query.inicio ?? lunesDe(fechaLocal()));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) throw peticionInvalida('La fecha de inicio debe ser YYYY-MM-DD.');
    res.json(await leerPlan(req.usuario!.uid, lunesDe(inicio)));
  }),
);

rutasPlanes.post(
  '/planes/semana',
  asincrono(async (req, res) => {
    const { inicio, notas } = (req.body ?? {}) as ReqGenerarSemana;
    const semana = lunesDe(inicio && /^\d{4}-\d{2}-\d{2}$/.test(inicio) ? inicio : fechaLocal());
    const ctx = await construirContexto(req.usuario!.uid, req.usuario!.email);
    if (ctx.prendas.length < 5) throw peticionInvalida('Para planificar una semana necesito al menos cinco prendas en tu armario.');
    const { plan, resumen } = await generarSemana(ctx, semana, notas);
    await guardarPlan(ctx.uid, plan);
    res.status(201).json({ ...plan, resumen });
  }),
);
