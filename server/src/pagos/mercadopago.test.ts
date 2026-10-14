import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Suscripcion } from '@shared/types.js';
import { cuerpoSuscripcion, suscripcionDesdePreapproval, validarFirma, type Preapproval } from './mercadopago.js';

const secreto = 'clave-de-prueba';
function firmar(manifiesto: string) {
  return createHmac('sha256', secreto).update(manifiesto).digest('hex');
}

describe('validarFirma', () => {
  it('acepta una firma correcta', () => {
    const v1 = firmar('id:abc123;request-id:req-1;ts:1700000000;');
    expect(validarFirma({ xSignature: `ts=1700000000,v1=${v1}`, xRequestId: 'req-1', dataId: 'ABC123', secreto })).toBe(true);
  });

  it('rechaza una firma alterada, sin ts o sin secreto', () => {
    const v1 = firmar('id:abc123;request-id:req-1;ts:1700000000;');
    expect(validarFirma({ xSignature: `ts=1700000001,v1=${v1}`, xRequestId: 'req-1', dataId: 'abc123', secreto })).toBe(false);
    expect(validarFirma({ xSignature: `v1=${v1}`, xRequestId: 'req-1', dataId: 'abc123', secreto })).toBe(false);
    expect(validarFirma({ xSignature: `ts=1700000000,v1=${v1}`, xRequestId: 'req-1', dataId: 'abc123', secreto: '' })).toBe(false);
    expect(validarFirma({ xSignature: undefined, dataId: 'abc123', secreto })).toBe(false);
  });

  it('omite del manifiesto las partes que no llegan', () => {
    const v1 = firmar('id:999;ts:1700000000;');
    expect(validarFirma({ xSignature: `ts=1700000000, v1=${v1}`, dataId: '999', secreto })).toBe(true);
  });
});

describe('cuerpoSuscripcion', () => {
  it('mensual con prueba de 7 días en soles', () => {
    const c = cuerpoSuscripcion({ uid: 'u1', emailPagador: 'a@b.pe', periodo: 'mensual', conPrueba: true, appUrl: 'https://sastra.app' });
    expect(c.external_reference).toBe('u1');
    expect(c.back_url).toBe('https://sastra.app/plan');
    expect(c.auto_recurring).toMatchObject({ frequency: 1, frequency_type: 'months', transaction_amount: 19.9, currency_id: 'PEN', free_trial: { frequency: 7, frequency_type: 'days' } });
  });

  it('anual sin prueba si ya la usó', () => {
    const c = cuerpoSuscripcion({ uid: 'u1', emailPagador: 'a@b.pe', periodo: 'anual', conPrueba: false, appUrl: 'https://sastra.app' });
    expect(c.auto_recurring).toMatchObject({ frequency: 12, transaction_amount: 179 });
    expect('free_trial' in c.auto_recurring).toBe(false);
  });
});

describe('suscripcionDesdePreapproval', () => {
  const base: Preapproval = {
    id: 'pre-1',
    status: 'authorized',
    payer_email: 'a@b.pe',
    date_created: '2026-10-10T12:00:00Z',
    next_payment_date: '2026-10-17T12:00:00Z',
    auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 19.9, currency_id: 'PEN', free_trial: { frequency: 7, frequency_type: 'days' } },
  };
  const ahora = new Date('2026-10-12T12:00:00Z');

  it('autorizada dentro de la prueba = prueba; después = activa', () => {
    expect(suscripcionDesdePreapproval(base, null, ahora).estado).toBe('prueba');
    expect(suscripcionDesdePreapproval(base, null, new Date('2026-10-20T00:00:00Z')).estado).toBe('activa');
    const s = suscripcionDesdePreapproval(base, null, ahora);
    expect(s).toMatchObject({ plan: 'premium', periodo: 'mensual', mpPreapprovalId: 'pre-1', vigenteHasta: '2026-10-17T12:00:00Z', pruebaUsada: true });
  });

  it('pendiente no marca la prueba como usada', () => {
    const s = suscripcionDesdePreapproval({ ...base, status: 'pending' }, null, ahora);
    expect(s.estado).toBe('pendiente');
    expect(s.pruebaUsada).toBe(false);
  });

  it('cancelada conserva la fecha ya pagada', () => {
    const previa: Suscripcion = { plan: 'premium', estado: 'activa', proveedor: 'mercadopago', vigenteHasta: '2026-11-10T00:00:00Z', pruebaUsada: true, actualizadaEn: '' };
    const s = suscripcionDesdePreapproval({ ...base, status: 'cancelled', next_payment_date: undefined }, previa, ahora);
    expect(s.estado).toBe('cancelada');
    expect(s.vigenteHasta).toBe('2026-11-10T00:00:00Z');
  });

  it('frecuencia de 12 meses es anual', () => {
    expect(suscripcionDesdePreapproval({ ...base, auto_recurring: { ...base.auto_recurring, frequency: 12 } }, null, ahora).periodo).toBe('anual');
  });
});
