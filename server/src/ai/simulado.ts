/**
 * PROVEEDOR SIMULADO — responde sin red ni llaves.
 *
 * Se usa con MOTOR_MODO=simulado (desarrollar sin gastar) y en las pruebas automáticas.
 * Devuelve un texto determinista que repite lo último que dijo el usuario. Si el último
 * texto del usuario contiene `usa:<nombreHerramienta>` y esa herramienta existe,
 * emite una llamada a herramienta con argumentos vacíos (así se prueban los bucles de tools).
 */

import type {
  Capacidades,
  LLMProvider,
  OpcionesGenerar,
  ParteLlamadaHerramienta,
  Respuesta,
} from './provider.js';
import { soloTexto } from './provider.js';

export const MODELO_SIMULADO = 'simulado';

export class ProveedorSimulado implements LLMProvider {
  readonly nombre = 'simulado' as const;
  private contadorLlamadas = 0;

  capacidades(): Capacidades {
    return { imagen: true, video: true, busquedaWeb: true, herramientas: true, jsonEstructurado: true };
  }

  async listarModelos(): Promise<string[]> {
    return [MODELO_SIMULADO];
  }

  async generar(modelo: string, opciones: OpcionesGenerar): Promise<Respuesta> {
    const ultimoUsuario = [...opciones.mensajes].reverse().find((m) => m.rol === 'usuario');
    const textoUsuario = ultimoUsuario ? soloTexto(ultimoUsuario) : '';

    // ¿Pidió explícitamente una herramienta? (token `usa:nombre`)
    const llamadasHerramienta: ParteLlamadaHerramienta[] = [];
    const pedida = /usa:([\w-]+)/.exec(textoUsuario)?.[1];
    if (pedida && opciones.herramientas?.some((h) => h.nombre === pedida)) {
      this.contadorLlamadas += 1;
      llamadasHerramienta.push({
        tipo: 'llamada-herramienta',
        idLlamada: `simulada-${this.contadorLlamadas}`,
        nombre: pedida,
        argumentos: {},
      });
    }

    let texto: string;
    if (llamadasHerramienta.length) {
      texto = '';
    } else if (opciones.esquemaJson) {
      // Un JSON mínimo válido: cada propiedad del esquema con un valor de relleno.
      texto = JSON.stringify(jsonDeRelleno(opciones.esquemaJson, textoUsuario));
    } else {
      texto = `[SIMULADO] Recibí: "${textoUsuario.trim() || '(sin texto)'}". Esta es una respuesta de prueba sin motor real.`;
    }

    if (opciones.onTexto && texto) opciones.onTexto(texto);

    const tokensEntrada = estimarTokens(opciones.sistema) + opciones.mensajes.reduce((n, m) => n + estimarTokens(soloTexto(m)), 0);
    return {
      texto,
      llamadasHerramienta,
      fuentes: opciones.buscarWeb ? [{ titulo: 'Fuente simulada', url: 'https://ejemplo.invalid/simulado' }] : undefined,
      uso: { tokensEntrada, tokensSalida: estimarTokens(texto) },
      proveedor: 'simulado',
      modelo: modelo || MODELO_SIMULADO,
      motivoFin: llamadasHerramienta.length ? 'herramienta' : 'fin',
    };
  }
}

/** Aproximación grosera: ~4 caracteres por token. Solo para que los registros no queden en cero. */
function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 4);
}

function jsonDeRelleno(esquema: Record<string, unknown>, textoUsuario: string): unknown {
  const tipo = esquema.type;
  if (tipo === 'object') {
    const props = (esquema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const salida: Record<string, unknown> = {};
    for (const [clave, sub] of Object.entries(props)) salida[clave] = jsonDeRelleno(sub, textoUsuario);
    return salida;
  }
  if (tipo === 'array') return [];
  if (tipo === 'number' || tipo === 'integer') return 0;
  if (tipo === 'boolean') return true;
  if (Array.isArray(esquema.enum) && esquema.enum.length) return esquema.enum[0];
  return `[SIMULADO] ${textoUsuario.slice(0, 60)}`;
}
