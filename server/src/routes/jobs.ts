/**
 * Tareas programadas (autonomía). Las llama Cloud Scheduler con la cabecera x-jobs-secret.
 *   POST /api/jobs/look-del-dia          → aviso con el look de hoy para cada usuario
 *   POST /api/jobs/plan-semanal          → genera el plan de la semana que empieza (domingo por la noche)
 *   POST /api/jobs/recordatorios-lavado  → aviso con las prendas que tocan lavar
 *   POST /api/jobs/diario                → estrenos pendientes, ropa dormida, deseos en enfriamiento
 * Cada aviso llega también como notificación push si el usuario la activó, y el diario del
 * departamento registra lo que el equipo hizo por su cuenta.
 */
import { Router as ExpressRouter } from 'express';
import type { RespJob } from '@shared/api.js';
import { requiereSecretoJobs } from '../auth/middleware.js';
import { actualizarDeseo, existeAvisoHoy, guardarPlan, leerPlan, listarDeseos, listarUsuariosActivos, actualizarPrenda } from '../data/repos.js';
import { anotarDiario, avisar } from '../data/avisar.js';
import { asincrono } from '../util/errores.js';
import { construirContexto } from '../memory/construir.js';
import { generarSemana, lookDelDia } from '../agents/planificacion/index.js';
import { formasDeUso } from '../agents/estilismo/index.js';
import { resumenArmario } from './armario.js';
import { ahora, fechaLocal, lunesDe, sumarDias } from '../util/ids.js';

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
        await avisar(uid, { tipo: 'look-del-dia', titulo: dia.look.titulo, cuerpo: `${nombres}. ${dia.look.motivo}`, datos: { fecha: hoy, prendaIds: dia.look.prendaIds } });
        await anotarDiario(uid, plan ? 'planificacion' : 'estilismo', 'Preparó tu look de hoy', `${dia.look.titulo}: ${nombres}.`, { fecha: hoy });
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
        await avisar(uid, { tipo: 'plan-semanal', titulo: 'Tu semana está planificada', cuerpo: resumen || 'Entra a Semana para verla.', datos: { semanaInicio: inicio } });
        await anotarDiario(uid, 'planificacion', 'Planificó tu semana', `Semana del ${inicio}: ${plan.dias.length} días con look y alternativa.`, { semanaInicio: inicio });
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
        await avisar(uid, {
          tipo: 'lavado',
          titulo: tocan.length === 1 ? 'Una prenda toca lavar' : `${tocan.length} prendas tocan lavar`,
          cuerpo: `${lista}. Cuando las laves, márcalas en el armario para que vuelvan a estar disponibles.`,
          datos: { prendaIds: tocan.map((p) => p.id) },
        });
        await anotarDiario(uid, 'cuidado', 'Revisó qué toca lavar', `${lista}.`, { prendaIds: tocan.map((p) => p.id) });
        return `${tocan.length} prendas`;
      }),
    );
  }),
);

/**
 * Tarea diaria: lo que un departamento haría cada mañana sin que nadie se lo pida.
 *  - Estreno: una prenda nueva lleva 30 días sin usarse → aviso con una forma de ponérsela.
 *  - Ropa dormida: una vez por semana (lunes), resumen de lo que lleva 60+ días sin uso y su valor.
 *  - Deseos en enfriamiento: a los 7 días, "¿sigues queriéndolo?" con qué lo combinaría (Estilismo).
 */
