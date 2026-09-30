/**
 * PRUEBA DE HUMO — `npm run smoke`
 *
 * Comprueba que las llaves funcionan y que los modelos de modelos.json existen:
 *  1. Carga .env (sin dependencias).
 *  2. Por cada proveedor con llave: lista sus modelos (primeros 30).
 *  3. Muestra el modelo resuelto de cada agente y si es válido.
 *  4. Hace UNA llamada mínima real por proveedor ("Responde solo: ok") con el modelo más barato
 *     y muestra tokens y costo estimado.
 * Sale con código 1 si falta GEMINI_API_KEY (es el motor principal).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { estimarCostoUsd } from '../src/ai/costos.js';
import type { LLMProvider, Proveedor } from '../src/ai/provider.js';
import { NOMBRES_AGENTES, cargarConfigModelos, router, validarModelos, type Nivel } from '../src/ai/router.js';

// ------------------------------------------------------------------ .env sin dotenv

function cargarEnv(): void {
  const ruta = path.resolve(process.cwd(), '.env');
  if (!existsSync(ruta)) return;
  try {
    // Node 20.12+ / 22: cargador nativo.
    const loadEnvFile = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
    if (typeof loadEnvFile === 'function') {
      loadEnvFile.call(process, ruta);
      return;
    }
  } catch {
    // seguimos con el analizador manual
  }
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const igual = limpia.indexOf('=');
    if (igual < 0) continue;
    const clave = limpia.slice(0, igual).trim();
    let valor = limpia.slice(igual + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) valor = valor.slice(1, -1);
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

// ------------------------------------------------------------------ utilidades de impresión

const OK = '✔';
const MAL = '✘';
const AVISO = '⚠';

function titulo(texto: string): void {
  console.log(`\n${texto}\n${'─'.repeat(texto.length)}`);
}

function formatoUsd(n: number): string {
  return `$${n.toFixed(6)} USD`;
}

// ------------------------------------------------------------------ pasos

async function listarModelosDe(nombre: Proveedor, proveedor: LLMProvider): Promise<Set<string> | null> {
  try {
    const modelos = await proveedor.listarModelos();
    console.log(`${OK} ${nombre}: ${modelos.length} modelos disponibles${modelos.length > 30 ? ' (se muestran 30)' : ''}`);
    for (const m of modelos.slice(0, 30)) console.log(`   · ${m}`);
    return new Set(modelos);
  } catch (error) {
    console.log(`${MAL} ${nombre}: no se pudo listar los modelos → ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function llamadaMinima(nombre: Proveedor, proveedor: LLMProvider, modelo: string): Promise<boolean> {
  const inicio = Date.now();
  try {
    const respuesta = await proveedor.generar(modelo, {
      sistema: 'Eres un asistente de pruebas. Responde exactamente lo que se te pide, sin añadir nada.',
      mensajes: [{ rol: 'usuario', partes: [{ tipo: 'texto', texto: 'Responde solo: ok' }] }],
      maxTokensSalida: 50,
    });
    const costo = estimarCostoUsd(nombre, respuesta.modelo, respuesta.uso.tokensEntrada, respuesta.uso.tokensSalida);
    console.log(
      `${OK} ${nombre} (${respuesta.modelo}) respondió en ${Date.now() - inicio} ms: "${respuesta.texto.trim().slice(0, 60)}"`,
    );
    console.log(
      `   tokens: ${respuesta.uso.tokensEntrada} entrada + ${respuesta.uso.tokensSalida} salida · costo estimado ${formatoUsd(costo)} · fin: ${respuesta.motivoFin}`,
    );
    return true;
  } catch (error) {
    console.log(`${MAL} ${nombre} (${modelo}) falló: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main(): Promise<number> {
  cargarEnv();
  console.log('SASTRA · prueba de humo de los motores de IA');

  if (process.env.MOTOR_MODO?.trim().toLowerCase() === 'simulado') {
    console.log(`${AVISO} MOTOR_MODO=simulado: la app no llamará a ningún motor real. Cambia a MOTOR_MODO=real para probar las llaves.`);
  }

  const hayGemini = !!process.env.GEMINI_API_KEY?.trim();
  const hayClaude = !!process.env.ANTHROPIC_API_KEY?.trim();
  let codigoSalida = 0;

  titulo('Llaves');
  console.log(hayGemini ? `${OK} GEMINI_API_KEY presente` : `${MAL} Falta GEMINI_API_KEY (motor principal). Créala en aistudio.google.com/apikey y ponla en .env`);
  console.log(hayClaude ? `${OK} ANTHROPIC_API_KEY presente` : `${AVISO} ANTHROPIC_API_KEY vacía: los agentes configurados con Claude usarán Gemini`);
  if (!hayGemini) codigoSalida = 1;

  const config = cargarConfigModelos();
  const disponibles: Proveedor[] = [];
  if (hayGemini) disponibles.push('gemini');
  if (hayClaude) disponibles.push('claude');

  titulo('Modelos disponibles por proveedor');
  if (!disponibles.length) console.log(`${AVISO} Ningún proveedor con llave; se omite el listado.`);
  for (const nombre of disponibles) await listarModelosDe(nombre, router.obtenerProveedor(nombre));

  titulo('Motor resuelto por agente');
  const validaciones = await validarModelos(router);
  for (const v of validaciones) {
    const estado = v.valido ? OK : MAL;
    const nota = v.valido ? '' : v.proveedor === 'gemini' && !hayGemini ? ' (sin llave)' : ' (no aparece en la lista del proveedor: revisa modelos.json)';
    console.log(`${estado} ${v.agente.padEnd(14)} → ${v.proveedor}:${v.modelo}${nota}`);
  }
  if (validaciones.some((v) => !v.valido && hayGemini && v.proveedor !== 'simulado')) {
    console.log(`${AVISO} Hay agentes con modelos no válidos. La app arrancará igual, pero esas llamadas fallarán.`);
  }
  // Recordatorio de los agentes: solo informativo.
  const faltantes = NOMBRES_AGENTES.filter((a) => !config.agentes[a]);
  if (faltantes.length) console.log(`${AVISO} Agentes sin entrada en modelos.json: ${faltantes.join(', ')}`);

  titulo('Llamada mínima real ("Responde solo: ok")');
  if (!disponibles.length) console.log(`${AVISO} Sin llaves no hay llamadas que probar.`);
  for (const nombre of disponibles) {
    const modeloBarato = config[nombre as 'gemini' | 'claude']['lite' satisfies Nivel];
    const ok = await llamadaMinima(nombre, router.obtenerProveedor(nombre), modeloBarato);
    if (!ok && nombre === 'gemini') codigoSalida = 1;
  }

  console.log(codigoSalida === 0 ? `\n${OK} Todo listo. ¡A vestirse!` : `\n${MAL} Hay problemas que resolver antes de arrancar.`);
  return codigoSalida;
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((error) => {
    console.error(`${MAL} Error inesperado en la prueba de humo:`, error);
    process.exit(1);
  });
