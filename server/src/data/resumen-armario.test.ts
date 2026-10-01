import { describe, expect, it } from 'vitest';
import type { Prenda } from '@shared/types.js';
import { calcularResumenArmario } from './resumen-armario.js';

const DIA = 86400000;
const AHORA = Date.parse('2026-10-01T12:00:00.000Z');
const hace = (dias: number) => new Date(AHORA - dias * DIA).toISOString();

function prenda(id: string, extra: Partial<Prenda> = {}): Prenda {
  return { id, nombre: id, categoria: 'superior', colores: [], estado: 'limpia', usosDesdeLavado: 0, usosMaxAntesDeLavar: 3, creadaEn: hace(10), actualizadaEn: hace(10), ...extra };
}

describe('resumen del armario', () => {
  it('separa sin estrenar, dormidas y usadas, y suma el valor sin uso', () => {
    const prendas = [
      prenda('nueva', { creadaEn: hace(5), precio: 120 }),
      prenda('olvidada', { creadaEn: hace(200), precio: 80 }),
      prenda('usada-hace-mucho', { creadaEn: hace(300), ultimoUso: hace(90), usosTotales: 2, precio: 50 }),
      prenda('activa', { creadaEn: hace(300), ultimoUso: hace(3), usosTotales: 9 }),
      prenda('guardada', { creadaEn: hace(400), estado: 'guardada' }),
    ];
    const r = calcularResumenArmario(prendas, new Map(), 'PEN', AHORA);
    expect(r.totalPrendas).toBe(5);
    expect(r.sinEstrenar.map((p) => p.id)).toEqual(['nueva']);
    expect(r.dormidas.map((p) => p.id)).toEqual(['olvidada', 'usada-hace-mucho']);
    expect(r.usadasUltimos30).toBe(1);
    expect(r.valorSinUso).toBe(250);
  });

  it('usa el historial de usos cuando la prenda no guarda ultimoUso', () => {
    const prendas = [prenda('vieja', { creadaEn: hace(200) })];
    const r = calcularResumenArmario(prendas, new Map([['vieja', hace(2)]]), 'PEN', AHORA);
    expect(r.dormidas).toHaveLength(0);
    expect(r.usadasUltimos30).toBe(1);
  });

  it('una prenda nueva sin uso que ya pasó de 60 días cuenta como dormida, no como sin estrenar', () => {
    const r = calcularResumenArmario([prenda('p', { creadaEn: hace(61) })], new Map(), 'PEN', AHORA);
    expect(r.sinEstrenar).toHaveLength(0);
    expect(r.dormidas.map((p) => p.dias)).toEqual([61]);
  });
});
