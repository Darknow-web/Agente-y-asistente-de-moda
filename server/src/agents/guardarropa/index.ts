/**
 * Guardarropa: catalogación de una prenda a partir de una foto (salida JSON estructurada).
 */
import type { Adjunto, CategoriaPrenda, Prenda, Temporada } from '@shared/types.js';
import type { Parte } from '../../ai/provider.js';
import type { ContextoCliente } from '../../memory/contexto.js';
import { ejecutarAgente, extraerJson, mensajeUsuario } from '../base.js';

export interface PropuestaPrenda {
  propuesta: Omit<Prenda, 'id' | 'creadaEn' | 'actualizadaEn' | 'usosDesdeLavado' | 'estado'>;
  preguntas: string[];
  costoUsd: number;
}

const ESQUEMA = {
  type: 'object',
  properties: {
    nombre: { type: 'string' },
    categoria: { type: 'string', enum: ['superior', 'inferior', 'vestido', 'abrigo', 'calzado', 'accesorio', 'ropa-interior', 'deporte', 'otro'] },
    subtipo: { type: 'string' },
    colores: { type: 'array', items: { type: 'string' } },
    tela: { type: 'string' },
    marca: { type: 'string' },
    temporada: { type: 'string', enum: ['verano', 'invierno', 'entretiempo', 'todo-el-ano'] },
    ocasiones: { type: 'array', items: { type: 'string' } },
    usosMaxAntesDeLavar: { type: 'integer' },
    notas: { type: 'string' },
    posibleDuplicadoDe: { type: 'string', description: 'id de una prenda del armario muy parecida, o cadena vacía' },
    preguntas: { type: 'array', items: { type: 'string' } },
  },
  required: ['nombre', 'categoria', 'colores', 'usosMaxAntesDeLavar', 'preguntas'],
};

export function adjuntoAParte(a: Adjunto): Parte | null {
  if (!a.datos) return null;
  if (a.tipo === 'imagen') return { tipo: 'imagen', mime: a.mime, base64: a.datos };
  if (a.tipo === 'video') return { tipo: 'video', mime: a.mime, base64: a.datos };
  return null;
}

export async function catalogarFoto(ctx: ContextoCliente, foto: Adjunto, pista?: string): Promise<PropuestaPrenda> {
  const parte = adjuntoAParte(foto);
  if (!parte) throw new Error('La foto no trae datos.');
  const encargo = [
    'Cataloga la prenda de la foto para el armario del cliente.',
    pista ? `El cliente dice: "${pista}".` : '',
    'Devuelve solo el JSON con el esquema indicado. Si algo no se ve (tela, marca, talla), pon tu mejor estimación y añade la pregunta concreta en "preguntas" (máximo 3).',
    'Compara con el armario del contexto y, si hay una prenda casi igual, indica su id en "posibleDuplicadoDe".',
  ]
    .filter(Boolean)
    .join('\n');
  const r = await ejecutarAgente({
    agente: 'guardarropa',
    ctx,
    mensajes: [mensajeUsuario(encargo, [parte])],
    esquemaJson: ESQUEMA,
    maxVueltas: 1,
    temperatura: 0.3,
  });
  const json = extraerJson<Record<string, unknown>>(r.texto);
  if (!json) throw new Error('No pudimos interpretar la foto. Prueba con otra más iluminada o describe la prenda.');
  const preguntas = Array.isArray(json.preguntas) ? (json.preguntas as string[]).slice(0, 3) : [];
  const dup = typeof json.posibleDuplicadoDe === 'string' && json.posibleDuplicadoDe.trim();
  if (dup) {
    const parecida = ctx.prendas.find((p) => p.id === dup);
    if (parecida) preguntas.unshift(`Se parece a "${parecida.nombre}" que ya está en tu armario. ¿Es la misma prenda?`);
  }
  return {
    propuesta: {
      nombre: String(json.nombre ?? 'Prenda'),
      categoria: (json.categoria as CategoriaPrenda) ?? 'otro',
      subtipo: json.subtipo ? String(json.subtipo) : undefined,
      colores: Array.isArray(json.colores) ? (json.colores as string[]).slice(0, 3) : [],
      tela: json.tela ? String(json.tela) : undefined,
      marca: json.marca ? String(json.marca) : undefined,
      temporada: (json.temporada as Temporada) ?? 'todo-el-ano',
      ocasiones: Array.isArray(json.ocasiones) ? (json.ocasiones as string[]) : [],
      usosMaxAntesDeLavar: Math.max(1, Number(json.usosMaxAntesDeLavar ?? 3)),
      notas: json.notas ? String(json.notas) : undefined,
    },
    preguntas,
    costoUsd: r.costoUsd,
  };
}
