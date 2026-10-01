/**
 * Base común de los agentes: composición del prompt de sistema, bucle de herramientas
 * y registro de consumo. Cada departamento aporta su prompt.md, su conocimiento.md
 * y sus herramientas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NombreAgente } from '@shared/types.js';
import type {
  Herramienta,
  MensajeModelo,
  Parte,
  ParteLlamadaHerramienta,
  Respuesta,
} from '../ai/provider.js';
import { router, type Variante } from '../ai/router.js';
import { bloqueContexto, type ContextoCliente } from '../memory/contexto.js';
import { registrarConsumo } from '../data/repos.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

function raizAgentes(): string {
  // En desarrollo (tsx) estamos en server/src/agents; en producción el Dockerfile copia
  // server/src/agents junto a server/dist. Probamos ambas.
  const candidatos = [AQUI, path.resolve(process.cwd(), 'server/src/agents')];
  for (const c of candidatos) if (fs.existsSync(path.join(c, 'director'))) return c;
  return AQUI;
}

const cacheTextos = new Map<string, string>();

export function leerTexto(agente: NombreAgente | 'config', archivo: string): string {
  const clave = `${agente}/${archivo}`;
  if (cacheTextos.has(clave)) return cacheTextos.get(clave)!;
  const ruta =
    agente === 'config'
      ? path.resolve(raizAgentes(), '..', 'config', archivo)
      : path.join(raizAgentes(), agente, archivo);
  const texto = fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8') : '';
  cacheTextos.set(clave, texto);
  return texto;
}

export function limpiarCacheTextos(): void {
  cacheTextos.clear();
}

export function sistemaDe(agente: NombreAgente, ctx: ContextoCliente, extra = ''): string {
  const empresa = leerTexto('config', 'empresa.md');
  const prompt = leerTexto(agente, 'prompt.md');
  const conocimiento = leerTexto(agente, 'conocimiento.md');
  return [
    empresa,
    '',
    '# Tu rol',
    prompt,
    conocimiento ? '\n# Conocimiento del departamento\n' + conocimiento : '',
    '',
    '# Contexto del cliente (datos reales, no inventes nada fuera de esto)',
    bloqueContexto(ctx),
    extra ? '\n# Indicaciones adicionales\n' + extra : '',
  ].join('\n');
}

export type EjecutorHerramienta = (nombre: string, argumentos: Record<string, unknown>) => Promise<unknown>;

export interface OpcionesEjecutar {
  agente: NombreAgente;
  ctx: ContextoCliente;
  mensajes: MensajeModelo[];
  herramientas?: Herramienta[];
  ejecutar?: EjecutorHerramienta;
  buscarWeb?: boolean;
  esquemaJson?: Record<string, unknown>;
  variante?: Variante;
  extraSistema?: string;
  maxVueltas?: number;
  temperatura?: number;
  onTexto?: (delta: string) => void;
  /** Se llama cada vez que el modelo pide una herramienta (para eventos de progreso). */
  onHerramienta?: (llamada: ParteLlamadaHerramienta) => void;
  onNuevaVuelta?: () => void;
  senal?: AbortSignal;
}

export interface ResultadoAgente {
  texto: string;
  fuentes: { titulo: string; url: string }[];
  herramientasUsadas: string[];
  costoUsd: number;
  vueltas: number;
  modelo: string;
  proveedor: string;
}

/**
 * Bucle estándar: pide al modelo, ejecuta herramientas, devuelve resultados, repite.
 */
export async function ejecutarAgente(op: OpcionesEjecutar): Promise<ResultadoAgente> {
  const sistema = sistemaDe(op.agente, op.ctx, op.extraSistema);
  const mensajes: MensajeModelo[] = [...op.mensajes];
  const fuentes: { titulo: string; url: string }[] = [];
  const herramientasUsadas: string[] = [];
  let costoUsd = 0;
  let vueltas = 0;
  let ultima: Respuesta | null = null;
  const max = op.maxVueltas ?? 6;

  while (vueltas < max) {
    vueltas++;
    if (vueltas > 1) op.onNuevaVuelta?.();
    const esUltima = vueltas === max;
    const { respuesta, costoUsd: c } = await router.generar(
      op.agente,
      {
        sistema,
        mensajes,
        herramientas: esUltima ? undefined : op.herramientas,
        buscarWeb: op.buscarWeb,
        esquemaJson: op.esquemaJson,
        temperatura: op.temperatura,
        onTexto: op.onTexto,
        senal: op.senal,
      },
      op.variante,
    );
    costoUsd += c;
    ultima = respuesta;
    await registrarConsumo(op.ctx.uid, {
      agente: op.agente,
      proveedor: respuesta.proveedor,
      modelo: respuesta.modelo,
      tokensEntrada: respuesta.uso.tokensEntrada,
      tokensSalida: respuesta.uso.tokensSalida,
      costoEstimadoUsd: c,
      fecha: new Date().toISOString(),
    }).catch(() => undefined);
    if (respuesta.fuentes?.length) fuentes.push(...respuesta.fuentes);

    if (!respuesta.llamadasHerramienta.length || !op.ejecutar) break;

    // Guardar el turno del modelo (texto + llamadas) y ejecutar herramientas
    const partesModelo: Parte[] = [];
    if (respuesta.texto) partesModelo.push({ tipo: 'texto', texto: respuesta.texto });
    partesModelo.push(...respuesta.llamadasHerramienta);
    mensajes.push({ rol: 'modelo', partes: partesModelo });

    const resultados: Parte[] = [];
    for (const llamada of respuesta.llamadasHerramienta) {
      op.onHerramienta?.(llamada);
      herramientasUsadas.push(llamada.nombre);
      try {
        const resultado = await op.ejecutar(llamada.nombre, llamada.argumentos ?? {});
        resultados.push({
          tipo: 'resultado-herramienta',
          idLlamada: llamada.idLlamada,
          nombre: llamada.nombre,
          resultado: resultado ?? { ok: true },
        });
      } catch (e) {
        resultados.push({
          tipo: 'resultado-herramienta',
          idLlamada: llamada.idLlamada,
          nombre: llamada.nombre,
          resultado: { error: e instanceof Error ? e.message : String(e) },
          esError: true,
        });
      }
    }
    mensajes.push({ rol: 'usuario', partes: resultados });
  }

  const vistas = new Set<string>();
  return {
    texto: ultima?.texto ?? '',
    fuentes: fuentes.filter((f) => (vistas.has(f.url) ? false : (vistas.add(f.url), true))),
    herramientasUsadas,
    costoUsd,
    vueltas,
    modelo: ultima?.modelo ?? '',
    proveedor: ultima?.proveedor ?? '',
  };
}

/** Intenta extraer JSON de una respuesta (tolera texto alrededor y bloques ```json). */
export function extraerJson<T = unknown>(texto: string): T | null {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(limpio) as T;
  } catch {
    const i = limpio.indexOf('{');
    const j = limpio.lastIndexOf('}');
    if (i >= 0 && j > i) {
      try {
        return JSON.parse(limpio.slice(i, j + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function mensajeUsuario(texto: string, adjuntos: Parte[] = []): MensajeModelo {
  return { rol: 'usuario', partes: [...adjuntos, { tipo: 'texto', texto }] };
}
