import { describe, expect, it } from 'vitest';
import type { Suscripcion } from '@shared/types.js';
import { alcanzoLimite, leerPlanes, limitesDe, planEfectivo, precioDe, restantes } from './planes.js';

const sus = (s: Partial<Suscripcion>): Suscripcion => ({ plan: 'premium', estado: 'activa', proveedor: 'mercadopago', actualizadaEn: '2026-10-01T00:00:00Z', ...s });
const ahora = new Date('2026-10-14T12:00:00Z');

describe('planEfectivo', () => {
  it('admin y cortesía son Premium sin pagar', () => {
    expect(planEfectivo({ admin: true, cortesia: false, suscripcion: null })).toEqual({ plan: 'premium', origen: 'admin' });
    expect(planEfectivo({ admin: false, cortesia: true, suscripcion: null })).toEqual({ plan: 'premium', origen: 'cortesia' });
  });

  it('sin suscripción es Gratis', () => {
    expect(planEfectivo({ admin: false, cortesia: false, suscripcion: null }).plan).toBe('gratis');
  });

  it('prueba y activa son Premium; pendiente es Gratis', () => {
    expect(planEfectivo({ admin: false, cortesia: false, suscripcion: sus({ estado: 'prueba' }) }).plan).toBe('premium');
    expect(planEfectivo({ admin: false, cortesia: false, suscripcion: sus({ estado: 'activa' }) }).plan).toBe('premium');
    expect(planEfectivo({ admin: false, cortesia: false, suscripcion: sus({ estado: 'pendiente' }) }).plan).toBe('gratis');
  });

  it('cancelada sigue Premium hasta vigenteHasta y luego vuelve a Gratis', () => {
    const vigente = sus({ estado: 'cancelada', vigenteHasta: '2026-10-20T00:00:00Z' });
    const vencida = sus({ estado: 'cancelada', vigenteHasta: '2026-10-10T00:00:00Z' });
    expect(planEfectivo({ admin: false, cortesia: false, suscripcion: vigente, ahora }).plan).toBe('premium');
    expect(planEfectivo({ admin: false, cortesia: false, suscripcion: vencida, ahora }).plan).toBe('gratis');
    expect(planEfectivo({ admin: false, cortesia: false, suscripcion: sus({ estado: 'cancelada' }), ahora }).plan).toBe('gratis');
  });
});

describe('límites', () => {
  it('Gratis tiene topes y Premium no limita prendas', () => {
    expect(limitesDe('gratis').prendasMax).toBe(30);
    expect(limitesDe('gratis').mejorarFotoPorDia).toBe(0);
    expect(limitesDe('premium').prendasMax).toBeNull();
    expect(limitesDe('premium').mensajesPorDia).toBeGreaterThan(limitesDe('gratis').mensajesPorDia);
  });

  it('alcanzoLimite y restantes respetan null como sin límite', () => {
    expect(alcanzoLimite(null, 999)).toBe(false);
    expect(alcanzoLimite(3, 3)).toBe(true);
    expect(alcanzoLimite(3, 2)).toBe(false);
    expect(restantes(null, 5)).toBeNull();
    expect(restantes(10, 12)).toBe(0);
  });

  it('precios en soles desde planes.json', () => {
    expect(leerPlanes().precios.moneda).toBe('PEN');
    expect(precioDe('mensual')).toBe(19.9);
    expect(precioDe('anual')).toBe(179);
  });
});
