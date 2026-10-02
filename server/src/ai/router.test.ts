/**
 * Pruebas del router de motores: resolución por entorno/config, caídas y reintentos. Sin red.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TABLA_PRECIOS, estimarCostoUsd } from './costos.js';
import {
  ErrorProveedor,
  type Capacidades,
  type LLMProvider,
  type OpcionesGenerar,
  type Proveedor,
  type Respuesta,
} from './provider.js';
import { Router, cargarConfigModelos, reiniciarEstadoRouter, resolverMotor, validarModelos } from './router.js';

// Nombres reales de los modelos de Gemini por nivel, tal como están en modelos.json (cambian con el tiempo).
const G = cargarConfigModelos().gemini;

// ------------------------------------------------------------------ dobles de prueba

class ProveedorFalso implements LLMProvider {
  llamadas: { modelo: string; opciones: OpcionesGenerar }[] = [];
  /** Cola de comportamientos: cada llamada consume uno (error a lanzar o undefined = éxito). */
  fallos: (Error | undefined)[] = [];
  modelos: string[] = [];

  constructor(
    readonly nombre: Proveedor,
    private readonly caps: Partial<Capacidades> = {},
  ) {}

  capacidades(): Capacidades {
    return { imagen: true, video: true, busquedaWeb: true, herramientas: true, jsonEstructurado: true, ...this.caps };
  }
  async listarModelos(): Promise<string[]> {
    return this.modelos;
  }
  async generar(modelo: string, opciones: OpcionesGenerar): Promise<Respuesta> {
    this.llamadas.push({ modelo, opciones });
    const fallo = this.fallos.shift();
    if (fallo) throw fallo;
    return {
      texto: `respuesta de ${this.nombre}`,
      llamadasHerramienta: [],
      uso: { tokensEntrada: 1000, tokensSalida: 500 },
      proveedor: this.nombre,
      modelo,
      motivoFin: 'fin',
    };
  }
}

const opcionesBase: OpcionesGenerar = {
  sistema: 'Eres SASTRA',
  mensajes: [{ rol: 'usuario', partes: [{ tipo: 'texto', texto: 'Hola' }] }],
};

const opcionesConVideo: OpcionesGenerar = {
  sistema: 'Eres SASTRA',
  mensajes: [{ rol: 'usuario', partes: [{ tipo: 'video', mime: 'video/mp4', base64: 'AAAA' }, { tipo: 'texto', texto: '¿Qué tal me queda?' }] }],
};

function nuevoRouter() {
  const gemini = new ProveedorFalso('gemini');
  const claude = new ProveedorFalso('claude', { video: false });
  const r = new Router();
  r.esperaReintentoMs = 0;
  r.registrarProveedor('gemini', gemini);
  r.registrarProveedor('claude', claude);
  return { r, gemini, claude };
}

/** Router con Gemini solamente: sin llave ni instancia de Claude, el respaldo es otro nivel de Gemini. */
function nuevoRouterSoloGemini() {
  const gemini = new ProveedorFalso('gemini');
  const r = new Router();
  r.esperaReintentoMs = 0;
  r.registrarProveedor('gemini', gemini);
  return { r, gemini };
}

const VARIABLES = ['MOTOR_MODO', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'MOTOR_ESTILISMO', 'MOTOR_CUIDADO', 'MOTOR_DIRECTOR', 'MOTOR_COMPRAS'];

