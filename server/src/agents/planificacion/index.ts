/**
 * Planificación: plan semanal en JSON (modelo Pro) y ajuste/look del día (modelo Lite).
 */
import type { Look, PlanDia, PlanSemanal } from '@shared/types.js';
import type { ContextoCliente } from '../../memory/contexto.js';
import { ejecutarAgente, extraerJson, mensajeUsuario } from '../base.js';
import { ejecutorArmario, herramientas } from '../../tools/armario.js';
import { debeRevisar, revisarConCalidad } from '../calidad/index.js';
import { nombreDia, sumarDias } from '../../util/ids.js';
import { resumenClima } from '../../tools/clima.js';

const ESQUEMA_LOOK = {
  type: 'object',
  properties: {
    titulo: { type: 'string' },
    prendaIds: { type: 'array', items: { type: 'string' } },
    motivo: { type: 'string' },
    clima: { type: 'string' },
    ocasion: { type: 'string' },
  },
  required: ['titulo', 'prendaIds', 'motivo'],
};

const ESQUEMA_SEMANA = {
  type: 'object',
  properties: {
    dias: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'YYYY-MM-DD' },
          look: ESQUEMA_LOOK,
          alternativa: ESQUEMA_LOOK,
          notas: { type: 'string' },
        },
        required: ['fecha', 'look'],
      },
    },
    resumen: { type: 'string', description: 'Dos frases para el cliente: criterio general y qué lavar/cuándo.' },
  },
  required: ['dias', 'resumen'],
};

function validarLook(look: Look | undefined, ids: Set<string>): Look | undefined {
  if (!look) return undefined;
  const prendaIds = (look.prendaIds ?? []).filter((id) => ids.has(id));
  if (!prendaIds.length) return undefined;
  return { ...look, prendaIds };
}

export interface ResultadoSemana {
  plan: PlanSemanal;
  resumen: string;
  notasCalidad: string[];
  costoUsd: number;
}

export async function generarSemana(ctx: ContextoCliente, inicio: string, notas?: string): Promise<ResultadoSemana> {
  const fechas = Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i));
  const climaPorDia = new Map((ctx.clima ?? []).map((c) => [c.fecha, c]));
  const agenda = fechas
    .map((f) => {
      const dia = nombreDia(f);
      const rutina = ctx.perfil.rutina?.[dia]?.join(' + ') ?? 'sin datos';
      const c = climaPorDia.get(f);
      return `${dia} ${f}: rutina "${rutina}"${c ? ' · clima ' + resumenClima(c) : ''}`;
    })
    .join('\n');

  const encargo = [
    `Planifica la semana del ${inicio} al ${fechas[6]}: un look por día con prendas reales del armario (usa los ids exactos).`,
    'Agenda y clima por día:',
    agenda,
    notas ? `Indicaciones del cliente: ${notas}` : '',
    'Reglas: ninguna prenda visible repetida en la semana (abrigos, calzado y accesorios pueden repetirse); evita prendas "para-lavar", "en-lavado" o "reparar"; respeta usos disponibles; guarda lo más pulido para los días importantes; añade "alternativa" solo en días con lluvia probable o evento incierto.',
    'Si el armario no alcanza para siete días sin repetir, repite lo mínimo y explícalo en "notas" del día.',
    'Devuelve solo el JSON del esquema.',
  ]
    .filter(Boolean)
    .join('\n');

  const r = await ejecutarAgente({
    agente: 'planificacion',
    ctx,
    mensajes: [mensajeUsuario(encargo)],
    herramientas: herramientas('listar_prendas'),
    ejecutar: ejecutorArmario(ctx),
    esquemaJson: ESQUEMA_SEMANA,
    maxVueltas: 3,
    temperatura: 0.5,
  });
  const json = extraerJson<{ dias: PlanDia[]; resumen: string }>(r.texto);
  if (!json?.dias?.length) throw new Error('No pudimos armar el plan. Revisa que haya prendas suficientes en el armario y que el perfil tenga tu rutina.');

  const ids = new Set(ctx.prendas.map((p) => p.id));
  const dias: PlanDia[] = fechas.map((f) => {
    const d = json.dias.find((x) => x.fecha === f) ?? json.dias[fechas.indexOf(f)];
    const look = validarLook(d?.look, ids) ?? { titulo: 'Día libre de plan', prendaIds: [], motivo: 'No hubo prendas disponibles para este día.' };
    return { fecha: f, look, alternativa: validarLook(d?.alternativa, ids), notas: d?.notas };
  });

  let resumen = json.resumen ?? '';
  let notasCalidad: string[] = [];
  let costo = r.costoUsd;
  if (debeRevisar('plan-semanal', resumen)) {
    const textoPlan = dias.map((d) => `${nombreDia(d.fecha)} ${d.fecha}: ${d.look.titulo} — ${d.look.prendaIds.join(', ')} — ${d.look.motivo}`).join('\n');
    const rev = await revisarConCalidad(ctx, `${resumen}\n\n${textoPlan}`, { tipo: 'plan-semanal' });
    notasCalidad = rev.notas;
    costo += rev.costoUsd;
    // Solo tomamos del revisor el resumen (primer párrafo); la estructura del plan ya está validada contra el armario.
    if (rev.reviso && !rev.aprobado) resumen = rev.texto.split('\n\n')[0] ?? resumen;
  }

  const plan: PlanSemanal = {
    id: inicio,
    semanaInicio: inicio,
    dias,
    generadoPor: `${r.proveedor}:${r.modelo}`,
    creadoEn: new Date().toISOString(),
  };
  return { plan, resumen, notasCalidad, costoUsd: costo };
}

/** Look del día cuando no hay plan semanal (modelo ligero). */
export async function lookDelDia(ctx: ContextoCliente, fecha: string): Promise<{ dia: PlanDia; costoUsd: number }> {
  const clima = ctx.clima?.find((c) => c.fecha === fecha);
  const dia = nombreDia(fecha);
  const encargo = [
    `Propón el look de hoy, ${dia} ${fecha}, con prendas reales del armario (ids exactos).`,
    `Rutina del día: ${ctx.perfil.rutina?.[dia]?.join(' + ') ?? 'sin datos (asume un día normal)'}.`,
    clima ? `Clima: ${resumenClima(clima)}.` : 'Sin datos de clima.',
    'Evita prendas para lavar. Devuelve solo el JSON del esquema.',
  ].join('\n');
  const r = await ejecutarAgente({
    agente: 'planificacion',
    ctx,
    mensajes: [mensajeUsuario(encargo)],
    esquemaJson: ESQUEMA_LOOK,
    variante: 'diario',
    maxVueltas: 1,
    temperatura: 0.6,
  });
  const json = extraerJson<Look>(r.texto);
  const ids = new Set(ctx.prendas.map((p) => p.id));
  const look = validarLook(json ?? undefined, ids) ?? {
    titulo: 'Aún no hay suficientes prendas',
    prendaIds: [],
    motivo: 'Sube algunas prendas al armario y Sastra te propone el look.',
  };
  return { dia: { fecha, look }, costoUsd: r.costoUsd };
}
