import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Limites {
  mensajesPorUsuarioPorDia: number;
  imagenLadoMaxPx: number;
  imagenMaxMB: number;
  videoMaxSegundos: number;
  videoMaxMB: number;
  mensajesEnContexto: number;
  resumirCadaMensajes: number;
  /** Tiempo máximo por llamada a un motor de IA (después se reintenta o se cae a otro). */
  segundosMaxPorLlamadaIA: number;
  /** Tiempo máximo total de una respuesta del chat antes de avisar al cliente. */
  segundosMaxPorRespuesta: number;
  calidad: { revisa: string[]; minCaracteres: number };
  busquedaWebMaxPorDia: number;
  /** Alisados de foto con IA generativa por usuario y día. El recorte de fondo no cuenta. */
  retoquesPorUsuarioPorDia: number;
  alertaPresupuestoUsd: number;
}

const POR_DEFECTO: Limites = {
  mensajesPorUsuarioPorDia: 60,
  imagenLadoMaxPx: 1024,
  imagenMaxMB: 4,
  videoMaxSegundos: 60,
  videoMaxMB: 20,
  mensajesEnContexto: 12,
  resumirCadaMensajes: 16,
  segundosMaxPorLlamadaIA: 75,
  segundosMaxPorRespuesta: 170,
  calidad: { revisa: ['plan-semanal', 'plan-diario', 'lista-compras', 'veredicto-probador', 'catalogacion'], minCaracteres: 400 },
  busquedaWebMaxPorDia: 40,
  retoquesPorUsuarioPorDia: 10,
  alertaPresupuestoUsd: 10,
};

let cache: Limites | null = null;

export function leerLimites(): Limites {
  if (cache) return cache;
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const candidatos = [path.join(aqui, 'limites.json'), path.resolve(process.cwd(), 'server/src/config/limites.json')];
  for (const c of candidatos) {
    if (fs.existsSync(c)) {
      try {
        const json = JSON.parse(fs.readFileSync(c, 'utf8')) as Partial<Limites>;
        cache = { ...POR_DEFECTO, ...json, calidad: { ...POR_DEFECTO.calidad, ...(json.calidad ?? {}) } };
        return cache;
      } catch (e) {
        console.warn('[sastra] limites.json inválido, se usan valores por defecto:', e);
      }
    }
  }
  cache = POR_DEFECTO;
  return cache;
}