beforeEach(() => {
  reiniciarEstadoRouter();
  for (const v of VARIABLES) vi.stubEnv(v, '');
  vi.stubEnv('GEMINI_API_KEY', 'llave-gemini');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ------------------------------------------------------------------ resolución

describe('resolverMotor', () => {
  it('usa modelos.json por defecto y traduce el nivel al modelo real', () => {
    const config = cargarConfigModelos();
    expect(resolverMotor('calidad')).toEqual({ proveedor: 'gemini', modelo: config.gemini.flash, nivel: 'flash' });
    // La conversación va en Claude (lite = Haiku); sin ANTHROPIC_API_KEY cae a Gemini al mismo nivel.
    expect(config.agentes.director).toMatchObject({ proveedor: 'claude', nivel: 'lite' });
    expect(resolverMotor('director')).toEqual({ proveedor: 'gemini', modelo: config.gemini.lite, nivel: 'lite' });
    vi.stubEnv('ANTHROPIC_API_KEY', 'llave-claude');
    reiniciarEstadoRouter();
    expect(resolverMotor('director')).toEqual({ proveedor: 'claude', modelo: config.claude.lite, nivel: 'lite' });
  });

  it('aplica las variantes diario y busqueda', () => {
    const config = cargarConfigModelos();
    expect(resolverMotor('planificacion').modelo).toBe(config.gemini.pro);
    expect(resolverMotor('planificacion', 'diario').modelo).toBe(config.gemini.lite);
    expect(resolverMotor('compras').modelo).toBe(config.gemini.pro);
    expect(resolverMotor('compras', 'busqueda').modelo).toBe(config.gemini.flash);
    // Sin variante definida, se queda con el nivel principal.
    expect(resolverMotor('cuidado', 'busqueda').modelo).toBe(config.gemini.lite);
  });

  it('respeta MOTOR_<AGENTE>=claude:<id exacto>', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'llave-claude');
    vi.stubEnv('MOTOR_ESTILISMO', 'claude:claude-sonnet-5-5');
    expect(resolverMotor('estilismo')).toEqual({ proveedor: 'claude', modelo: 'claude-sonnet-5-5', nivel: 'flash' });
  });

  it('respeta MOTOR_<AGENTE>=gemini:<nivel>', () => {
    vi.stubEnv('MOTOR_CUIDADO', 'gemini:pro');
    expect(resolverMotor('cuidado')).toEqual({ proveedor: 'gemini', modelo: G.pro, nivel: 'pro' });
  });

  it('ignora overrides mal escritos y avisa', () => {
    vi.stubEnv('MOTOR_CUIDADO', 'openai:gpt');
    expect(resolverMotor('cuidado').modelo).toBe(G.lite);
    expect(console.warn).toHaveBeenCalled();
  });

  it('cae a Gemini al mismo nivel si falta ANTHROPIC_API_KEY y avisa una sola vez por agente', () => {
    vi.stubEnv('MOTOR_ESTILISMO', 'claude:pro');
    expect(resolverMotor('estilismo')).toEqual({ proveedor: 'gemini', modelo: G.pro, nivel: 'pro' });
    resolverMotor('estilismo');
    resolverMotor('estilismo');
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('con MOTOR_MODO=simulado todo va al proveedor simulado', () => {
    vi.stubEnv('MOTOR_MODO', 'simulado');
    vi.stubEnv('MOTOR_ESTILISMO', 'claude:claude-sonnet-5-5');
    expect(resolverMotor('estilismo')).toEqual({ proveedor: 'simulado', modelo: 'simulado', nivel: 'flash' });
    expect(resolverMotor('director')).toEqual({ proveedor: 'simulado', modelo: 'simulado', nivel: 'flash' });
  });
});

// ------------------------------------------------------------------ Router.generar

describe('Router.generar', () => {
  it('llama al proveedor resuelto y devuelve costo + registro de uso', async () => {
    const { r, gemini } = nuevoRouter();
    const registros: unknown[] = [];
    r.onUso = (registro) => {
      registros.push(registro);
    };
    const { respuesta, costoUsd } = await r.generar('director', opcionesBase);
    const esperado = resolverMotor('director').modelo;
    expect(gemini.llamadas).toHaveLength(1);
    expect(gemini.llamadas[0].modelo).toBe(esperado);
    expect(respuesta.texto).toBe('respuesta de gemini');
    // Costo según la tabla de precios del modelo resuelto (1000 entrada + 500 salida)
    expect(costoUsd).toBeCloseTo(estimarCostoUsd('gemini', esperado, 1000, 500), 10);
    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({ agente: 'director', proveedor: 'gemini', modelo: esperado, tokensEntrada: 1000, tokensSalida: 500, costoEstimadoUsd: costoUsd });
  });

  it('re-enruta a Gemini (mismo nivel) cuando hay video y el proveedor no lo soporta', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'llave-claude');
    vi.stubEnv('MOTOR_ESTILISMO', 'claude:pro');
    const { r, gemini, claude } = nuevoRouter();

    const { respuesta } = await r.generar('estilismo', opcionesConVideo);
    expect(claude.llamadas).toHaveLength(0);
    expect(gemini.llamadas).toHaveLength(1);
    expect(gemini.llamadas[0].modelo).toBe(G.pro);
    expect(respuesta.proveedor).toBe('gemini');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('video'));

    // Sin video, Claude sí recibe la llamada.
    await r.generar('estilismo', opcionesBase);
    expect(claude.llamadas).toHaveLength(1);
    expect(claude.llamadas[0].modelo).toBe('claude-opus-5-5');
  });

  it('reintenta una vez ante un error recuperable', async () => {
    const { r, gemini } = nuevoRouter();
    gemini.fallos = [new ErrorProveedor('429 demasiadas peticiones', 'gemini', true)];
    const { respuesta } = await r.generar('director', opcionesBase);
    expect(gemini.llamadas).toHaveLength(2);
    expect(respuesta.texto).toBe('respuesta de gemini');
  });

  it('no reintenta ante un error no recuperable', async () => {
    const { r, gemini } = nuevoRouter();
    gemini.fallos = [new ErrorProveedor('400 petición inválida', 'gemini', false)];
    await expect(r.generar('director', opcionesBase)).rejects.toThrow('400 petición inválida');
    expect(gemini.llamadas).toHaveLength(1);
  });

  it('si Claude falla dos veces con error recuperable, cae a Gemini al mismo nivel', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'llave-claude');
    vi.stubEnv('MOTOR_ESTILISMO', 'claude:claude-sonnet-5-5');
    const { r, gemini, claude } = nuevoRouter();
    claude.fallos = [new ErrorProveedor('529 sobrecargado', 'claude', true), new ErrorProveedor('529 sobrecargado', 'claude', true)];

    const { respuesta } = await r.generar('estilismo', opcionesBase);
    expect(claude.llamadas).toHaveLength(2);
    expect(gemini.llamadas).toHaveLength(1);
    expect(gemini.llamadas[0].modelo).toBe(G.flash);
    expect(respuesta.proveedor).toBe('gemini');
  });

  it('corta una llamada que no responde a tiempo, reintenta y cae a Gemini', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'llave-claude');
    vi.stubEnv('MOTOR_ESTILISMO', 'claude:claude-sonnet-5-5');
    const { r, gemini, claude } = nuevoRouter();
    // Claude "se cuelga": solo termina cuando la señal se aborta (como hace un SDK real).
    claude.generar = async (modelo, opciones) => {
      claude.llamadas.push({ modelo, opciones });
      await new Promise<void>((_, rechazar) => opciones.senal?.addEventListener('abort', () => rechazar(new ErrorProveedor('cancelada', 'claude', false))));
      throw new Error('inalcanzable');
    };
    const limites = await import('../config/limites.js');
    vi.spyOn(limites, 'leerLimites').mockReturnValue({ ...limites.leerLimites(), segundosMaxPorLlamadaIA: 0.02 });

    const { respuesta } = await r.generar('estilismo', opcionesBase);
    expect(claude.llamadas).toHaveLength(2);
    expect(gemini.llamadas).toHaveLength(1);
    expect(respuesta.proveedor).toBe('gemini');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('no respondió en 0.02 s'));
  });

  it('si un modelo de Gemini falla dos veces, prueba una vez con el modelo de respaldo de otro nivel', async () => {
    vi.stubEnv('MOTOR_DIRECTOR', 'gemini:gemini-modelo-saturado'); // nivel flash por defecto
    const { r, gemini } = nuevoRouterSoloGemini();
    gemini.fallos = [new ErrorProveedor('503', 'gemini', true), new ErrorProveedor('503', 'gemini', true)];
    const { respuesta } = await r.generar('director', opcionesBase);
    expect(gemini.llamadas.map((l) => l.modelo)).toEqual(['gemini-modelo-saturado', 'gemini-modelo-saturado', G.lite]);
    expect(respuesta.modelo).toBe(G.lite);
  });

  it('si el modelo de respaldo es el mismo que el saturado, no lo repite: propaga el error', async () => {
    vi.stubEnv('MOTOR_DIRECTOR', `gemini:${G.lite}`); // en modelos.json flash y lite pueden coincidir
    const { r, gemini } = nuevoRouterSoloGemini();
    gemini.fallos = [new ErrorProveedor('503', 'gemini', true), new ErrorProveedor('503', 'gemini', true)];
    if (G.flash === G.lite) {
      await expect(r.generar('director', opcionesBase)).rejects.toBeInstanceOf(ErrorProveedor);
      expect(gemini.llamadas).toHaveLength(2);
    }
  });

  it('si Gemini falla dos veces y hay llave de Claude, cae a Claude un escalón más barato (flash → Haiku)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'llave-claude');
    vi.stubEnv('MOTOR_GUARDARROPA', 'gemini:flash');
    const { r, gemini, claude } = nuevoRouter();
    gemini.fallos = [new ErrorProveedor('503', 'gemini', true), new ErrorProveedor('503', 'gemini', true)];
    const { respuesta } = await r.generar('guardarropa', opcionesBase);
    expect(gemini.llamadas).toHaveLength(2);
    expect(claude.llamadas.map((l) => l.modelo)).toEqual([cargarConfigModelos().claude.lite]);
    expect(respuesta.proveedor).toBe('claude');
  });

  it('desde Gemini pro cae a Sonnet, nunca a Opus', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'llave-claude');
    vi.stubEnv('MOTOR_GUARDARROPA', 'gemini:pro');
    const { r, gemini, claude } = nuevoRouter();
    gemini.fallos = [new ErrorProveedor('503', 'gemini', true), new ErrorProveedor('503', 'gemini', true)];
    await r.generar('guardarropa', opcionesBase);
    expect(claude.llamadas.map((l) => l.modelo)).toEqual([cargarConfigModelos().claude.flash]);
  });

  it('con video no cae a Claude aunque haya llave: usa el respaldo de Gemini', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'llave-claude');
    vi.stubEnv('MOTOR_GUARDARROPA', 'gemini:gemini-modelo-saturado');
    const { r, gemini, claude } = nuevoRouter();
    gemini.fallos = [new ErrorProveedor('503', 'gemini', true), new ErrorProveedor('503', 'gemini', true)];
    const { respuesta } = await r.generar('guardarropa', opcionesConVideo);
    expect(claude.llamadas).toHaveLength(0);
    expect(gemini.llamadas.map((l) => l.modelo)).toEqual(['gemini-modelo-saturado', 'gemini-modelo-saturado', G.lite]);
    expect(respuesta.proveedor).toBe('gemini');
  });

  it('si Claude rechaza la llave (error no recuperable), cae a Gemini igual', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'llave-mala');
    vi.stubEnv('MOTOR_ESTILISMO', 'claude:claude-haiku-4-5');
    const { r, gemini, claude } = nuevoRouter();
    claude.fallos = [new ErrorProveedor('Fallo al generar con Claude: authentication_error (HTTP 401)', 'claude', false)];
    const { respuesta } = await r.generar('estilismo', opcionesBase);
    expect(claude.llamadas).toHaveLength(1);
    expect(gemini.llamadas).toHaveLength(1);
    expect(respuesta.proveedor).toBe('gemini');
  });

  it('si también falla el modelo de respaldo de Gemini, propaga el error', async () => {
    vi.stubEnv('MOTOR_DIRECTOR', 'gemini:gemini-modelo-saturado');
    const { r, gemini } = nuevoRouterSoloGemini();
    gemini.fallos = [new ErrorProveedor('503', 'gemini', true), new ErrorProveedor('503', 'gemini', true), new ErrorProveedor('503', 'gemini', true)];
    await expect(r.generar('director', opcionesBase)).rejects.toBeInstanceOf(ErrorProveedor);
    expect(gemini.llamadas).toHaveLength(3);
  });

  it('en modo simulado responde sin proveedores reales', async () => {
    vi.stubEnv('MOTOR_MODO', 'simulado');
    const r = new Router();
    const { respuesta, costoUsd } = await r.generar('director', opcionesBase);
    expect(respuesta.proveedor).toBe('simulado');
    expect(respuesta.texto).toContain('[SIMULADO]');
    expect(respuesta.texto).toContain('Hola');
    expect(costoUsd).toBe(0);
  });

  it('el proveedor simulado emite una llamada a herramienta con el token usa:<nombre>', async () => {
    vi.stubEnv('MOTOR_MODO', 'simulado');
    const r = new Router();
    const { respuesta } = await r.generar('guardarropa', {
      sistema: '',
      mensajes: [{ rol: 'usuario', partes: [{ tipo: 'texto', texto: 'por favor usa:listar_prendas' }] }],
      herramientas: [{ nombre: 'listar_prendas', descripcion: 'Lista', parametros: { type: 'object', properties: {} } }],
    });
    expect(respuesta.motivoFin).toBe('herramienta');
    expect(respuesta.llamadasHerramienta[0]).toMatchObject({ nombre: 'listar_prendas', argumentos: {} });
  });
});

