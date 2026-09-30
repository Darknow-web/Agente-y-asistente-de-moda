/**
 * Pruebas de los mapeos puros (sin red) entre nuestro contrato y los formatos de Gemini y Claude.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  aHerramientasClaude,
  aMensajesClaude,
  armarPeticionClaude,
  interpretarMensajeClaude,
  motivoFinClaude,
  usaPensamiento,
} from './claude.js';
import { aContenidoGemini, aHerramientasGemini, armarToolsGemini, esRecuperableGemini, motivoFinGemini } from './gemini.js';
import { ErrorProveedor, type Herramienta, type MensajeModelo } from './provider.js';

const herramienta: Herramienta = {
  nombre: 'buscar_prendas',
  descripcion: 'Busca prendas del guardarropa',
  parametros: { type: 'object', properties: { color: { type: 'string' } }, required: ['color'] },
};

describe('mapeo a Gemini', () => {
  it('convierte roles y partes (texto, imagen, video)', () => {
    const mensajes: MensajeModelo[] = [
      {
        rol: 'usuario',
        partes: [
          { tipo: 'texto', texto: 'Hola' },
          { tipo: 'imagen', mime: 'image/png', base64: 'AAA' },
          { tipo: 'video', mime: 'video/mp4', base64: 'BBB' },
        ],
      },
      { rol: 'modelo', partes: [{ tipo: 'texto', texto: 'Qué tal' }] },
    ];
    expect(aContenidoGemini(mensajes)).toEqual([
      {
        role: 'user',
        parts: [{ text: 'Hola' }, { inlineData: { mimeType: 'image/png', data: 'AAA' } }, { inlineData: { mimeType: 'video/mp4', data: 'BBB' } }],
      },
      { role: 'model', parts: [{ text: 'Qué tal' }] },
    ]);
  });

  it('convierte llamadas y resultados de herramienta (sin reenviar ids locales)', () => {
    const mensajes: MensajeModelo[] = [
      { rol: 'modelo', partes: [{ tipo: 'llamada-herramienta', idLlamada: 'llamada-1', nombre: 'buscar_prendas', argumentos: { color: 'azul' } }] },
      { rol: 'usuario', partes: [{ tipo: 'resultado-herramienta', idLlamada: 'llamada-1', nombre: 'buscar_prendas', resultado: [{ id: 'p1' }] }] },
      { rol: 'modelo', partes: [{ tipo: 'llamada-herramienta', idLlamada: 'abc-123', nombre: 'x', argumentos: {} }] },
      { rol: 'usuario', partes: [{ tipo: 'resultado-herramienta', idLlamada: 'abc-123', nombre: 'x', resultado: { ok: true }, esError: true }] },
    ];
    const contenido = aContenidoGemini(mensajes);
    // Sin firma (llamada de otro motor): se manda la firma de omisión que documenta Google.
    expect(contenido[0].parts?.[0]).toEqual({ functionCall: { name: 'buscar_prendas', args: { color: 'azul' } }, thoughtSignature: 'skip_thought_signature_validator' });
    expect(contenido[1].parts?.[0]).toEqual({ functionResponse: { name: 'buscar_prendas', response: { resultado: [{ id: 'p1' }] } } });
    expect(contenido[2].parts?.[0]).toEqual({ functionCall: { id: 'abc-123', name: 'x', args: {} }, thoughtSignature: 'skip_thought_signature_validator' });
    expect(contenido[3].parts?.[0]).toEqual({ functionResponse: { id: 'abc-123', name: 'x', response: { ok: true, error: true } } });
  });

  it('reenvía tal cual la firma de pensamiento de Gemini 3 en las llamadas a herramienta', () => {
    const contenido = aContenidoGemini([
      { rol: 'modelo', partes: [{ tipo: 'llamada-herramienta', idLlamada: 'llamada-1', nombre: 'actualizar_perfil', argumentos: { ciudad: 'Lima' }, firma: 'FIRMA==' }] },
    ]);
    expect(contenido[0].parts?.[0]).toEqual({ functionCall: { name: 'actualizar_perfil', args: { ciudad: 'Lima' } }, thoughtSignature: 'FIRMA==' });
  });

  it('mapea herramientas a functionDeclarations con JSON Schema', () => {
    expect(aHerramientasGemini([herramienta])).toEqual({
      functionDeclarations: [{ name: 'buscar_prendas', description: 'Busca prendas del guardarropa', parametersJsonSchema: herramienta.parametros }],
    });
  });

  it('prioriza googleSearch si se piden búsqueda y herramientas a la vez', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(armarToolsGemini({ buscarWeb: true, herramientas: [herramienta] })).toEqual([{ googleSearch: {} }]);
    expect(aviso).toHaveBeenCalledOnce();
    aviso.mockRestore();
    expect(armarToolsGemini({ herramientas: [herramienta] })).toEqual([aHerramientasGemini([herramienta])]);
    expect(armarToolsGemini({})).toBeUndefined();
  });

  it('traduce el motivo de fin y la recuperabilidad', () => {
    expect(motivoFinGemini('STOP', false)).toBe('fin');
    expect(motivoFinGemini('STOP', true)).toBe('herramienta');
    expect(motivoFinGemini('MAX_TOKENS', false)).toBe('longitud');
    expect(motivoFinGemini('SAFETY', false)).toBe('rechazo');
    expect(motivoFinGemini('PROHIBITED_CONTENT', false)).toBe('rechazo');
    expect(motivoFinGemini('BLOCKLIST', false)).toBe('rechazo');
    expect(esRecuperableGemini(429)).toBe(true);
    expect(esRecuperableGemini(503)).toBe(true);
    expect(esRecuperableGemini(undefined)).toBe(true);
    expect(esRecuperableGemini(400)).toBe(false);
    expect(esRecuperableGemini(401)).toBe(false);
    expect(esRecuperableGemini(404)).toBe(false);
  });
});

describe('mapeo a Claude', () => {
  it('convierte roles y bloques, fusionando mensajes consecutivos del mismo rol', () => {
    const mensajes: MensajeModelo[] = [
      { rol: 'usuario', partes: [{ tipo: 'texto', texto: 'Hola' }] },
      { rol: 'usuario', partes: [{ tipo: 'imagen', mime: 'image/webp', base64: 'AAA' }] },
      { rol: 'modelo', partes: [{ tipo: 'texto', texto: 'Qué tal' }] },
      { rol: 'modelo', partes: [{ tipo: 'llamada-herramienta', idLlamada: 'toolu_1', nombre: 'buscar_prendas', argumentos: { color: 'rojo' } }] },
      { rol: 'usuario', partes: [{ tipo: 'resultado-herramienta', idLlamada: 'toolu_1', nombre: 'buscar_prendas', resultado: { total: 2 }, esError: true }] },
    ];
    const salida = aMensajesClaude(mensajes);
    expect(salida).toHaveLength(3);
    expect(salida[0]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'Hola' },
        { type: 'image', source: { type: 'base64', media_type: 'image/webp', data: 'AAA' } },
      ],
    });
    expect(salida[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Qué tal' },
        { type: 'tool_use', id: 'toolu_1', name: 'buscar_prendas', input: { color: 'rojo' } },
      ],
    });
    expect(salida[2]).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '{"total":2}', is_error: true }],
    });
  });

  it('descarta textos vacíos y rechaza video con ErrorProveedor no recuperable', () => {
    expect(aMensajesClaude([{ rol: 'usuario', partes: [{ tipo: 'texto', texto: '   ' }] }])).toEqual([]);
    let error: unknown;
    try {
      aMensajesClaude([{ rol: 'usuario', partes: [{ tipo: 'video', mime: 'video/mp4', base64: 'x' }] }]);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ErrorProveedor);
    expect((error as ErrorProveedor).proveedor).toBe('claude');
    expect((error as ErrorProveedor).recuperable).toBe(false);
  });

  it('mapea herramientas a input_schema', () => {
    expect(aHerramientasClaude([herramienta])).toEqual([
      { name: 'buscar_prendas', description: 'Busca prendas del guardarropa', input_schema: herramienta.parametros },
    ]);
  });

  it('arma la petición: pensamiento adaptativo según modelo, web_search y esquema JSON', () => {
    expect(usaPensamiento('claude-sonnet-5-5')).toBe(true);
    expect(usaPensamiento('claude-opus-5-5')).toBe(true);
    expect(usaPensamiento('claude-haiku-4-5')).toBe(false);

    const opciones = {
      sistema: 'Eres SASTRA',
      mensajes: [{ rol: 'usuario' as const, partes: [{ tipo: 'texto' as const, texto: 'Hola' }] }],
      herramientas: [herramienta],
      buscarWeb: true,
      esquemaJson: { type: 'object', properties: { ok: { type: 'boolean' } } },
      temperatura: 0.3,
    };
    const conPensamiento = armarPeticionClaude('claude-sonnet-5-5', opciones);
    expect(conPensamiento.thinking).toEqual({ type: 'adaptive' });
    expect(conPensamiento.temperature).toBeUndefined();
    expect(conPensamiento.max_tokens).toBe(8000);
    expect(conPensamiento.system).toBe('Eres SASTRA');
    expect(conPensamiento.tools).toEqual([
      { name: 'buscar_prendas', description: 'Busca prendas del guardarropa', input_schema: herramienta.parametros },
      { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
    ]);
    expect(conPensamiento.output_config).toEqual({ format: { type: 'json_schema', schema: opciones.esquemaJson } });
    expect((conPensamiento as { tool_choice?: unknown }).tool_choice).toBeUndefined();

    const haiku = armarPeticionClaude('claude-haiku-4-5', { ...opciones, maxTokensSalida: 500 });
    expect(haiku.thinking).toBeUndefined();
    expect(haiku.temperature).toBe(0.3);
    expect(haiku.max_tokens).toBe(500);
  });

  it('interpreta el mensaje final: texto, tool_use, fuentes deduplicadas y motivo de fin', () => {
    const mensaje = {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      stop_reason: 'tool_use',
      stop_sequence: null,
      content: [
        { type: 'text', text: 'Busco… ', citations: null },
        {
          type: 'web_search_tool_result',
          tool_use_id: 'srvtoolu_1',
          caller: { type: 'direct' },
          content: [
            { type: 'web_search_result', title: 'Tienda A', url: 'https://a.com', encrypted_content: 'x', page_age: null },
            { type: 'web_search_result', title: 'Tienda A bis', url: 'https://a.com', encrypted_content: 'y', page_age: null },
            { type: 'web_search_result', title: '', url: 'https://b.com', encrypted_content: 'z', page_age: null },
          ],
        },
        { type: 'text', text: 'listo.', citations: null },
        { type: 'tool_use', id: 'toolu_9', name: 'buscar_prendas', input: { color: 'azul' }, caller: { type: 'direct' } },
      ],
      usage: { input_tokens: 120, output_tokens: 30, cache_creation_input_tokens: null, cache_read_input_tokens: null, cache_creation: null, inference_geo: null, server_tool_use: null, service_tier: null },
    } as unknown as Parameters<typeof interpretarMensajeClaude>[0];

    const respuesta = interpretarMensajeClaude(mensaje, 'claude-sonnet-5-5');
    expect(respuesta.texto).toBe('Busco… listo.');
    expect(respuesta.llamadasHerramienta).toEqual([
      { tipo: 'llamada-herramienta', idLlamada: 'toolu_9', nombre: 'buscar_prendas', argumentos: { color: 'azul' } },
    ]);
    expect(respuesta.fuentes).toEqual([
      { titulo: 'Tienda A', url: 'https://a.com' },
      { titulo: 'https://b.com', url: 'https://b.com' },
    ]);
    expect(respuesta.uso).toEqual({ tokensEntrada: 120, tokensSalida: 30 });
    expect(respuesta.motivoFin).toBe('herramienta');
    expect(respuesta.proveedor).toBe('claude');
  });

  it('traduce stop_reason', () => {
    expect(motivoFinClaude('end_turn')).toBe('fin');
    expect(motivoFinClaude('tool_use')).toBe('herramienta');
    expect(motivoFinClaude('max_tokens')).toBe('longitud');
    expect(motivoFinClaude('refusal')).toBe('rechazo');
    expect(motivoFinClaude(null)).toBe('fin');
  });
});
