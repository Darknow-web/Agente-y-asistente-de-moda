/**
 * Tareas programadas (autonomía). Las llama Cloud Scheduler con la cabecera x-jobs-secret.
 *   POST /api/jobs/look-del-dia          → aviso con el look de hoy para cada usuario
 *   POST /api/jobs/plan-semanal          → genera el plan de la semana que empieza (domingo por la noche)
 *   POST /api/jobs/recordatorios-lavado  → aviso con las prendas que tocan lavar
 */
import { Router as ExpressRouter } from 'express';
import type { RespJob } from '@shared/api.js';
import { requiereSecretoJobs } from '../auth/middleware.js';
import { crearAviso, existeAvisoHoy, guardarPlan, leerPlan, listarUsuariosActivos } from '../data/repos.js';
import { asincrono } from '../util/errores.js';
import { construirContexto } from '../memory/construir.js';
import { generarSemana, lookDelDia } from '../agents/planificacion/index.js';
import { fechaLocal, lunesDe, sumarDias } from '../util/ids.js';

export const rutasJobs = ExpressRouter();
rutasJobs.use('/jobs', requiereSecretoJobs);

async function porUsuario(fn: (uid: string, email: string) => Promise<string | null>): Promise<RespJob> {
  const usuarios = await listarUsuariosActivos();
  const detalles: string[] = [];
  let procesados = 0;
  for (const u of usuarios) {
    try {
      const d = await fn(u.uid, u.email);
      if (d) {
        detalles.push(`${u.email}: ${d}`);
        procesados++;
      }
    } catch (e) {
      detalles.push(`${u.email}: error ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { ok: true, usuariosProcesados: procesados, detalles };
}

rutasJobs.post(
  '/jobs/look-del-dia',
  asincrono(async (_req, res) => {
    res.json(
      await porUsuario(async (uid, email) => {
        if (await existeAvisoHoy(uid, 'look-del-dia')) return null;
        const ctx = await construirContexto(uid, email);
        if (ctx.prendas.length < 3) return null;
        const hoy = fechaLocal(new Date(), ctx.zona);
        const plan = await leerPlan(uid, lunesDe(hoy));
        let dia = plan?.dias.find((d) => d.fecha === hoy);
        if (!dia) dia = (await lookDelDia(ctx, hoy)).dia;
        const nombres = dia.look.prendaIds.map((id) => ctx.prendas.find((p) => p.id === id)?.nombre).filter(Boolean).join(', ');
        await crearAviso(uid, { tipo: 'look-del-dia', titulo: dia.look.titulo, cuerpo: `${nombres}. ${dia.look.motivo}`, datos: { fecha: hoy, prendaIds: dia.look.prendaIds } });
        return dia.look.titulo;
      }),
    );
  }),
);

rutasJobs.post(
  '/jobs/plan-semanal',
  asincrono(async (_req, res) => {
    res.json(
      await porUsuario(async (uid, email) => {
        const ctx = await construirContexto(uid, email);
        if (ctx.prendas.length < 5) return null;
        // Si hoy es domingo planificamos la semana que empieza mañana; si no, la actual si falta.
        const hoy = fechaLocal(new Date(), ctx.zona);
        const inicio = new Date(`${hoy}T12:00:00Z`).getUTCDay() === 0 ? sumarDias(hoy, 1) : lunesDe(hoy);
        if (await leerPlan(uid, inicio)) return null;
        const { plan, resumen } = await generarSemana(ctx, inicio);
        await guardarPlan(uid, plan);
        await crearAviso(uid, { tipo: 'plan-semanal', titulo: 'Tu semana está planificada', cuerpo: resumen || 'Entra a Semana para verla.', datos: { semanaInicio: inicio } });
        return `plan ${inicio}`;
      }),
    );
  }),
);

rutasJobs.post(
  '/jobs/recordatorios-lavado',
  asincrono(async (_req, res) => {
    res.json(
      await porUsuario(async (uid, email) => {
        if (await existeAvisoHoy(uid, 'lavado')) return null;
        const ctx = await construirContexto(uid, email, { conClima: false });
        const tocan = ctx.prendas.filter((p) => p.estado === 'para-lavar' || (p.usosMaxAntesDeLavar && p.usosDesdeLavado >= p.usosMaxAntesDeLavar));
        if (!tocan.length) return null;
        const lista = tocan.slice(0, 8).map((p) => p.nombre).join(', ');
        await crearAviso(uid, {
          tipo: 'lavado',
          titulo: tocan.length === 1 ? 'Una prenda toca lavar' : `${tocan.length} prendas tocan lavar`,
          cuerpo: `${lista}. Cuando las laves, márcalas en el armario para que vuelvan a estar disponibles.`,
          datos: { prendaIds: tocan.map((p) => p.id) },
        });
        return `${tocan.length} prendas`;
      }),
    );
  }),
);
