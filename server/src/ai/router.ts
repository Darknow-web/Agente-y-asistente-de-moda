/**
 * ROUTER DE MOTORES — decide qué proveedor y modelo usa cada agente y ejecuta la llamada.
 *
 * Orden de decisión (resolverMotor):
 *  1. MOTOR_MODO=simulado → todo va al proveedor simulado (sin red).
 *  2. Variable MOTOR_<AGENTE>=proveedor:modelo (modelo = nivel lite|flash|pro o un id exacto).
 *  3. server/src/config/modelos.json (proveedor + nivel; nivelDiario / nivelBusqueda por variante).
 *  4. Si el proveedor es Claude y no hay ANTHROPIC_API_KEY → cae a Gemini con el mismo nivel (aviso una vez).
 *
 * Al generar (Router.generar):
 *  - Si el mensaje trae video y el proveedor no lo soporta → se re-enruta a Gemini (mismo nivel).
 *  - Si el proveedor falla con un error recuperable → se reintenta una vez (800 ms) y, si era
 *    Claude, se cae a Gemini; si era Gemini, se prueba una vez con el modelo de respaldo de otro nivel
 *    (flash → lite, pro → flash, lite → flash).
 *  - Se calcula el costo estimado y se avisa al gancho `onUso` (registro de uso para Firestore).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { NombreAgente, RegistroUso } from '../../../shared/types.js';
import { leerLimites } from '../config/limites.js';
import { ProveedorClaude } from './claude.js';
import { estimarCostoUsd } from './costos.js';
import { ProveedorGemini } from './gemini.js';
import {
  ErrorProveedor,
  tieneVideo,
  type LLMProvider,
  type OpcionesGenerar,
  type Proveedor,
  type Respuesta,
} from './provider.js';
import { MODELO_SIMULADO, ProveedorSimulado } from './simulado.js';

// ------------------------------------------------------------------ tipos de configuración

export type Nivel = 'lite' | 'flash' | 'pro';
export type Variante = 'diario' | 'busqueda';
export type ProveedorReal = Exclude<Proveedor, 'simulado'>;

export interface ConfigAgente {
  proveedor: ProveedorReal;
  nivel: Nivel;
  /** Nivel más barato para tareas rutinarias (ej. look del día). */
  nivelDiario?: Nivel;
  /** Nivel para llamadas con búsqueda web. */
  nivelBusqueda?: Nivel;
  encendido?: boolean;
}

export interface ConfigModelos {
  gemini: Record<Nivel, string>;
  claude: Record<Nivel, string>;
  agentes: Record<NombreAgente, ConfigAgente>;
}

/**
 * A qué nivel de Gemini se cae cuando el modelo del nivel pedido está saturado: flash baja a lite
 * (más barato y con más cupo), pro baja a flash y lite sube a flash.
 */
const NIVEL_RESPALDO_GEMINI: Record<Nivel, Nivel> = { flash: 'lite', pro: 'flash', lite: 'flash' };

export interface Motor {
  proveedor: Proveedor;
  modelo: string;
  /** Nivel del que salió el modelo (sirve para caer a otro proveedor "al mismo nivel"). */
  nivel: Nivel;
}

const NIVELES: readonly Nivel[] = ['lite', 'flash', 'pro'];
const PROVEEDORES: readonly Proveedor[] = ['gemini', 'claude', 'simulado'];

function esNivel(valor: string): valor is Nivel {
  return (NIVELES as readonly string[]).includes(valor);
}
function esProveedor(valor: string): valor is Proveedor {
  return (PROVEEDORES as readonly string[]).includes(valor);
}

// ------------------------------------------------------------------ carga de modelos.json

let configEnCache: ConfigModelos | undefined;

/** Quita las claves `_comentario*` de cualquier nivel del JSON. */
function sinComentarios<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map(sinComentarios) as T;
  if (valor && typeof valor === 'object') {
    const limpio: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      if (!clave.startsWith('_comentario')) limpio[clave] = sinComentarios(v);
    }
    return limpio as T;
  }
  return valor;
}

