/**
 * Dirección Creativa: orquestador. Recibe el mensaje del cliente, delega a los
 * departamentos con `delegar_a` y consolida una sola respuesta.
 */
import type { NombreAgente } from '@shared/types.js';
import type { Herramienta, MensajeModelo, Parte } from '../../ai/provider.js';
import type { ContextoCliente } from '../../memory/contexto.js';
import { ejecutarAgente, type ResultadoAgente } from '../base.js';
import { ejecutorArmario, herramientas } from '../../tools/armario.js';
import { correrDepartamento, DEPARTAMENTOS_DELEGABLES, type Departamento } from '../departamentos.js';

const delegarA: Herramienta = {
  nombre: 'delegar_a',
  descripcion:
    'Encarga una tarea a un departamento especializado y devuelve su respuesta. Incluye en el encargo todo lo que el departamento necesita saber del mensaje del cliente.',
  parametros: {
    type: 'object',
    properties: {
      departamento: { type: 'string', enum: DEPARTAMENTOS_DELEGABLES },
      encargo: { type: 'string', description: 'Qué necesita el cliente, con detalles, y qué formato de respuesta esperas.' },
      incluirAdjuntos: {
        type: 'boolean',
        description: 'true si el departamento necesita ver la foto o video que envió el cliente en este mensaje.',
      },
    },
    required: ['departamento', 'encargo'],
  },
};

export interface OpcionesDirector {
  ctx: ContextoCliente;
  historial: MensajeModelo[]; // ya incluye el último mensaje del usuario (con adjuntos)
  adjuntosActuales: Parte[]; // imagen/video del último mensaje, para pasar a departamentos
  onDepartamento?: (agente: NombreAgente, estado: 'trabajando' | 'listo') => void;
  /** Texto del Director en vivo (solo del Director; los departamentos no se transmiten). */
  onTexto?: (delta: string) => void;
  /** El Director empieza otra vuelta: lo transmitido hasta ahora era provisional. */
  onNuevaVuelta?: () => void;
  senal?: AbortSignal;
}

export interface ResultadoDirector extends ResultadoAgente {
  departamentos: NombreAgente[];
  fuentesDepartamentos: { titulo: string; url: string }[];
}

export async function correrDirector(op: OpcionesDirector): Promise<ResultadoDirector> {
  const departamentos: NombreAgente[] = [];
  const fuentesDep: { titulo: string; url: string }[] = [];
  const ejecutarBase = ejecutorArmario(op.ctx);

  const ejecutar = async (nombre: string, a: Record<string, unknown>) => {
    if (nombre !== 'delegar_a') return ejecutarBase(nombre, a);
    const dep = String(a.departamento) as Departamento;
    if (!(DEPARTAMENTOS_DELEGABLES as readonly string[]).includes(dep)) return { error: `Departamento desconocido: ${dep}` };
    departamentos.push(dep);
    op.onDepartamento?.(dep, 'trabajando');
    try {
      const r = await correrDepartamento(dep, {
        ctx: op.ctx,
        encargo: String(a.encargo ?? ''),
        adjuntos: a.incluirAdjuntos ? op.adjuntosActuales : [],
        historialResumen: resumenHistorial(op.historial),
        senal: op.senal,
      });
      fuentesDep.push(...r.fuentes);
      return { respuesta: r.texto, fuentes: r.fuentes.slice(0, 8) };
    } finally {
      op.onDepartamento?.(dep, 'listo');
    }
  };

  const r = await ejecutarAgente({
    agente: 'director',
    ctx: op.ctx,
    mensajes: op.historial,
    herramientas: [delegarA, ...herramientas('actualizar_perfil', 'listar_prendas', 'registrar_uso', 'marcar_lavada', 'registrar_ajuste')],
    ejecutar,
    maxVueltas: 6,
    onTexto: op.onTexto,
    onNuevaVuelta: op.onNuevaVuelta,
    senal: op.senal,
  });

  return { ...r, departamentos: [...new Set(departamentos)], fuentesDepartamentos: fuentesDep };
}

/** Resumen textual de los últimos turnos para dar contexto a un departamento. */
function resumenHistorial(historial: MensajeModelo[], max = 6): string {
  return historial
    .slice(-max)
    .map((m) => {
      const texto = m.partes
        .filter((p): p is Extract<Parte, { tipo: 'texto' }> => p.tipo === 'texto')
        .map((p) => p.texto)
        .join(' ')
        .slice(0, 600);
      const adj = m.partes.some((p) => p.tipo === 'imagen' || p.tipo === 'video') ? ' [envió foto/video]' : '';
      return `${m.rol === 'usuario' ? 'Cliente' : 'Sastra'}: ${texto}${adj}`;
    })
    .join('\n');
}
