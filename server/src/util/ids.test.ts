import { describe, expect, it } from 'vitest';
import { fechaLocal, lunesDe, nombreDia, nuevoId, sumarDias } from './ids.js';

describe('fechas', () => {
  it('calcula el lunes de la semana', () => {
    expect(lunesDe('2026-09-30')).toBe('2026-09-28'); // miércoles → lunes
    expect(lunesDe('2026-09-28')).toBe('2026-09-28'); // lunes → mismo
    expect(lunesDe('2026-10-04')).toBe('2026-09-28'); // domingo → lunes anterior
  });

  it('suma días sin problemas de fin de mes', () => {
    expect(sumarDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('nombra los días en español', () => {
    expect(nombreDia('2026-09-30')).toBe('miércoles');
    expect(nombreDia('2026-10-04')).toBe('domingo');
  });

  it('fecha local respeta la zona horaria', () => {
    // 2026-10-01 03:00 UTC es todavía 30 de septiembre en Lima (UTC-5)
    expect(fechaLocal(new Date('2026-10-01T03:00:00Z'), 'America/Lima')).toBe('2026-09-30');
  });

  it('genera ids únicos con prefijo', () => {
    const a = nuevoId('p');
    const b = nuevoId('p');
    expect(a).toMatch(/^p_[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(b);
  });
});