// ------------------------------------------------------------------ validación

describe('validarModelos', () => {
  it('marca válidos los modelos presentes en la lista del proveedor', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'llave-claude');
    vi.stubEnv('MOTOR_ESTILISMO', 'claude:claude-sonnet-5-5');
    vi.stubEnv('MOTOR_CUIDADO', 'gemini:pro');
    const { r, gemini, claude } = nuevoRouter();
    gemini.modelos = [`models/${G.flash}`, `models/${G.lite}`];
    claude.modelos = ['claude-sonnet-5-5', 'claude-haiku-4-5'];

    const resultado = await validarModelos(r);
    const porAgente = Object.fromEntries(resultado.map((x) => [x.agente, x]));
    // director está en Claude lite (Haiku) con llave presente; guardarropa sigue en Gemini flash.
    expect(porAgente.director).toMatchObject({ proveedor: 'claude', modelo: 'claude-haiku-4-5', valido: true });
    expect(porAgente.calidad).toMatchObject({ proveedor: 'gemini', modelo: G.flash, valido: true });
    expect(porAgente.cuidado).toMatchObject({ proveedor: 'gemini', modelo: G.pro, valido: false });
    expect(porAgente.estilismo).toMatchObject({ proveedor: 'claude', modelo: 'claude-sonnet-5-5', valido: true });
  });

  it('acepta un alias si la lista trae la versión con fecha, y distingue "sin lista" de "no existe"', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'llave-claude');
    vi.stubEnv('MOTOR_ESTILISMO', 'claude:claude-haiku-4-5');
    vi.stubEnv('MOTOR_CUIDADO', 'claude:claude-inventado');
    const { r, gemini, claude } = nuevoRouter();
    gemini.modelos = [`models/${G.flash}`, `models/${G.lite}`];
    claude.modelos = ['claude-haiku-4-5-20251001'];
    const porAgente = Object.fromEntries((await validarModelos(r)).map((x) => [x.agente, x]));
    expect(porAgente.estilismo).toMatchObject({ valido: true });
    expect(porAgente.cuidado).toMatchObject({ valido: false, motivo: 'no-existe' });

    claude.listarModelos = async () => {
      throw new ErrorProveedor('No se pudo listar los modelos de Claude: authentication_error (HTTP 401)', 'claude', false);
    };
    const sinLista = Object.fromEntries((await validarModelos(r)).map((x) => [x.agente, x]));
    expect(sinLista.estilismo).toMatchObject({ valido: false, motivo: 'sin-lista' });
    expect(sinLista.estilismo.detalle).toContain('401');
  });

  it('en modo simulado todo es válido', async () => {
    vi.stubEnv('MOTOR_MODO', 'simulado');
    const resultado = await validarModelos(new Router());
    expect(resultado).toHaveLength(8);
    expect(resultado.every((x) => x.valido && x.proveedor === 'simulado')).toBe(true);
  });
});

