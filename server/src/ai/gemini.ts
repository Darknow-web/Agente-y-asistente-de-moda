/**
 * PROVEEDOR GEMINI — implementa el contrato LLMProvider sobre @google/genai (Google AI Studio).
 *
 * Notas de la API real (SDK 2.24):
 *  - `ai.models.generateContent({ model, contents, config })` y `generateContentStream(...)`.
 *  - `config.systemInstruction`, `config.tools: [{ functionDeclarations }, { googleSearch: {} }]`,
 *    `config.responseMimeType: 'application/json'` + `config.responseJsonSchema` (JSON Schema estándar).
 *  - Partes: `{ text }`, `{ inlineData: { mimeType, data } }`, `{ functionCall: { id?, name, args } }`,
 *    `{ functionResponse: { id?, name, response } }`.
 *  - Fuentes: `candidates[0].groundingMetadata.groundingChunks[].web.{ uri, title }`.
 *  - Uso: `usageMetadata.promptTokenCount` / `candidatesTokenCount` (+ `thoughtsTokenCount`).
 */

import {
  ApiError,
  FinishReason,
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type Part,
  type Tool,
} from '@google/genai';

import {
  ErrorProveedor,
  type Capacidades,
  type FuenteWeb,
  type Herramienta,
  type LLMProvider,
  type MensajeModelo,
  type OpcionesGenerar,
  type ParteLlamadaHerramienta,
  type Respuesta,
} from './provider.js';

/** Prefijo de los ids que generamos nosotros cuando Gemini no manda uno. No se reenvían al modelo. */
const PREFIJO_ID_LOCAL = 'llamada-';

// ------------------------------------------------------------------ mapeo puro (probado en mapeo.test.ts)

/** Firma que Google documenta para llamadas a herramienta no generadas por Gemini (salta la validación). */
export const FIRMA_OMITIR_VALIDACION = 'skip_thought_signature_validator';

/** Convierte el historial neutro a `Content[]` de Gemini. */
export function aContenidoGemini(mensajes: MensajeModelo[]): Content[] {
  return mensajes.map((m) => ({
    role: m.rol === 'usuario' ? 'user' : 'model',
    parts: m.partes.map(aParteGemini),
  }));
}

function aParteGemini(parte: MensajeModelo['partes'][number]): Part {
  switch (parte.tipo) {
    case 'texto':
      return { text: parte.texto };
    case 'imagen':
    case 'video':
      return { inlineData: { mimeType: parte.mime, data: parte.base64 } };
    case 'llamada-herramienta': {
      const functionCall: FunctionCall = { name: parte.nombre, args: parte.argumentos };
      // Solo reenviamos el id si lo emitió Gemini; los ids locales (`llamada-N`) no existen para la API.
      if (!parte.idLlamada.startsWith(PREFIJO_ID_LOCAL)) functionCall.id = parte.idLlamada;
      // Gemini 3 exige devolver la firma de pensamiento que acompañó a la llamada. Si la llamada la
      // generó otro motor (Claude, simulado), se usa la firma de omisión que documenta Google.
      return { functionCall, thoughtSignature: parte.firma ?? FIRMA_OMITIR_VALIDACION };
    }
    case 'resultado-herramienta': {
      // Gemini exige un objeto en `response`; si el resultado no es un objeto, lo envolvemos.
      const esObjeto =
        typeof parte.resultado === 'object' && parte.resultado !== null && !Array.isArray(parte.resultado);
      const response: Record<string, unknown> = esObjeto
        ? { ...(parte.resultado as Record<string, unknown>) }
        : { resultado: parte.resultado };
      if (parte.esError) response.error = true;
      const functionResponse: NonNullable<Part['functionResponse']> = { name: parte.nombre, response };
      if (!parte.idLlamada.startsWith(PREFIJO_ID_LOCAL)) functionResponse.id = parte.idLlamada;
      return { functionResponse };
    }
  }
}

/** Convierte nuestras herramientas al formato `functionDeclarations` de Gemini. */
export function aHerramientasGemini(herramientas: Herramienta[]): Tool {
  return {
    functionDeclarations: herramientas.map((h) => ({
      name: h.nombre,
      description: h.descripcion,
      // `parametersJsonSchema` acepta JSON Schema estándar (nuestro contrato ya lo es).
      parametersJsonSchema: h.parametros,
    })),
  };
}

/**
 * Arma la lista de `tools`. Gemini (API de AI Studio) no acepta `googleSearch` junto con
 * `functionDeclarations` en la misma petición en muchas versiones: si se piden ambas,
 * priorizamos la BÚSQUEDA (es lo que el agente pidió explícitamente con `buscarWeb`) y
 * avisamos. Los agentes hacen la búsqueda en una llamada separada de la de herramientas.
 */
