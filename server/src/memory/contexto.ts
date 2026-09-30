/**
 * Contexto compacto del cliente que se inyecta a los agentes:
 * perfil resumido, armario en tabla corta (sin fotos), fecha y clima.
 * Mantenerlo pequeño es lo que mantiene bajo el costo.
 */
import type { Perfil, Prenda } from '@shared/types.js';
import type { Clima } from '../tools/clima.js';
import { resumenClima } from '../tools/clima.js';
import { nombreDia } from '../util/ids.js';

export interface ContextoCliente {
  uid: string;
  email?: string;
  perfil: Perfil;
  prendas: Prenda[];
  hoy: string; // YYYY-MM-DD
  zona: string;
  clima?: Clima[]; // pronóstico 7 días si hay ciudad
}

export function resumirPerfil(p: Perfil): string {
  const lineas: string[] = [];
  if (p.nombre) lineas.push(`Nombre: ${p.nombre}`);
  if (p.genero) lineas.push(`Género: ${p.genero}`);
  if (p.ciudad) lineas.push(`Ciudad: ${p.ciudad}${p.pais ? ', ' + p.pais : ''}`);
  if (p.tallas) {
    const t = Object.entries(p.tallas)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ');
    if (t) lineas.push(`Tallas: ${t}`);
  }
  if (p.estilo?.length) lineas.push(`Estilo (en sus palabras): ${p.estilo.join(', ')}`);
  if (p.coloresFavoritos?.length) lineas.push(`Colores favoritos: ${p.coloresFavoritos.join(', ')}`);
  if (p.coloresEvitar?.length) lineas.push(`Colores que evita: ${p.coloresEvitar.join(', ')}`);
  if (p.rutina && Object.keys(p.rutina).length) {
    const r = Object.entries(p.rutina)
      .map(([dia, acts]) => `${dia}: ${acts.join(' + ')}`)
      .join('; ');
    lineas.push(`Rutina semanal: ${r}`);
  }
  if (p.presupuestoMensual) lineas.push(`Presupuesto mensual de compras: ${p.presupuestoMensual} ${p.moneda ?? ''}`.trim());
  if (p.aprendizajes?.length) lineas.push(`Lo que sabemos de esta persona: ${p.aprendizajes.slice(-12).join('; ')}`);
  return lineas.length ? lineas.join('\n') : 'Todavía no sabemos casi nada de esta persona. Pregunta con tacto lo esencial (ciudad, rutina, estilo) cuando venga a cuento.';
}

/** Tabla compacta del armario: una línea por prenda. */
export function tablaArmario(prendas: Prenda[], max = 120): string {
  if (!prendas.length) return 'El armario está vacío: aún no ha registrado prendas.';
  const filas = prendas.slice(0, max).map((p) => {
    const usos = `${p.usosDesdeLavado ?? 0}/${p.usosMaxAntesDeLavar ?? '?'}`;
    const extra = [p.tela, p.temporada, p.ocasiones?.join('/'), p.marca].filter(Boolean).join(' · ');
    return `${p.id} | ${p.nombre} | ${p.categoria}${p.subtipo ? '/' + p.subtipo : ''} | ${p.colores.join(', ')} | ${p.estado} (usos ${usos})${extra ? ' | ' + extra : ''}${p.favorita ? ' | favorita' : ''}`;
  });
  const nota = prendas.length > max ? `\n(… y ${prendas.length - max} prendas más; pide la lista completa con la herramienta si hace falta)` : '';
  return `id | nombre | categoría | colores | estado (usos desde lavado / máx) | detalles\n${filas.join('\n')}${nota}`;
}

export function resumirClimaSemana(clima?: Clima[]): string {
  if (!clima?.length) return 'Sin datos de clima (no hay ciudad en el perfil o no se pudo consultar).';
  return clima.map((c) => `${nombreDia(c.fecha)} ${c.fecha}: ${resumenClima(c)}`).join('\n');
}

export function bloqueContexto(ctx: ContextoCliente): string {
  const hoy = `${nombreDia(ctx.hoy)} ${ctx.hoy} (zona ${ctx.zona})`;
  return [
    '## Cliente',
    resumirPerfil(ctx.perfil),
    '',
    `## Hoy: ${hoy}`,
    '',
    '## Clima (próximos días)',
    resumirClimaSemana(ctx.clima),
    '',
    `## Armario (${ctx.prendas.length} prendas)`,
    tablaArmario(ctx.prendas),
  ].join('\n');
}
