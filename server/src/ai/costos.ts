/**
 * ESTIMACIÓN DE COSTO — precios de referencia en USD por millón de tokens.
 *
 * Son aproximados y sirven para el panel de uso y las alertas de presupuesto
 * (limites.json → alertaPresupuestoUsd). Si un proveedor cambia precios, se edita aquí.
 */

import type { Proveedor } from './provider.js';

export interface PrecioModelo {
  /** USD por 1M de tokens de entrada */
  entrada: number;
  /** USD por 1M de tokens de salida */
  salida: number;
}

/** Tabla exportada para que la documentación y el panel de salud la puedan mostrar. */
export const TABLA_PRECIOS: Record<string, PrecioModelo> = {
  // Gemini (Google AI Studio)
  'gemini-2.5-flash-lite': { entrada: 0.1, salida: 0.4 },
  'gemini-2.5-flash': { entrada: 0.3, salida: 2.5 },
  'gemini-2.5-pro': { entrada: 1.25, salida: 10.0 },
  // Claude (Anthropic)
  'claude-haiku-4-5': { entrada: 1.0, salida: 5.0 },
  'claude-sonnet-5-5': { entrada: 2.0, salida: 10.0 },
  'claude-opus-5-5': { entrada: 4.0, salida: 20.0 },
};

/**
 * Devuelve el precio de un modelo. Si no está en la tabla exacta, deduce por familia
 * (Gemini: 'flash-lite' → lite, 'flash' → flash, 'pro' → pro; Claude: haiku/sonnet/opus).
 * Si no puede deducirlo, devuelve `undefined`.
 */
export function precioDeModelo(proveedor: Proveedor, modelo: string): PrecioModelo | undefined {
  const exacto = TABLA_PRECIOS[modelo];
  if (exacto) return exacto;

  const m = modelo.toLowerCase();
  if (proveedor === 'gemini' || m.startsWith('gemini')) {
    // Modelos sin fila propia (p. ej. la familia 3.x) se aproximan por nivel con los precios de 2.5.
    if (m.includes('flash-lite')) return TABLA_PRECIOS['gemini-2.5-flash-lite'];
    if (m.includes('flash')) return TABLA_PRECIOS['gemini-2.5-flash'];
    if (m.includes('pro')) return TABLA_PRECIOS['gemini-2.5-pro'];
  }
  if (proveedor === 'claude' || m.startsWith('claude')) {
    if (m.includes('haiku')) return TABLA_PRECIOS['claude-haiku-4-5'];
    if (m.includes('sonnet')) return TABLA_PRECIOS['claude-sonnet-5-5'];
    if (m.includes('opus')) return TABLA_PRECIOS['claude-opus-5-5'];
  }
  return undefined;
}

/**
 * Costo estimado en USD de una llamada. Para modelos desconocidos (o el proveedor simulado)
 * devuelve 0 y deja un aviso en consola con el nombre del modelo, para que se agregue a la tabla.
 */
export function estimarCostoUsd(
  proveedor: Proveedor,
  modelo: string,
  tokensEntrada: number,
  tokensSalida: number,
): number {
  if (proveedor === 'simulado') return 0;
  const precio = precioDeModelo(proveedor, modelo);
  if (!precio) {
    if (!modelosSinPrecioAvisados.has(modelo)) {
      modelosSinPrecioAvisados.add(modelo);
      console.warn(`[costos] Modelo sin precio en la tabla: "${modelo}" (${proveedor}). Se cuenta como 0 USD.`);
    }
    return 0;
  }
  const costo = (tokensEntrada / 1_000_000) * precio.entrada + (tokensSalida / 1_000_000) * precio.salida;
  // Redondeamos a 8 decimales para evitar ruido de coma flotante en los registros.
  return Math.round(costo * 1e8) / 1e8;
}

const modelosSinPrecioAvisados = new Set<string>();
