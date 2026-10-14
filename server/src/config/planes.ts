/**
 * Planes de SASTRA (Gratis y Premium): límites, precios y cálculo del plan efectivo de una persona.
 * Los valores viven en planes.json para cambiarlos sin tocar código. Las funciones de cálculo son puras.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LimitesPlan, NombrePlan, OrigenPlan, PeriodoPago, Suscripcion } from '@shared/types.js';

export interface ConfigPlanes {
  accesoAbierto: boolean;
  precios: { moneda: string; mensual: number; anual: number; pruebaDias: number };
  planes: Record<NombrePlan, LimitesPlan>;
}

const POR_DEFECTO: ConfigPlanes = {
  accesoAbierto: true,
  precios: { moneda: 'PEN', mensual: 19.9, anual: 179, pruebaDias: 7 },
  planes: {
    gratis: { prendasMax: 100, mensajesPorDia: 10, rehacerSemana: false, planSemanalAutomatico: false, mejorarFotoPorDia: 0, fotoCatalogoAutomatica: false, probadorPorMes: 3, comprasPorMes: 3 },
    premium: { prendasMax: null, mensajesPorDia: 60, rehacerSemana: true, planSemanalAutomatico: true, mejorarFotoPorDia: 30, fotoCatalogoAutomatica: true, probadorPorMes: null, comprasPorMes: null },
  },
};

let cache: ConfigPlanes | null = null;

export function leerPlanes(): ConfigPlanes {
  if (cache) return cache;
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  for (const c of [path.join(aqui, 'planes.json'), path.resolve(process.cwd(), 'server/src/config/planes.json')]) {
    if (!fs.existsSync(c)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(c, 'utf8')) as Partial<ConfigPlanes>;
      cache = {
        accesoAbierto: json.accesoAbierto ?? POR_DEFECTO.accesoAbierto,
        precios: { ...POR_DEFECTO.precios, ...(json.precios ?? {}) },
        planes: {
          gratis: { ...POR_DEFECTO.planes.gratis, ...(json.planes?.gratis ?? {}) },
          premium: { ...POR_DEFECTO.planes.premium, ...(json.planes?.premium ?? {}) },
        },
      };
      return cache;
    } catch (e) {
      console.warn('[sastra] planes.json inválido, se usan valores por defecto:', e);
    }
  }
  cache = POR_DEFECTO;
  return cache;
}

export function limitesDe(plan: NombrePlan, config = leerPlanes()): LimitesPlan {
  return config.planes[plan];
}

export function precioDe(periodo: PeriodoPago, config = leerPlanes()): number {
  return periodo === 'anual' ? config.precios.anual : config.precios.mensual;
}

export interface PlanEfectivo {
  plan: NombrePlan;
  origen: OrigenPlan;
}

/**
 * Plan con el que se atiende a la persona ahora mismo.
 * - Administradores y cortesías: Premium sin pagar.
 * - Suscripción en prueba o activa: Premium.
 * - Cancelada o pausada: Premium solo hasta `vigenteHasta` (lo ya pagado se respeta).
 * - Pendiente (no completó el pago) o sin suscripción: Gratis.
 */
export function planEfectivo(op: { admin: boolean; cortesia: boolean; suscripcion: Suscripcion | null; ahora?: Date }): PlanEfectivo {
  if (op.admin) return { plan: 'premium', origen: 'admin' };
  if (op.cortesia) return { plan: 'premium', origen: 'cortesia' };
  const s = op.suscripcion;
  if (s && s.plan === 'premium') {
    if (s.estado === 'prueba' || s.estado === 'activa') return { plan: 'premium', origen: 'suscripcion' };
    const ahora = (op.ahora ?? new Date()).getTime();
    if ((s.estado === 'cancelada' || s.estado === 'pausada') && s.vigenteHasta && Date.parse(s.vigenteHasta) > ahora) {
      return { plan: 'premium', origen: 'suscripcion' };
    }
  }
  return { plan: 'gratis', origen: 'gratis' };
}

/** ¿Ya alcanzó el límite? null = sin límite. */
export function alcanzoLimite(limite: number | null, usados: number): boolean {
  return limite !== null && usados >= limite;
}

/** Cuántos le quedan (null = sin límite). */
export function restantes(limite: number | null, usados: number): number | null {
  return limite === null ? null : Math.max(0, limite - usados);
}

/** Días de anticipación del aviso antes de un cobro: el fin de la prueba y la renovación anual. */
export const AVISO_COBRO_DIAS = { prueba: 2, anual: 7 } as const;

/**
 * Aviso antes de cobrar, para que nadie se lleve la sorpresa de un cobro automático. Puro (probado).
 * `fechaCobro` y `hoy` en YYYY-MM-DD de la zona del usuario. Las mensualidades no se avisan cada mes.
 */
export function avisoDeCobro(s: Suscripcion | null, hoy: string, fechaCobro: string | null, config = leerPlanes()): { titulo: string; cuerpo: string } | null {
  if (!s || s.plan !== 'premium' || !fechaCobro) return null;
  const dias = Math.round((Date.parse(`${fechaCobro}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86400000);
  const fecha = new Date(`${fechaCobro}T12:00:00Z`).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const periodo = s.periodo === 'anual' ? 'anual' : 'mensual';
  const monto = `S/ ${precioDe(periodo, config).toFixed(2)}`;
  if (s.estado === 'prueba' && dias === AVISO_COBRO_DIAS.prueba) {
    return {
      titulo: `Tu prueba de Premium termina el ${fecha}`,
      cuerpo: `Ese día se cobra el primer pago ${periodo} de ${monto}. Si no quieres seguir, cancélalo antes en Plan y no pagas nada.`,
    };
  }
  if (s.estado === 'activa' && s.periodo === 'anual' && dias === AVISO_COBRO_DIAS.anual) {
    return {
      titulo: `Tu Premium anual se renueva el ${fecha}`,
      cuerpo: `Ese día se cobran ${monto}. Si no quieres renovar, cancélalo antes en Plan; sigues con Premium hasta esa fecha.`,
    };
  }
  return null;
}