export function armarToolsGemini(opciones: Pick<OpcionesGenerar, 'herramientas' | 'buscarWeb'>): Tool[] | undefined {
  const tieneHerramientas = !!opciones.herramientas?.length;
  if (opciones.buscarWeb) {
    if (tieneHerramientas) {
      console.warn(
        '[gemini] Se pidieron búsqueda web y herramientas en la misma llamada; Gemini no las combina. Se usa solo la búsqueda.',
      );
    }
    return [{ googleSearch: {} }];
  }
  if (tieneHerramientas) return [aHerramientasGemini(opciones.herramientas!)];
  return undefined;
}

export function motivoFinGemini(
  finishReason: FinishReason | string | undefined,
  hayLlamadas: boolean,
): Respuesta['motivoFin'] {
  if (hayLlamadas) return 'herramienta';
  switch (finishReason) {
    case FinishReason.MAX_TOKENS:
      return 'longitud';
    case FinishReason.SAFETY:
    case FinishReason.PROHIBITED_CONTENT:
    case FinishReason.BLOCKLIST:
    case FinishReason.SPII:
    case FinishReason.IMAGE_SAFETY:
      return 'rechazo';
    default:
      return 'fin';
  }
}

/** 429 y 5xx (y fallos de red) se pueden reintentar; 400/401/403/404 no. */
export function esRecuperableGemini(status: number | undefined): boolean {
  if (status === undefined) return true; // error de red / sin respuesta HTTP
  if (status === 429) return true;
  return status >= 500;
}

// ------------------------------------------------------------------ proveedor

export class ProveedorGemini implements LLMProvider {
  readonly nombre = 'gemini' as const;
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  capacidades(): Capacidades {
    return { imagen: true, video: true, busquedaWeb: true, herramientas: true, jsonEstructurado: true };
  }

