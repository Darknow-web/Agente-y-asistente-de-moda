/**
 * Mercado Pago · Suscripciones (preapproval). Módulo propio con fetch, sin SDK.
 *
 * Flujo:
 *  1. `crearSuscripcion` devuelve el `init_point`: la página de Mercado Pago donde la persona autoriza el cobro
 *     (tarjeta o Yape). `external_reference` = uid de Firebase, para saber de quién es al volver.
 *  2. Mercado Pago avisa por webhook (temas subscription_preapproval y subscription_authorized_payment).
 *     El servidor valida la firma, vuelve a leer el recurso en la API (nunca confía en el cuerpo) y guarda
 *     el estado con `suscripcionDesdePreapproval`.
 *
 * Variables (solo servidor): MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, APP_URL.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { EstadoSuscripcion, PeriodoPago, Suscripcion } from '@shared/types.js';
import { env } from '../util/env.js';
import { leerPlanes, precioDe } from '../config/planes.js';

const API = 'https://api.mercadopago.com';

export class ErrorPago extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ErrorPago';
  }
}

export interface Preapproval {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled' | string;
  external_reference?: string;
  payer_email?: string;
  init_point?: string;
  date_created?: string;
  next_payment_date?: string;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: 'days' | 'months' | string;
    transaction_amount?: number;
    currency_id?: string;
    free_trial?: { frequency?: number; frequency_type?: string } | null;
  };
}

export function pagosConfigurados(): boolean {
  return !!env('MP_ACCESS_TOKEN');
}

/** URL pública de la app (para volver de Mercado Pago). Sin barra final. */
export function urlApp(): string {
  return env('APP_URL').replace(/\/+$/, '');
}

async function llamar<T>(metodo: 'GET' | 'POST' | 'PUT', ruta: string, cuerpo?: unknown): Promise<T> {
  const token = env('MP_ACCESS_TOKEN');
  if (!token) throw new ErrorPago('Los pagos aún no están configurados.');
  const res = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(20_000),
  });
  const texto = await res.text();
  const json = texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
  if (!res.ok) {
    const detalle = typeof json.message === 'string' ? json.message : texto.slice(0, 200);
    throw new ErrorPago(`Mercado Pago respondió ${res.status}: ${detalle}`, res.status);
  }
  return json as T;
}

/** Cuerpo de la suscripción. Puro (probado): monto, frecuencia y prueba gratis según planes.json. */
export function cuerpoSuscripcion(op: { uid: string; emailPagador: string; periodo: PeriodoPago; conPrueba: boolean; appUrl: string }) {
  const { precios } = leerPlanes();
  return {
    reason: op.periodo === 'anual' ? 'SASTRA Premium · anual' : 'SASTRA Premium · mensual',
    external_reference: op.uid,
    payer_email: op.emailPagador,
    back_url: `${op.appUrl}/plan`,
    status: 'pending',
    auto_recurring: {
      frequency: op.periodo === 'anual' ? 12 : 1,
      frequency_type: 'months',
      transaction_amount: precioDe(op.periodo),
      currency_id: precios.moneda,
      ...(op.conPrueba && precios.pruebaDias > 0 ? { free_trial: { frequency: precios.pruebaDias, frequency_type: 'days' } } : {}),
    },
  };
}

export async function crearSuscripcion(op: { uid: string; emailPagador: string; periodo: PeriodoPago; conPrueba: boolean }): Promise<Preapproval> {
  const appUrl = urlApp();
  if (!appUrl) throw new ErrorPago('Falta APP_URL (la dirección pública de la app) para volver de Mercado Pago.');
  return llamar<Preapproval>('POST', '/preapproval', cuerpoSuscripcion({ ...op, appUrl }));
}

export function leerPreapproval(id: string): Promise<Preapproval> {
  return llamar<Preapproval>('GET', `/preapproval/${encodeURIComponent(id)}`);
}

export function cancelarPreapproval(id: string): Promise<Preapproval> {
  return llamar<Preapproval>('PUT', `/preapproval/${encodeURIComponent(id)}`, { status: 'cancelled' });
}

/** Un cobro recurrente (tema subscription_authorized_payment) apunta a su suscripción. */
export async function preapprovalDePago(idPago: string): Promise<string | null> {
  const r = await llamar<{ preapproval_id?: string }>('GET', `/authorized_payments/${encodeURIComponent(idPago)}`);
  return r.preapproval_id ?? null;
}

// ------------------------------------------------------------------ webhook

/**
 * Valida la cabecera x-signature de Mercado Pago (`ts=...,v1=...`).
 * Manifiesto: `id:{data.id};request-id:{x-request-id};ts:{ts};` (se omite cada parte que no venga),
 * HMAC-SHA256 en hexadecimal con la clave secreta del webhook. data.id alfanumérico va en minúsculas.
 */
export function validarFirma(op: { xSignature?: string; xRequestId?: string; dataId?: string; secreto: string }): boolean {
  if (!op.secreto || !op.xSignature) return false;
  const partes = Object.fromEntries(
    op.xSignature.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=');
      return [k?.trim() ?? '', v.join('=').trim()];
    }),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;
  const id = op.dataId && /^[a-z0-9]+$/i.test(op.dataId) ? op.dataId.toLowerCase() : op.dataId;
  const manifiesto = `${id ? `id:${id};` : ''}${op.xRequestId ? `request-id:${op.xRequestId};` : ''}ts:${ts};`;
  const esperado = createHmac('sha256', op.secreto).update(manifiesto).digest('hex');
  const a = Buffer.from(esperado);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Traduce una preapproval de Mercado Pago a nuestra Suscripcion. Puro (probado). */
export function suscripcionDesdePreapproval(p: Preapproval, previa: Suscripcion | null, ahora = new Date()): Suscripcion {
  const conPrueba = !!p.auto_recurring?.free_trial;
  const periodo: PeriodoPago = (p.auto_recurring?.frequency ?? 1) >= 12 ? 'anual' : 'mensual';
  let estado: EstadoSuscripcion;
  switch (p.status) {
    case 'authorized': {
      const dias = p.auto_recurring?.free_trial?.frequency ?? 0;
      const finPrueba = p.date_created ? Date.parse(p.date_created) + dias * 86_400_000 : 0;
      estado = conPrueba && finPrueba > ahora.getTime() ? 'prueba' : 'activa';
      break;
    }
    case 'paused':
      estado = 'pausada';
      break;
    case 'cancelled':
      estado = 'cancelada';
      break;
    default:
      estado = 'pendiente';
  }
  // Tras cancelar, Mercado Pago ya no informa próxima fecha: se conserva la que había (lo ya pagado).
  const vigenteHasta = estado === 'cancelada' || estado === 'pausada' ? (previa?.vigenteHasta ?? p.next_payment_date) : p.next_payment_date ?? previa?.vigenteHasta;
  const yaAutorizo = p.status === 'authorized' || p.status === 'paused' || p.status === 'cancelled';
  return {
    plan: 'premium',
    estado,
    periodo,
    proveedor: 'mercadopago',
    mpPreapprovalId: p.id,
    ...(vigenteHasta ? { vigenteHasta } : {}),
    pruebaUsada: !!previa?.pruebaUsada || (conPrueba && yaAutorizo),
    ...(p.payer_email || previa?.emailPagador ? { emailPagador: p.payer_email ?? previa?.emailPagador } : {}),
    actualizadaEn: ahora.toISOString(),
  };
}
