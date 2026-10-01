/**
 * Estilismo: "tres formas de ponértela" para una prenda, con lo que hay en el armario.
 * (El resto del trabajo de Estilismo llega por delegación del Director, ver departamentos.ts.)
 */
import type { FormaDeUso, Prenda } from '@shared/types.js';
import type { ContextoCliente } from '../../memory/contexto.js';
import { ejecutarAgente, extraerJson, mensajeUsuario } from '../base.js';

const ESQUEMA = {
  type: 'object',
  properties: {
    formas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Nombre corto del look, ej. "Oficina con blazer"' },
          prendaIds: { type: 'array', items: { type: 'string' }, description: 'Ids reales de las OTRAS prendas del armario que acompañan' },
          motivo: { type: 'string', description: 'Una frase: por qué funciona (color, proporción, ocasión)' },
          faltaria: { type: 'string', description: 'Si falta una pieza para que funcione del todo, cuál (una sola). Vacío si no falta nada.' },
        },
        required: ['titulo', 'prendaIds', 'motivo'],
      },
    },
  },
  required: ['formas'],
};

export async function formasDeUso(ctx: ContextoCliente, prenda: Prenda): Promise<{ formas: FormaDeUso[]; costoUsd: number }> {
  const encargo = [
    `Propón tres formas distintas de ponerse esta prenda del cliente: ${prenda.nombre} (id ${prenda.id}, ${prenda.categoria}${prenda.subtipo ? '/' + prenda.subtipo : ''}, colores ${prenda.colores.join(', ')}${prenda.tela ? ', ' + prenda.tela : ''}).`,
    'Cada forma debe usar solo prendas reales del armario (ids exactos de la tabla), para ocasiones distintas (por ejemplo trabajo, fin de semana, salida).',
    'Si el armario no da para completar una forma, deja los ids que sí existan y escribe en "faltaria" la única pieza que la completaría.',
    'Respeta el estilo y lo que evita el cliente. Devuelve solo el JSON del esquema.',
  ].join('\n');
  const r = await ejecutarAgente({
    agente: 'estilismo',
    ctx,
    mensajes: [mensajeUsuario(encargo)],
    esquemaJson: ESQUEMA,
    maxVueltas: 1,
    temperatura: 0.7,
  });
  const json = extraerJson<{ formas?: FormaDeUso[] }>(r.texto);
  const ids = new Set(ctx.prendas.map((p) => p.id));
  const formas = (json?.formas ?? [])
    .filter((f) => f && typeof f.titulo === 'string')
    .slice(0, 3)
    .map((f) => ({
      titulo: String(f.titulo).slice(0, 80),
      prendaIds: (Array.isArray(f.prendaIds) ? f.prendaIds : []).filter((id) => ids.has(id) && id !== prenda.id).slice(0, 6),
      motivo: String(f.motivo ?? '').slice(0, 240),
      faltaria: f.faltaria ? String(f.faltaria).slice(0, 80) : undefined,
    }));
  return { formas, costoUsd: r.costoUsd };
}