  async listarModelos(): Promise<string[]> {
    try {
      const nombres: string[] = [];
      const pagina = await this.ai.models.list({ config: { pageSize: 100 } });
      for await (const modelo of pagina) {
        if (modelo.name) nombres.push(modelo.name.replace(/^models\//, ''));
      }
      return nombres;
    } catch (error) {
      throw envolverError(error, 'No se pudo listar los modelos de Gemini');
    }
  }

  async generar(modelo: string, opciones: OpcionesGenerar): Promise<Respuesta> {
    const config: GenerateContentConfig = {
      systemInstruction: opciones.sistema || undefined,
      temperature: opciones.temperatura,
      maxOutputTokens: opciones.maxTokensSalida,
      abortSignal: opciones.senal,
      tools: armarToolsGemini(opciones),
    };
    if (opciones.esquemaJson) {
      config.responseMimeType = 'application/json';
      config.responseJsonSchema = opciones.esquemaJson;
    }

    const peticion = { model: modelo, contents: aContenidoGemini(opciones.mensajes), config };
    const acumulado = new Acumulador();

    try {
      if (opciones.onTexto) {
        const flujo = await this.ai.models.generateContentStream(peticion);
        for await (const trozo of flujo) {
          const textoAntes = acumulado.texto.length;
          acumulado.agregar(trozo);
          const delta = acumulado.texto.slice(textoAntes);
          if (delta) opciones.onTexto(delta);
        }
      } else {
        acumulado.agregar(await this.ai.models.generateContent(peticion));
      }
    } catch (error) {
      throw envolverError(error, `Fallo al generar con Gemini (${modelo})`);
    }

    return acumulado.aRespuesta(modelo);
  }

  /**
   * Edición de imagen con un modelo generativo (p. ej. gemini-2.5-flash-image): recibe una foto y
   * una instrucción y devuelve la imagen resultante. No forma parte del contrato LLMProvider porque
   * solo Gemini lo ofrece aquí.
   */
  async generarImagen(modelo: string, op: OpcionesImagen): Promise<ImagenGenerada> {
    const peticion = {
      model: modelo,
      contents: [{ role: 'user', parts: [{ text: op.instruccion }, { inlineData: { mimeType: op.imagen.mime, data: op.imagen.base64 } }] }],
      config: { responseModalities: ['IMAGE', 'TEXT'], abortSignal: op.senal } as GenerateContentConfig,
    };
    let respuesta: GenerateContentResponse;
    try {
      respuesta = await this.ai.models.generateContent(peticion);
    } catch (error) {
      throw envolverError(error, `Fallo al generar imagen con Gemini (${modelo})`);
    }
    const partes = respuesta.candidates?.[0]?.content?.parts ?? [];
    const imagen = partes.find((p) => p.inlineData?.data);
    const uso = respuesta.usageMetadata;
    const tokens = { tokensEntrada: uso?.promptTokenCount ?? 0, tokensSalida: (uso?.candidatesTokenCount ?? 0) + (uso?.thoughtsTokenCount ?? 0) };
    if (!imagen?.inlineData?.data) {
      const motivo = respuesta.promptFeedback?.blockReason ?? respuesta.candidates?.[0]?.finishReason ?? 'sin imagen en la respuesta';
      throw new ErrorProveedor(`Gemini (${modelo}) no devolvió imagen: ${String(motivo)}`, 'gemini', false);
    }
    return { mime: imagen.inlineData.mimeType ?? 'image/png', base64: imagen.inlineData.data, modelo, ...tokens };
  }
}

export interface OpcionesImagen {
  instruccion: string;
  imagen: { mime: string; base64: string };
  senal?: AbortSignal;
}

export interface ImagenGenerada {
  mime: string;
  base64: string;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
}

// ------------------------------------------------------------------ acumulación de respuestas (normal o en flujo)

class Acumulador {
  texto = '';
  llamadas: ParteLlamadaHerramienta[] = [];
  fuentes = new Map<string, FuenteWeb>();
  tokensEntrada = 0;
  tokensSalida = 0;
  finishReason: FinishReason | undefined;
  bloqueadoPorPrompt = false;
  private contadorIds = 0;

  agregar(respuesta: GenerateContentResponse): void {
    const candidato = respuesta.candidates?.[0];
    for (const parte of candidato?.content?.parts ?? []) {
      if (parte.thought) continue; // razonamiento interno: no es texto para el usuario
      if (parte.text) this.texto += parte.text;
      if (parte.functionCall?.name) {
        this.contadorIds += 1;
        this.llamadas.push({
          tipo: 'llamada-herramienta',
          idLlamada: parte.functionCall.id || `${PREFIJO_ID_LOCAL}${this.contadorIds}`,
          nombre: parte.functionCall.name,
          argumentos: (parte.functionCall.args ?? {}) as Record<string, unknown>,
          ...(parte.thoughtSignature ? { firma: parte.thoughtSignature } : {}),
        });
      }
    }
    for (const chunk of candidato?.groundingMetadata?.groundingChunks ?? []) {
      const uri = chunk.web?.uri;
      if (uri && !this.fuentes.has(uri)) this.fuentes.set(uri, { titulo: chunk.web?.title ?? uri, url: uri });
    }
    if (candidato?.finishReason) this.finishReason = candidato.finishReason;
    if (respuesta.promptFeedback?.blockReason) this.bloqueadoPorPrompt = true;

    // El uso llega completo en el último trozo del flujo; nos quedamos con el mayor valor visto.
    const uso = respuesta.usageMetadata;
    if (uso) {
      this.tokensEntrada = Math.max(this.tokensEntrada, uso.promptTokenCount ?? 0);
      this.tokensSalida = Math.max(this.tokensSalida, (uso.candidatesTokenCount ?? 0) + (uso.thoughtsTokenCount ?? 0));
    }
  }

  aRespuesta(modelo: string): Respuesta {
    const motivoFin = this.bloqueadoPorPrompt ? 'rechazo' : motivoFinGemini(this.finishReason, this.llamadas.length > 0);
    return {
      texto: this.texto,
      llamadasHerramienta: this.llamadas,
      fuentes: this.fuentes.size ? [...this.fuentes.values()] : undefined,
      uso: { tokensEntrada: this.tokensEntrada, tokensSalida: this.tokensSalida },
      proveedor: 'gemini',
      modelo,
      motivoFin,
    };
  }
}

// ------------------------------------------------------------------ errores

function envolverError(error: unknown, contexto: string): ErrorProveedor {
  if (error instanceof ErrorProveedor) return error;
  if (error instanceof ApiError) {
    return new ErrorProveedor(`${contexto}: ${error.message} (HTTP ${error.status})`, 'gemini', esRecuperableGemini(error.status), error);
  }
  const err = error as { name?: string; message?: string; status?: number };
  if (err?.name === 'AbortError') {
    return new ErrorProveedor(`${contexto}: petición cancelada`, 'gemini', false, error);
  }
  // Errores de red (fetch failed, ECONNRESET…) u otros sin código HTTP: se consideran recuperables.
  const status = typeof err?.status === 'number' ? err.status : undefined;
  return new ErrorProveedor(`${contexto}: ${err?.message ?? String(error)}`, 'gemini', esRecuperableGemini(status), error);
}
