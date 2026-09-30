/**
 * Control de calidad: revisa borradores importantes antes de enviarlos.
 * Encendido por defecto (decisión del cliente); qué revisa se define en config/limites.json.
 */
import type { NombreAgente } from '@shared/types.js';
import type { ContextoCliente } from '../../memory/contexto.js';
import { ejecutarAgente, extraerJson, mensajeUsuario } from '../base.js';
import { cargarConfigModelos } from '../../ai/router.js';
import { leerLimites } from '../../config/limites.js';

export type TipoRevision = 'plan-semanal' | 'plan-diario' | 'lista-compras' | 'veredicto-probador' | 'catalogacion' | 'chat';

export interface ResultadoCalidad {
  aprobado: boolean;
  texto: string;
  notas: string[];
  reviso: boolean;
  costoUsd: number;
}

export function calidadEncendida(): boolean {
  const cfg = cargarConfigModelos() as unknown as { agentes?: Record<string, { encendido?: boolean }> };
  return cfg.agentes?.calidad?.encendido !== false;
}

/** Decide si un borrador merece revisión según tipo, longitud y departamentos implicados. */
export function debeRevisar(tipo: TipoRevision, texto: string, departamentos: NombreAgente[] = []): boolean {
  if (!calidadEncendida()) return false;
  const lim = leerLimites().calidad;
  if (tipo !== 'chat') return lim.revisa.includes(tipo);
  const implicaImportante = departamentos.some((d) => ['planificacion', 'compras', 'probador', 'guardarropa'].includes(d));
  return implicaImportante || texto.length >= lim.minCaracteres;
}

const ESQUEMA = {
  type: 'object',
  properties: {
    aprobado: { type: 'boolean' },
    textoRevisado: { type: 'string' },
    notas: { type: 'array', items: { type: 'string' } },
  },
  required: ['aprobado', 'textoRevisado', 'notas'],
};

export async function revisarConCalidad(
  ctx: ContextoCliente,
  borrador: string,
  detalle: { tipo: TipoRevision; pregunta?: string; senal?: AbortSignal },
): Promise<ResultadoCalidad> {
  const encargo = [
    `Tipo de respuesta: ${detalle.tipo}.`,
    detalle.pregunta ? `Lo que pidió el cliente:\n${detalle.pregunta}\n` : '',
    'Borrador a revisar:',
    '"""',
    borrador,
    '"""',
  ].join('\n');
  try {
    const r = await ejecutarAgente({
      agente: 'calidad',
      ctx,
      mensajes: [mensajeUsuario(encargo)],
      esquemaJson: ESQUEMA,
      maxVueltas: 1,
      temperatura: 0.2,
      senal: detalle.senal,
    });
    const json = extraerJson<{ aprobado: boolean; textoRevisado: string; notas: string[] }>(r.texto);
    if (!json || typeof json.textoRevisado !== 'string' || !json.textoRevisado.trim()) {
      return { aprobado: true, texto: borrador, notas: ['Calidad no devolvió un JSON válido; se envió el borrador.'], reviso: false, costoUsd: r.costoUsd };
    }
    return { aprobado: !!json.aprobado, texto: json.textoRevisado, notas: json.notas ?? [], reviso: true, costoUsd: r.costoUsd };
  } catch (e) {
    console.warn('[calidad] falló la revisión, se envía el borrador:', e instanceof Error ? e.message : e);
    return { aprobado: true, texto: borrador, notas: [], reviso: false, costoUsd: 0 };
  }
}