function leerModelosJson(): string {
  // 1) Relativo a este archivo (funciona con tsx desde server/src). 2) Desde la raíz del proyecto (dist compilado).
  const candidatos = [
    new URL('../config/modelos.json', import.meta.url),
    path.resolve(process.cwd(), 'server/src/config/modelos.json'),
  ];
  let ultimoError: unknown;
  for (const ruta of candidatos) {
    try {
      return readFileSync(ruta, 'utf8');
    } catch (error) {
      ultimoError = error;
    }
  }
  throw new Error(`No se encontró server/src/config/modelos.json: ${String(ultimoError)}`);
}

/** Lee y valida modelos.json (con caché). `forzar` vuelve a leerlo del disco. */
export function cargarConfigModelos(forzar = false): ConfigModelos {
  if (configEnCache && !forzar) return configEnCache;
  const crudo = sinComentarios(JSON.parse(leerModelosJson())) as Partial<ConfigModelos>;

  for (const prov of ['gemini', 'claude'] as const) {
    for (const nivel of NIVELES) {
      if (typeof crudo[prov]?.[nivel] !== 'string') {
        throw new Error(`modelos.json: falta "${prov}.${nivel}" (nombre del modelo para ese nivel).`);
      }
    }
  }
  if (!crudo.agentes || typeof crudo.agentes !== 'object') throw new Error('modelos.json: falta la sección "agentes".');
  for (const [agente, cfg] of Object.entries(crudo.agentes) as [string, ConfigAgente][]) {
    if (cfg.proveedor !== 'gemini' && cfg.proveedor !== 'claude') {
      throw new Error(`modelos.json: el agente "${agente}" tiene un proveedor inválido ("${String(cfg.proveedor)}").`);
    }
    for (const campo of ['nivel', 'nivelDiario', 'nivelBusqueda'] as const) {
      const v = cfg[campo];
      if (v !== undefined && !esNivel(v)) {
        throw new Error(`modelos.json: el agente "${agente}" tiene ${campo}="${String(v)}"; debe ser lite | flash | pro.`);
      }
    }
  }
  configEnCache = crudo as ConfigModelos;
  return configEnCache;
}

// ------------------------------------------------------------------ resolución del motor

const agentesAvisadosSinClaude = new Set<string>();

/** Solo para pruebas: olvida los avisos "una vez por agente" y la caché de configuración. */
export function reiniciarEstadoRouter(): void {
  agentesAvisadosSinClaude.clear();
  configEnCache = undefined;
}

function hayLlave(nombre: 'GEMINI_API_KEY' | 'ANTHROPIC_API_KEY'): boolean {
  return !!process.env[nombre]?.trim();
}

/** Traduce un nivel al nombre real del modelo según el proveedor. */
export function modeloDeNivel(proveedor: Proveedor, nivel: Nivel, config = cargarConfigModelos()): string {
  if (proveedor === 'simulado') return MODELO_SIMULADO;
  return config[proveedor][nivel];
}

/** Intenta deducir el nivel de un id exacto de modelo (para caer a otro proveedor al mismo nivel). */
function nivelDeModelo(proveedor: ProveedorReal, modelo: string, config: ConfigModelos): Nivel | undefined {
  return NIVELES.find((n) => config[proveedor][n] === modelo);
}

