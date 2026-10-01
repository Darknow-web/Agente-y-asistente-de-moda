/**
 * Qué se usa y qué duerme: base de "ropa dormida", "estreno pendiente" y "valor sin uso".
 * Función pura (sin Firestore) para poder probarla; la ruta le pasa las prendas y el último uso de cada una.
 */
import type { Prenda } from '@shared/types.js';
import type { PrendaDormida, RespResumenArmario } from '@shared/api.js';
import { diasDesde } from '../memory/contexto.js';

export const DIAS_DORMIDA = 60;
export const DIAS_ESTRENO_PENDIENTE = 30;

/** Días sin uso de una prenda (desde el último uso o, si nunca se usó, desde que entró). */
export function diasSinUso(p: Prenda, ultimoUso?: string, ahora = Date.now()): number {
  return diasDesde(ultimoUso ?? p.ultimoUso ?? p.creadaEn, ahora) ?? 0;
}

export function calcularResumenArmario(prendas: Prenda[], ultimos: Map<string, string>, moneda = 'PEN', ahora = Date.now()): RespResumenArmario {
  const compacta = (p: Prenda, dias: number): PrendaDormida => ({ id: p.id, nombre: p.nombre, dias, precio: p.precio, fotoUrl: p.fotoMiniUrl ?? p.fotoUrl });
  const dormidas: PrendaDormida[] = [];
  const sinEstrenar: PrendaDormida[] = [];
  let usadas30 = 0;
  for (const p of prendas) {
    if (p.estado === 'guardada') continue;
    const ultimo = ultimos.get(p.id) ?? p.ultimoUso;
    const usada = Boolean(ultimo) || (p.usosTotales ?? 0) > 0;
    const dias = diasSinUso(p, ultimo, ahora);
    if (ultimo && dias <= 30) usadas30++;
    const enArmario = diasDesde(p.creadaEn, ahora) ?? 0;
    if (!usada && enArmario < DIAS_DORMIDA) sinEstrenar.push(compacta(p, enArmario));
    else if (dias >= DIAS_DORMIDA) dormidas.push(compacta(p, dias));
  }
  dormidas.sort((a, b) => b.dias - a.dias);
  sinEstrenar.sort((a, b) => b.dias - a.dias);
  const valorSinUso = [...dormidas, ...sinEstrenar].reduce((s, p) => s + (p.precio ?? 0), 0);
  return { totalPrendas: prendas.length, usadasUltimos30: usadas30, dormidas, sinEstrenar, valorSinUso: Math.round(valorSinUso), moneda };
}
