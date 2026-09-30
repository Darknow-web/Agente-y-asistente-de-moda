/**
 * Departamentos especializados a los que delega la Dirección Creativa.
 * Cada uno: prompt.md + conocimiento.md (en su carpeta) + herramientas + variante de modelo.
 */
import type { NombreAgente } from '@shared/types.js';
import type { Parte } from '../ai/provider.js';
import type { ContextoCliente } from '../memory/contexto.js';
import { ejecutarAgente, mensajeUsuario, type ResultadoAgente } from './base.js';
import { ejecutorArmario, herramientas, type NombreHerramienta } from '../tools/armario.js';
import { buscarEnInternet } from '../tools/busqueda.js';

export const DEPARTAMENTOS_DELEGABLES = ['guardarropa', 'estilismo', 'planificacion', 'cuidado', 'compras', 'probador'] as const satisfies readonly NombreAgente[];
export type Departamento = (typeof DEPARTAMENTOS_DELEGABLES)[number];

const HERRAMIENTAS_POR_DEPARTAMENTO: Record<Departamento, NombreHerramienta[]> = {
  guardarropa: ['listar_prendas', 'crear_prenda', 'editar_prenda', 'registrar_uso', 'marcar_lavada', 'guardar_deseo'],
  estilismo: ['listar_prendas', 'actualizar_perfil'],
  planificacion: ['listar_prendas', 'clima', 'actualizar_perfil'],
  cuidado: ['listar_prendas', 'registrar_uso', 'marcar_lavada', 'editar_prenda'],
  compras: ['listar_prendas', 'guardar_deseo', 'actualizar_perfil'],
  probador: ['listar_prendas', 'guardar_deseo'],
};

export interface OpcionesDepartamento {
  ctx: ContextoCliente;
  encargo: string;
  adjuntos?: Parte[];
  historialResumen?: string;
  senal?: AbortSignal;
}

export async function correrDepartamento(dep: Departamento, op: OpcionesDepartamento): Promise<ResultadoAgente> {
  const ejecutarBase = ejecutorArmario(op.ctx);
  const hs = herramientas(...HERRAMIENTAS_POR_DEPARTAMENTO[dep]);

  // Compras: además, herramienta de búsqueda en internet (se resuelve con una llamada aparte con grounding)
  if (dep === 'compras') {
    hs.push({
      nombre: 'buscar_en_internet',
      descripcion:
        'Busca en internet precios, tiendas y disponibilidad de una prenda cerca de la ciudad del cliente. Devuelve un resumen con fuentes. Úsala para dar precios y lugares reales, nunca inventados.',
      parametros: {
        type: 'object',
        properties: { consulta: { type: 'string', description: 'Qué buscar, con ciudad y país, ej. "blazer azul marino mujer precio Lima Perú"' } },
        required: ['consulta'],
      },
    });
  }

  const ejecutar = async (nombre: string, a: Record<string, unknown>) => {
    if (nombre === 'buscar_en_internet') return buscarEnInternet(op.ctx, String(a.consulta ?? ''));
    return ejecutarBase(nombre, a);
  };

  const encargo = [
    op.historialResumen ? `Conversación reciente:\n${op.historialResumen}\n` : '',
    `Encargo de la Dirección Creativa:\n${op.encargo}`,
    '',
    'Responde con el contenido listo para que la Dirección lo transmita al cliente: concreto, en español, sin saludos ni despedidas, nombrando las prendas exactamente como figuran en el armario (con su id entre paréntesis cuando propongas looks o cambios).',
  ].join('\n');

  return ejecutarAgente({
    agente: dep,
    ctx: op.ctx,
    mensajes: [mensajeUsuario(encargo, op.adjuntos ?? [])],
    herramientas: hs,
    ejecutar,
    maxVueltas: 5,
    senal: op.senal,
  });
}