/** Interpreta `MOTOR_<AGENTE>=proveedor:modelo`. Devuelve undefined si no hay override válido. */
export function leerOverrideEntorno(agente: NombreAgente, config: ConfigModelos): Motor | undefined {
  const clave = `MOTOR_${agente.toUpperCase()}`;
  const valor = process.env[clave]?.trim();
  if (!valor) return undefined;

  const [provCrudo, ...resto] = valor.split(':');
  const proveedor = provCrudo.trim().toLowerCase();
  const modeloCrudo = resto.join(':').trim();
  if (!esProveedor(proveedor)) {
    console.warn(`[router] ${clave}="${valor}" tiene un proveedor desconocido; se ignora. Usa gemini | claude | simulado.`);
    return undefined;
  }
  if (proveedor === 'simulado') return { proveedor, modelo: MODELO_SIMULADO, nivel: 'flash' };
  if (!modeloCrudo) {
    console.warn(`[router] ${clave}="${valor}" no indica modelo; formato esperado proveedor:modelo. Se ignora.`);
    return undefined;
  }
  if (esNivel(modeloCrudo)) return { proveedor, modelo: config[proveedor][modeloCrudo], nivel: modeloCrudo };
  return { proveedor, modelo: modeloCrudo, nivel: nivelDeModelo(proveedor, modeloCrudo, config) ?? 'flash' };
}

/**
 * Decide proveedor + modelo para un agente (y variante opcional).
 * Nunca hace red. Si el resultado es Gemini sin GEMINI_API_KEY, lo devuelve igual: /api/salud lo reporta.
 */
export function resolverMotor(agente: NombreAgente, variante?: Variante): Motor {
  if (process.env.MOTOR_MODO?.trim().toLowerCase() === 'simulado') {
    return { proveedor: 'simulado', modelo: MODELO_SIMULADO, nivel: 'flash' };
  }
  const config = cargarConfigModelos();

  let motor = leerOverrideEntorno(agente, config);
  if (!motor) {
    const cfg = config.agentes[agente];
    if (!cfg) throw new Error(`modelos.json: no hay configuración para el agente "${agente}".`);
    let nivel = cfg.nivel;
    if (variante === 'diario' && cfg.nivelDiario) nivel = cfg.nivelDiario;
    if (variante === 'busqueda' && cfg.nivelBusqueda) nivel = cfg.nivelBusqueda;
    motor = { proveedor: cfg.proveedor, modelo: config[cfg.proveedor][nivel], nivel };
  }

  if (motor.proveedor === 'claude' && !hayLlave('ANTHROPIC_API_KEY')) {
    if (!agentesAvisadosSinClaude.has(agente)) {
      agentesAvisadosSinClaude.add(agente);
      console.warn(
        `[router] El agente "${agente}" está configurado con Claude pero falta ANTHROPIC_API_KEY; usa Gemini (${config.gemini[motor.nivel]}).`,
      );
    }
    motor = { proveedor: 'gemini', modelo: config.gemini[motor.nivel], nivel: motor.nivel };
  }
  return motor;
}

// ------------------------------------------------------------------ Router

export interface ResultadoGenerar {
  respuesta: Respuesta;
  costoUsd: number;
}

export type GanchoUso = (registro: Omit<RegistroUso, 'id'>) => Promise<void> | void;

export class Router {
  private readonly proveedores = new Map<Proveedor, LLMProvider>();
  /** Gancho opcional para registrar el uso (p. ej. en Firestore). */
  onUso?: GanchoUso;
  /** Espera antes del único reintento. Las pruebas lo ponen en 0. */
  esperaReintentoMs = 800;

  /** Registra (o reemplaza) la instancia de un proveedor. Útil en pruebas para inyectar dobles. */
  registrarProveedor(nombre: Proveedor, instancia: LLMProvider): void {
    this.proveedores.set(nombre, instancia);
  }

  /** Devuelve el proveedor, creándolo perezosamente con las llaves del entorno. */
  obtenerProveedor(nombre: Proveedor): LLMProvider {
    const existente = this.proveedores.get(nombre);
    if (existente) return existente;

    let instancia: LLMProvider;
    switch (nombre) {
      case 'gemini':
        instancia = new ProveedorGemini(process.env.GEMINI_API_KEY?.trim() ?? '');
        break;
      case 'claude':
        instancia = new ProveedorClaude(process.env.ANTHROPIC_API_KEY?.trim() ?? '');
        break;
      case 'simulado':
        instancia = new ProveedorSimulado();
        break;
    }
    this.proveedores.set(nombre, instancia);
    return instancia;
  }