rutasJobs.post(
  '/jobs/diario',
  asincrono(async (_req, res) => {
    res.json(
      await porUsuario(async (uid, email) => {
        const ctx = await construirContexto(uid, email, { conClima: false });
        const hechos: string[] = [];
        const resumen = await resumenArmario(uid, ctx.prendas, ctx.perfil.moneda ?? 'PEN');
        const moneda = resumen.moneda === 'PEN' ? 'S/' : resumen.moneda;

        // Estreno pendiente (30 días sin uso desde que entró)
        const pendiente = resumen.sinEstrenar.find((p) => p.dias >= 30);
        if (pendiente && !(await existeAvisoHoy(uid, 'estreno'))) {
          const prenda = ctx.prendas.find((p) => p.id === pendiente.id);
          if (prenda) {
            let forma = prenda.formasDeUso?.[0];
            if (!forma && ctx.prendas.length >= 3) {
              const r = await formasDeUso(ctx, prenda).catch(() => ({ formas: [] }));
              if (r.formas.length) {
                await actualizarPrenda(uid, prenda.id, { formasDeUso: r.formas, formasDeUsoEn: ahora() });
                forma = r.formas[0];
              }
            }
            const con = forma?.prendaIds.map((id) => ctx.prendas.find((p) => p.id === id)?.nombre).filter(Boolean).join(', ');
            await avisar(uid, {
              tipo: 'estreno',
              titulo: `${prenda.nombre} lleva ${pendiente.dias} días sin estrenar`,
              cuerpo: forma ? `Pruébala así: ${forma.titulo}${con ? ', con ' + con : ''}. ${forma.motivo}` : 'Pídele a Sastra una forma de ponértela esta semana.',
              agente: 'estilismo',
              datos: { prendaId: prenda.id },
              url: `/armario/${encodeURIComponent(prenda.id)}`,
            });
            hechos.push(`estreno ${prenda.nombre}`);
          }
        }

        // Ropa dormida: resumen semanal los lunes
        const hoy = fechaLocal(new Date(), ctx.zona);
        const esLunes = new Date(`${hoy}T12:00:00Z`).getUTCDay() === 1;
        if (esLunes && resumen.dormidas.length && !(await existeAvisoHoy(uid, 'dormida'))) {
          const nombres = resumen.dormidas.slice(0, 5).map((p) => p.nombre).join(', ');
          const valor = resumen.valorSinUso ? ` Entre todas suman ${moneda} ${resumen.valorSinUso} que no se están usando.` : '';
          await avisar(uid, {
            tipo: 'dormida',
            titulo: resumen.dormidas.length === 1 ? 'Una prenda lleva dos meses sin salir' : `${resumen.dormidas.length} prendas llevan dos meses sin salir`,
            cuerpo: `${nombres}.${valor} Entra al armario y Estilismo te propone cómo usarlas.`,
            agente: 'estilismo',
            datos: { prendaIds: resumen.dormidas.map((p) => p.id) },
          });
          hechos.push(`${resumen.dormidas.length} dormidas`);
        }

        // Deseos en enfriamiento
        const deseos = await listarDeseos(uid);
        const vencidos = deseos.filter((d) => !d.recordado && d.recordatorioEn && d.recordatorioEn <= ahora());
        for (const d of vencidos.slice(0, 2)) {
          let combina: string[] = [];
          if (ctx.prendas.length >= 3) {
            const r = await formasDeUso(ctx, {
              id: `deseo_${d.id}`,
              nombre: d.nombre,
              categoria: 'otro',
              colores: [],
              estado: 'limpia',
              usosDesdeLavado: 0,
              usosMaxAntesDeLavar: 3,
              creadaEn: d.creadoEn,
              actualizadaEn: d.creadoEn,
            }).catch(() => ({ formas: [] }));
            combina = [...new Set(r.formas.flatMap((f) => f.prendaIds))].map((id) => ctx.prendas.find((p) => p.id === id)?.nombre).filter((n): n is string => Boolean(n)).slice(0, 5);
          }
          await actualizarDeseo(uid, d.id, { recordado: true, combinaCon: combina });
          await avisar(uid, {
            tipo: 'deseo',
            titulo: `¿Sigues queriendo ${d.nombre}?`,
            cuerpo: combina.length ? `Pasó una semana. Lo combinarías con ${combina.join(', ')}. Si ya no lo quieres, quítalo de la lista.` : 'Pasó una semana. Si sigue en tu cabeza, quizá sí lo necesitas; si no, quítalo de la lista.',
            agente: 'compras',
            datos: { deseoId: d.id },
          });
          hechos.push(`deseo ${d.nombre}`);
        }

        return hechos.length ? hechos.join(' · ') : null;
      }),
    );
  }),
);
