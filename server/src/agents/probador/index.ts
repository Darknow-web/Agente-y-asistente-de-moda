/**
 * Probador: índice de compra. Antes de pagar, una foto de la prenda (o puesta) y el Probador
 * responde, en JSON, cuánto la usaría de verdad: con qué combina, qué ya tiene parecido y qué vacío llena.
 * (El veredicto conversacional llega por el chat, delegado por el Director.)
 */
import type { Adjunto } from '@shared/types.js';
import type { RespIndiceCompra } from '@shared/api.js';
import type { ContextoCliente } from '../../memory/contexto.js';
import { ejecutarAgente, extraerJson, mensajeUsuario } from '../base.js';
import { adjuntoAParte } from '../guardarropa/index.js';

const ESQUEMA = {
  type: 'object',
  properties: {
    indice: { type: 'integer', description: '1 a 10: probabilidad de que la use de verdad en los próximos tres meses' },
    veredicto: { type: 'string', enum: ['comprala', 'pruebate-otra-talla', 'dejala', 'pensarlo'] },
    resumen: { type: 'string', description: 'Dos frases, directas y amables, para el cliente' },
    combinaCon: { type: 'array', items: { type: 'string' }, description: 'Ids reales del armario con los que combina bien' },
    similares: { type: 'array', items: { type: 'string' }, description: 'Ids reales de prendas que ya cumplen ese papel' },
    vacioQueLlena: { type: 'string', description: 'Qué falta en el armario y esta prenda cubriría; vacío si no cubre nada' },
  },
  required: ['indice', 'veredicto', 'resumen', 'combinaCon', 'similares'],
};

export async function indiceCompra(ctx: ContextoCliente, foto: Adjunto, pista?: string): Promise<{ resultado: RespIndiceCompra; costoUsd: number }> {
  const parte = adjuntoAParte(foto);
  if (!parte) throw new Error('La foto no trae datos.');
  const encargo = [
    'El cliente está en una tienda y considera comprar la prenda de la foto.',
    pista ? `Dice: "${pista}".` : '',
    'Calcula un índice de uso probable de 1 a 10 usando SOLO su armario, su estilo, su rutina, su presupuesto y su memoria de ajuste:',
    '- Suma puntos si combina con muchas prendas (lístalas con id real), si llena un vacío claro, si encaja con su rutina.',
    '- Resta puntos si ya tiene prendas que cumplen ese papel (lístalas con id real), si choca con lo que evita, si es para una ocasión que casi no vive.',
    '- Si la foto está puesta, valora también el calce, con la confianza que te den sus tallas por marca y su memoria de ajuste.',
    'Devuelve solo el JSON del esquema.',
  ]
    .filter(Boolean)
    .join('\n');
  const r = await ejecutarAgente({
    agente: 'probador',
    ctx,
    mensajes: [mensajeUsuario(encargo, [parte])],
    esquemaJson: ESQUEMA,
    maxVueltas: 1,
    temperatura: 0.3,
  });
  const json = extraerJson<Partial<RespIndiceCompra>>(r.texto);
  if (!json) throw new Error('No pude evaluar la foto. Prueba con otra más clara o cuéntame qué prenda es.');
  const ids = new Set(ctx.prendas.map((p) => p.id));
  const soloReales = (lista: unknown) => (Array.isArray(lista) ? (lista as string[]).filter((id) => ids.has(id)) : []);
  const indice = Math.min(10, Math.max(1, Math.round(Number(json.indice ?? 5))));
  const veredictos: RespIndiceCompra['veredicto'][] = ['comprala', 'pruebate-otra-talla', 'dejala', 'pensarlo'];
  const resultado: RespIndiceCompra = {
    indice,
    veredicto: veredictos.includes(json.veredicto as RespIndiceCompra['veredicto']) ? (json.veredicto as RespIndiceCompra['veredicto']) : indice >= 7 ? 'comprala' : indice <= 3 ? 'dejala' : 'pensarlo',
    resumen: String(json.resumen ?? '').slice(0, 400),
    combinaCon: soloReales(json.combinaCon),
    similares: soloReales(json.similares),
    vacioQueLlena: json.vacioQueLlena ? String(json.vacioQueLlena).slice(0, 120) : undefined,
  };
  return { resultado, costoUsd: r.costoUsd };
}
