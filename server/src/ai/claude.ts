/**
 * PROVEEDOR CLAUDE — implementa el contrato LLMProvider sobre @anthropic-ai/sdk (Messages API).
 *
 * Notas de la API real (SDK 0.129):
 *  - Siempre en flujo: `client.messages.stream({...}, { signal })` + `.finalMessage()`.
 *  - Mensajes: `{ role: 'user' | 'assistant', content: bloques[] }`. Bloques: `text`, `image`
 *    (`source: { type: 'base64', media_type, data }`), `tool_use` (`{ id, name, input }`) y
 *    `tool_result` (`{ tool_use_id, content, is_error }`). Los roles deben alternar: fusionamos
 *    mensajes consecutivos del mismo rol.
 *  - Herramientas: `{ name, description, input_schema }`. Búsqueda web: herramienta de servidor
 *    `{ type: 'web_search_20260209', name: 'web_search', max_uses }`; los resultados llegan como bloques
 *    `web_search_tool_result` con `content: web_search_result[]` (o un objeto de error).
 *  - JSON estructurado: `output_config: { format: { type: 'json_schema', schema } }`.
 *  - Pensamiento: `thinking: { type: 'adaptive' }` en claude-opus-5*, claude-sonnet-5* y claude-fable*;
 *    en claude-haiku-4-5 se omite. Sin prefill de assistant ni tool_choice forzado.
 *  - `stop_reason`: 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal' | ...; uso en
 *    `usage.input_tokens` / `usage.output_tokens`.
 */

import Anthropic from '@anthropic-ai/sdk';

import {
  ErrorProveedor,
  type Capacidades,
  type FuenteWeb,
  type Herramienta,
  type LLMProvider,
  type MensajeModelo,
  type OpcionesGenerar,
  type Parte,
  type ParteLlamadaHerramienta,
  type Respuesta,
} from './provider.js';

export const MAX_TOKENS_SALIDA_POR_DEFECTO = 8000;
const MAX_USOS_BUSQUEDA = 5;

// ------------------------------------------------------------------ mapeo puro (probado en mapeo.test.ts)

type BloqueClaude = Anthropic.ContentBlockParam;
type MediaImagen = Anthropic.Base64ImageSource['media_type'];