  /** ¿Hay llave para el proveedor? (simulado siempre está disponible). */
  proveedorDisponible(nombre: Proveedor): boolean {
    if (nombre === 'simulado') return true;
    if (this.proveedores.has(nombre)) return true; // inyectado (pruebas) o ya creado
    return nombre === 'gemini' ? hayLlave('GEMINI_API_KEY') : hayLlave('ANTHROPIC_API_KEY');
  }

  async generar(agente: NombreAgente, opciones: OpcionesGenerar, variante?: Variante): Promise<ResultadoGenerar> {
    let motor = resolverMotor(agente, variante);

    // Video: si el proveedor no lo soporta, re-enrutamos a Gemini al mismo nivel.
    if (motor.proveedor !== 'gemini' && tieneVideo(opciones.mensajes)) {
      const capacidades = this.obtenerProveedor(motor.proveedor).capacidades();
      if (!capacidades.video) {
        const modeloGemini = modeloDeNivel('gemini', motor.nivel);
        console.warn(`[router] "${agente}" recibió video y ${motor.proveedor} no lo procesa; se usa Gemini (${modeloGemini}).`);
        motor = { proveedor: 'gemini', modelo: modeloGemini, nivel: motor.nivel };
      }
    }

    let respuesta: Respuesta;
    try {
      respuesta = await this.generarConReintento(motor, opciones);
    } catch (error) {
      if (!(error instanceof ErrorProveedor) || !error.recuperable || opciones.senal?.aborted) throw error;
      if (motor.proveedor === 'claude') {
        // Claude agotó su reintento con un error recuperable → caemos a Gemini al mismo nivel.
        const modeloGemini = modeloDeNivel('gemini', motor.nivel);
        console.warn(`[router] Claude falló dos veces para "${agente}" (${error.message}); se cae a Gemini (${modeloGemini}).`);
        motor = { proveedor: 'gemini', modelo: modeloGemini, nivel: motor.nivel };
        respuesta = await this.generarConReintento(motor, opciones);
      } else if (motor.proveedor === 'gemini') {
        // Un modelo de Gemini saturado (503) o que no responde → un intento con el modelo de respaldo
        // de otro nivel, para que un pico de demanda en un modelo no deje al cliente sin respuesta.
        const nivelRespaldo = NIVEL_RESPALDO_GEMINI[motor.nivel];
        const modeloRespaldo = modeloDeNivel('gemini', nivelRespaldo);
        if (modeloRespaldo === motor.modelo) throw error;
        console.warn(`[router] Gemini ${motor.modelo} falló dos veces para "${agente}" (${error.message}); se prueba ${modeloRespaldo}.`);
        motor = { proveedor: 'gemini', modelo: modeloRespaldo, nivel: nivelRespaldo };
        respuesta = await this.generarConTiempoMax(motor, opciones);
      } else {
        throw error;
      }
    }

    const costoUsd = estimarCostoUsd(respuesta.proveedor, respuesta.modelo, respuesta.uso.tokensEntrada, respuesta.uso.tokensSalida);
    if (this.onUso) {
      try {
        await this.onUso({
          agente,
          proveedor: respuesta.proveedor,
          modelo: respuesta.modelo,
          tokensEntrada: respuesta.uso.tokensEntrada,
          tokensSalida: respuesta.uso.tokensSalida,
          costoEstimadoUsd: costoUsd,
          fecha: new Date().toISOString(),
        });
      } catch (error) {
        console.warn('[router] No se pudo registrar el uso:', error);
      }
    }
    return { respuesta, costoUsd };
  }

