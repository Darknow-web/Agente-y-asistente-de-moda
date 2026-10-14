import { describe, expect, it } from 'vitest';
import { debeGenerarCatalogo } from './pulir.js';

describe('debeGenerarCatalogo', () => {
  const nueva = {};
  it('Premium: cada prenda nueva pasa a catálogo sola', () => {
    expect(debeGenerarCatalogo({ automatico: true, prenda: nueva })).toBe(true);
  });
  it('Gratis: solo si la foto vino arrugada (y el cupo, que es 0, decide después)', () => {
    expect(debeGenerarCatalogo({ automatico: false, prenda: nueva })).toBe(false);
    expect(debeGenerarCatalogo({ automatico: false, prenda: { fotoArrugada: true } })).toBe(true);
  });
  it('no repite: ya en catálogo, original elegido por la persona o IA infiel', () => {
    expect(debeGenerarCatalogo({ automatico: true, prenda: { fotoRetoque: 'catalogo' } })).toBe(false);
    expect(debeGenerarCatalogo({ automatico: true, prenda: { fotoRetoque: 'original' } })).toBe(false);
    expect(debeGenerarCatalogo({ automatico: true, prenda: { fotoCatalogoDescartada: true } })).toBe(false);
  });
  it('el botón siempre la pide', () => {
    expect(debeGenerarCatalogo({ automatico: false, forzar: true, prenda: { fotoRetoque: 'catalogo' } })).toBe(true);
  });
});
