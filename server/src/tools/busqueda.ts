/**
 * Búsqueda en internet: una llamada aparte al motor con búsqueda web activada
 * (Gemini: Google Search grounding; Claude: web_search), usando la variante "busqueda"
 * del agente de compras. Devuelve un resumen con fuentes.
 */
import { router } from '../ai/router.js';
import type { ContextoCliente } from '../memory/contexto.js';
import { registrarConsumo } from '../data/repos.js';

export async function buscarEnInternet(ctx: ContextoCliente, consulta: string) {
  if (!consulta.trim()) return { error: 'Consulta vacía.' };
  const lugar = [ctx.perfil.ciudad, ctx.perfil.pais].filter(Boolean).join(', ');
  const sistema = [
    'Eres un asistente de compras de moda. Busca en internet y responde SOLO con hechos encontrados en las fuentes:',
    'tiendas (físicas u online) donde se consigue la prenda, precios aproximados con moneda, y enlaces.',
    `El cliente está en ${lugar || 'ubicación desconocida'}; prioriza tiendas que vendan ahí.`,
    'Formato: lista de hasta 6 opciones "Tienda — prenda — precio aprox. — nota", y al final una línea "Rango de precios: …".',
    'Si no encuentras nada fiable, dilo claramente. No inventes precios ni enlaces.',
  ].join(' ');
  const { respuesta, costoUsd } = await router.generar(
    'compras',
    { sistema, mensajes: [{ rol: 'usuario', partes: [{ tipo: 'texto', texto: consulta }] }], buscarWeb: true, maxTokensSalida: 1200 },
    'busqueda',
  );
  await registrarConsumo(ctx.uid, {
    agente: 'compras',
    proveedor: respuesta.proveedor,
    modelo: respuesta.modelo,
    tokensEntrada: respuesta.uso.tokensEntrada,
    tokensSalida: respuesta.uso.tokensSalida,
    costoEstimadoUsd: costoUsd,
    fecha: new Date().toISOString(),
  }).catch(() => undefined);
  return { resumen: respuesta.texto, fuentes: (respuesta.fuentes ?? []).slice(0, 8) };
}