  /** Llama al proveedor; si el error es recuperable, espera y reintenta UNA vez. */
  private async generarConReintento(motor: Motor, opciones: OpcionesGenerar): Promise<Respuesta> {
    try {
      return await this.generarConTiempoMax(motor, opciones);
    } catch (error) {
      if (!(error instanceof ErrorProveedor) || !error.recuperable || opciones.senal?.aborted) throw error;
      console.warn(`[router] ${motor.proveedor}/${motor.modelo} falló (${error.message}); reintentando una vez…`);
      if (this.esperaReintentoMs > 0) await new Promise((r) => setTimeout(r, this.esperaReintentoMs));
      return await this.generarConTiempoMax(motor, opciones);
    }
  }

  /**
   * Una llamada al proveedor con tiempo máximo (limites.json → segundosMaxPorLlamadaIA). Sin esto, un
   * motor saturado puede dejar la petición abierta para siempre y el chat "colgado". Al vencer el
   * tiempo se lanza un error recuperable: se reintenta una vez y, si era Claude, se cae a Gemini.
   */
  private async generarConTiempoMax(motor: Motor, opciones: OpcionesGenerar): Promise<Respuesta> {
    const proveedor = this.obtenerProveedor(motor.proveedor);
    const segundos = leerLimites().segundosMaxPorLlamadaIA;
    if (!(segundos > 0)) return proveedor.generar(motor.modelo, opciones);
    const tiempo = AbortSignal.timeout(segundos * 1000);
    const senal = opciones.senal ? AbortSignal.any([opciones.senal, tiempo]) : tiempo;
    try {
      return await proveedor.generar(motor.modelo, { ...opciones, senal });
    } catch (error) {
      if (tiempo.aborted && !opciones.senal?.aborted) {
        throw new ErrorProveedor(`${motor.proveedor}/${motor.modelo} no respondió en ${segundos} s`, motor.proveedor, true, error);
      }
      throw error;
    }
  }
}

/** Instancia compartida por toda la app. */
export const router = new Router();

// ------------------------------------------------------------------ validación de modelos (salud y smoke)

export interface ValidacionModelo {
  agente: NombreAgente;
  proveedor: Proveedor;
  modelo: string;
  valido: boolean;
}

export const NOMBRES_AGENTES: readonly NombreAgente[] = [
  'director',
  'guardarropa',
  'estilismo',
  'planificacion',
  'cuidado',
  'compras',
  'probador',
  'calidad',
];

/**
 * Comprueba que el modelo resuelto de cada agente existe en su proveedor.
 * Solo consulta a los proveedores que tienen llave (o están inyectados); si un proveedor no
 * responde, sus modelos se marcan como no válidos.
 */
export async function validarModelos(instancia: Router = router): Promise<ValidacionModelo[]> {
  const motores = NOMBRES_AGENTES.map((agente) => ({ agente, motor: resolverMotor(agente) }));
  const proveedoresUsados = [...new Set(motores.map((m) => m.motor.proveedor))];

  const listas = new Map<Proveedor, Set<string> | null>();
  await Promise.all(
    proveedoresUsados.map(async (prov) => {
      if (prov === 'simulado' || !instancia.proveedorDisponible(prov)) {
        listas.set(prov, null);
        return;
      }
      try {
        const modelos = await instancia.obtenerProveedor(prov).listarModelos();
        listas.set(prov, new Set(modelos.map((m) => m.replace(/^models\//, ''))));
      } catch (error) {
        console.warn(`[router] No se pudo listar los modelos de ${prov}:`, error instanceof Error ? error.message : error);
        listas.set(prov, null);
      }
    }),
  );

  return motores.map(({ agente, motor }) => {
    let valido = false;
    if (motor.proveedor === 'simulado') valido = true;
    else {
      const lista = listas.get(motor.proveedor);
      valido = !!lista && lista.has(motor.modelo.replace(/^models\//, ''));
    }
    return { agente, proveedor: motor.proveedor, modelo: motor.modelo, valido };
  });
}
