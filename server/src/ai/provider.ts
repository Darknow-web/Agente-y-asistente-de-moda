/**
 * MOTOR INTERCAMBIABLE — contrato único que cumplen todos los proveedores de IA.
 *
 * Los agentes nunca hablan con Gemini ni con Claude directamente: hablan con esta interfaz.
 * Cambiar el motor de un agente es cambiar una línea en server/src/config/modelos.json.
 */

export type Proveedor = 'gemini' | 'claude' | 'simulado';

export interface ParteTexto {
  tipo: 'texto';
  texto: string;
}
export interface ParteImagen {
  tipo: 'imagen';
  mime: string; // image/jpeg, image/png, image/webp
  base64: string;
}
export interface ParteVideo {
  tipo: 'video';
  mime: string; // video/mp4, video/quicktime, video/webm
  base64: string;
}
/** Resultado de una herramienta que el agente pidió ejecutar (se devuelve al modelo). */
export interface ParteResultadoHerramienta {
  tipo: 'resultado-herramienta';
  idLlamada: string;
  nombre: string;
  resultado: unknown;
  esError?: boolean;
}
/** Llamada a herramienta emitida por el modelo (se guarda en el historial tal cual). */
export interface ParteLlamadaHerramienta {
  tipo: 'llamada-herramienta';
  idLlamada: string;
  nombre: string;
  argumentos: Record<string, unknown>;
  /**
   * Firma opaca que algunos proveedores adjuntan a la llamada y exigen recibir de vuelta
   * (Gemini 3: `thoughtSignature`). Se guarda tal cual y solo la entiende quien la emitió.
   */
  firma?: string;
}

export type Parte =
  | ParteTexto
  | ParteImagen
  | ParteVideo
  | ParteResultadoHerramienta
  | ParteLlamadaHerramienta;

export interface MensajeModelo {
  rol: 'usuario' | 'modelo';
  partes: Parte[];
}

/** Definición de herramienta (function calling), en JSON Schema simple. */
export interface Herramienta {
  nombre: string;
  descripcion: string;
  parametros: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface OpcionesGenerar {
  /** Instrucciones de sistema (persona + conocimiento + propósito de la empresa). */
  sistema: string;
  mensajes: MensajeModelo[];
  herramientas?: Herramienta[];
  /** Pedir búsqueda en internet (Gemini: Google Search grounding; Claude: web_search). */
  buscarWeb?: boolean;
  /** Forzar salida JSON que cumpla este esquema (cuando el proveedor lo soporte). */
  esquemaJson?: Record<string, unknown>;
  temperatura?: number;
  maxTokensSalida?: number;
  /** Recibe fragmentos de texto a medida que llegan. */
  onTexto?: (delta: string) => void;
  /** Para cancelar. */
  senal?: AbortSignal;
}

export interface FuenteWeb {
  titulo: string;
  url: string;
}

export interface Uso {
  tokensEntrada: number;
  tokensSalida: number;
}

export interface Respuesta {
  texto: string;
  llamadasHerramienta: ParteLlamadaHerramienta[];
  fuentes?: FuenteWeb[];
  uso: Uso;
  proveedor: Proveedor;
  modelo: string;
  /** Por qué terminó: 'fin' | 'herramienta' | 'longitud' | 'rechazo' */
  motivoFin: 'fin' | 'herramienta' | 'longitud' | 'rechazo';
}

export interface Capacidades {
  imagen: boolean;
  video: boolean;
  busquedaWeb: boolean;
  herramientas: boolean;
  jsonEstructurado: boolean;
}

export interface LLMProvider {
  readonly nombre: Proveedor;
  capacidades(): Capacidades;
  /** Lista los modelos disponibles (para validar nombres en /api/salud y `npm run smoke`). */
  listarModelos(): Promise<string[]>;
  generar(modelo: string, opciones: OpcionesGenerar): Promise<Respuesta>;
}

/** Error tipado para que el router sepa si puede caer a otro proveedor. */
export class ErrorProveedor extends Error {
  constructor(
    message: string,
    public readonly proveedor: Proveedor,
    public readonly recuperable: boolean,
    public readonly causa?: unknown,
  ) {
    super(message);
    this.name = 'ErrorProveedor';
  }
}

export function soloTexto(mensaje: MensajeModelo): string {
  return mensaje.partes
    .filter((p): p is ParteTexto => p.tipo === 'texto')
    .map((p) => p.texto)
    .join('\n');
}

export function tieneVideo(mensajes: MensajeModelo[]): boolean {
  return mensajes.some((m) => m.partes.some((p) => p.tipo === 'video'));
}
