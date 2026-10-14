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
    gratis: { prendasMax: 30, mensajesPorDia: 10, rehacerSemana: false, planSemanalAutomatico: false, mejorarFotoPorDia: 0, fotoCatalogoAutomatica: false, probadorPorMes: 3, comprasPorMes: 3 },
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