const MIMES_IMAGEN: readonly MediaImagen[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function aBloqueClaude(parte: Parte): BloqueClaude {
  switch (parte.tipo) {
    case 'texto':
      return { type: 'text', text: parte.texto };
    case 'imagen': {
      const media = (MIMES_IMAGEN as readonly string[]).includes(parte.mime) ? (parte.mime as MediaImagen) : 'image/jpeg';
      return { type: 'image', source: { type: 'base64', media_type: media, data: parte.base64 } };
    }
    case 'video':
      throw new ErrorProveedor('Claude no procesa video', 'claude', false);
    case 'llamada-herramienta':
      return { type: 'tool_use', id: parte.idLlamada, name: parte.nombre, input: parte.argumentos };
    case 'resultado-herramienta':
      return {
        type: 'tool_result',
        tool_use_id: parte.idLlamada,
        content: typeof parte.resultado === 'string' ? parte.resultado : JSON.stringify(parte.resultado ?? null),
        is_error: parte.esError || undefined,
      };
  }
}

/**
 * Convierte el historial neutro a `MessageParam[]` de Anthropic, fusionando mensajes
 * consecutivos del mismo rol (la API exige alternancia user/assistant) y descartando
 * mensajes que quedarían vacíos.
 */
export function aMensajesClaude(mensajes: MensajeModelo[]): Anthropic.MessageParam[] {
  const salida: Anthropic.MessageParam[] = [];
  for (const m of mensajes) {
    const role = m.rol === 'usuario' ? 'user' : 'assistant';
    const bloques = m.partes.map(aBloqueClaude).filter((b) => !(b.type === 'text' && b.text.trim() === ''));
    if (!bloques.length) continue;
    const anterior = salida[salida.length - 1];
    if (anterior && anterior.role === role && Array.isArray(anterior.content)) {
      anterior.content.push(...bloques);
    } else {
      salida.push({ role, content: bloques });
    }
  }
  return salida;
}

/** Convierte nuestras herramientas al formato de Anthropic. */
export function aHerramientasClaude(herramientas: Herramienta[]): Anthropic.Tool[] {
  return herramientas.map((h) => ({
    name: h.nombre,
    description: h.descripcion,
    input_schema: h.parametros as Anthropic.Tool.InputSchema,
  }));
}

/** ¿El modelo admite (y conviene activar) el pensamiento adaptativo? */
export function usaPensamiento(modelo: string): boolean {
  return modelo.startsWith('claude-opus-5') || modelo.startsWith('claude-sonnet-5') || modelo.startsWith('claude-fable');
}

export function motivoFinClaude(stopReason: Anthropic.StopReason | null | undefined): Respuesta['motivoFin'] {
  switch (stopReason) {
    case 'tool_use':
      return 'herramienta';
    case 'max_tokens':
    case 'model_context_window_exceeded':
      return 'longitud';
    case 'refusal':
      return 'rechazo';
    default:
      return 'fin';
  }
}

/** Recuperable: límite de tasa, error del servidor (5xx/529) o fallo de conexión. */
export function esRecuperableClaude(error: unknown): boolean {
  return (
    error instanceof Anthropic.RateLimitError ||
    error instanceof Anthropic.InternalServerError ||
    error instanceof Anthropic.APIConnectionError
  );
}

/** Arma los parámetros de la petición (exportado para poder probarlo sin red). */
export function armarPeticionClaude(modelo: string, opciones: OpcionesGenerar): Anthropic.MessageStreamParams {
  const tools: Anthropic.ToolUnion[] = opciones.herramientas?.length ? aHerramientasClaude(opciones.herramientas) : [];
  if (opciones.buscarWeb) tools.push({ type: 'web_search_20260209', name: 'web_search', max_uses: MAX_USOS_BUSQUEDA });

  const peticion: Anthropic.MessageStreamParams = {
    model: modelo,
    max_tokens: opciones.maxTokensSalida ?? MAX_TOKENS_SALIDA_POR_DEFECTO,
    system: opciones.sistema || undefined,
    messages: aMensajesClaude(opciones.mensajes),
  };
  if (tools.length) peticion.tools = tools;
  if (opciones.esquemaJson) peticion.output_config = { format: { type: 'json_schema', schema: opciones.esquemaJson } };
  if (usaPensamiento(modelo)) {
    peticion.thinking = { type: 'adaptive' };
  } else if (opciones.temperatura !== undefined) {
    // Con pensamiento activo la API no admite temperatura; solo la mandamos sin pensamiento.
    peticion.temperature = opciones.temperatura;
  }
  return peticion;
}

// ------------------------------------------------------------------ proveedor

export class ProveedorClaude implements LLMProvider {
  readonly nombre = 'claude' as const;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  capacidades(): Capacidades {
    return { imagen: true, video: false, busquedaWeb: true, herramientas: true, jsonEstructurado: true };
  }

  async listarModelos(): Promise<string[]> {
    try {
      const ids: string[] = [];
      // `client.models.list()` pagina automáticamente al iterar.
      for await (const modelo of this.client.models.list({ limit: 100 })) ids.push(modelo.id);
      return ids;
    } catch (error) {
      throw envolverError(error, 'No se pudo listar los modelos de Claude');
    }
  }

  async generar(modelo: string, opciones: OpcionesGenerar): Promise<Respuesta> {
    const peticion = armarPeticionClaude(modelo, opciones); // puede lanzar ErrorProveedor (video)

    let mensaje: Anthropic.Message;
    try {
      const flujo = this.client.messages.stream(peticion, { signal: opciones.senal });
      if (opciones.onTexto) {
        const onTexto = opciones.onTexto;
        flujo.on('text', (delta) => onTexto(delta));
      }
      mensaje = await flujo.finalMessage();
    } catch (error) {
      throw envolverError(error, `Fallo al generar con Claude (${modelo})`);
    }

    return interpretarMensajeClaude(mensaje, modelo);
  }
}

/** Traduce el `Message` final de Anthropic a nuestra `Respuesta` (exportado para pruebas). */
export function interpretarMensajeClaude(mensaje: Anthropic.Message, modelo: string): Respuesta {
  let texto = '';
  const llamadas: ParteLlamadaHerramienta[] = [];
  const fuentes = new Map<string, FuenteWeb>();

  for (const bloque of mensaje.content) {
    switch (bloque.type) {
      case 'text':
        texto += bloque.text;
        break;
      case 'tool_use':
        llamadas.push({
          tipo: 'llamada-herramienta',
          idLlamada: bloque.id,
          nombre: bloque.name,
          argumentos: (bloque.input ?? {}) as Record<string, unknown>,
        });
        break;
      case 'web_search_tool_result':
        // Éxito: lista de resultados. Error: un objeto `{ error_code }` (no lanza excepción).
        if (Array.isArray(bloque.content)) {
          for (const r of bloque.content) {
            if (!fuentes.has(r.url)) fuentes.set(r.url, { titulo: r.title || r.url, url: r.url });
          }
        } else {
          console.warn(`[claude] La búsqueda web devolvió un error: ${bloque.content.error_code}`);
        }
        break;
      default:
        break; // thinking, server_tool_use, etc.: no aportan al contrato
    }
  }

  return {
    texto,
    llamadasHerramienta: llamadas,
    fuentes: fuentes.size ? [...fuentes.values()] : undefined,
    uso: { tokensEntrada: mensaje.usage.input_tokens, tokensSalida: mensaje.usage.output_tokens },
    proveedor: 'claude',
    modelo: mensaje.model || modelo,
    motivoFin: motivoFinClaude(mensaje.stop_reason),
  };
}

// ------------------------------------------------------------------ errores

function envolverError(error: unknown, contexto: string): ErrorProveedor {
  if (error instanceof ErrorProveedor) return error;
  if (error instanceof Anthropic.APIUserAbortError) {
    return new ErrorProveedor(`${contexto}: petición cancelada`, 'claude', false, error);
  }
  const recuperable = esRecuperableClaude(error);
  const status = error instanceof Anthropic.APIError && error.status ? ` (HTTP ${error.status})` : '';
  const mensaje = error instanceof Error ? error.message : String(error);
  return new ErrorProveedor(`${contexto}: ${mensaje}${status}`, 'claude', recuperable, error);
}