// ------------------------------------------------------------------ costos

describe('estimarCostoUsd', () => {
  it('usa la tabla por modelo exacto', () => {
    expect(estimarCostoUsd('gemini', 'gemini-2.5-flash-lite', 1_000_000, 1_000_000)).toBeCloseTo(0.5, 10);
    expect(estimarCostoUsd('gemini', 'gemini-2.5-flash', 1_000_000, 0)).toBeCloseTo(0.3, 10);
    expect(estimarCostoUsd('gemini', 'gemini-2.5-pro', 0, 1_000_000)).toBeCloseTo(10, 10);
    expect(estimarCostoUsd('claude', 'claude-haiku-4-5', 1_000_000, 1_000_000)).toBeCloseTo(6, 10);
    expect(estimarCostoUsd('claude', 'claude-sonnet-5-5', 1_000_000, 1_000_000)).toBeCloseTo(12, 10);
    expect(estimarCostoUsd('claude', 'claude-opus-5-5', 1_000_000, 1_000_000)).toBeCloseTo(24, 10);
  });

  it('deduce la familia de modelos Gemini por el nombre', () => {
    expect(estimarCostoUsd('gemini', 'gemini-3.0-flash-lite-preview', 1_000_000, 0)).toBeCloseTo(TABLA_PRECIOS['gemini-2.5-flash-lite'].entrada, 10);
    expect(estimarCostoUsd('gemini', 'gemini-3.0-flash', 1_000_000, 0)).toBeCloseTo(TABLA_PRECIOS['gemini-2.5-flash'].entrada, 10);
    expect(estimarCostoUsd('gemini', 'gemini-3.0-pro', 1_000_000, 0)).toBeCloseTo(TABLA_PRECIOS['gemini-2.5-pro'].entrada, 10);
  });

  it('devuelve 0 para modelos desconocidos y para el simulado', () => {
    expect(estimarCostoUsd('gemini', 'modelo-misterioso', 1000, 1000)).toBe(0);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('modelo-misterioso'));
    expect(estimarCostoUsd('simulado', 'simulado', 1000, 1000)).toBe(0);
  });
});
