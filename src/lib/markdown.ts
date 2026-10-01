/**
 * Lector mínimo de Markdown para lo que escriben los agentes en el chat: negritas, cursivas,
 * títulos, listas y párrafos. Sin HTML ni enlaces en crudo: todo se convierte a bloques seguros
 * que el componente <Texto> pinta con el estilo de SASTRA.
 */

export type Tramo = { tipo: 'texto' | 'negrita' | 'cursiva'; texto: string };

export type Bloque =
  | { tipo: 'parrafo'; tramos: Tramo[] }
  | { tipo: 'titulo'; tramos: Tramo[] }
  | { tipo: 'lista'; ordenada: boolean; items: Tramo[][] };

/** Divide una línea en tramos de texto, **negrita** y *cursiva* (o _cursiva_). */
export function tramosDe(linea: string): Tramo[] {
  const tramos: Tramo[] = [];
  const re = /\*\*(.+?)\*\*|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])|(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])/g;
  let ultimo = 0;
  for (const m of linea.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > ultimo) tramos.push({ tipo: 'texto', texto: linea.slice(ultimo, i) });
    if (m[1] !== undefined) tramos.push({ tipo: 'negrita', texto: m[1] });
    else tramos.push({ tipo: 'cursiva', texto: m[2] ?? m[3] ?? '' });
    ultimo = i + m[0].length;
  }
  if (ultimo < linea.length) tramos.push({ tipo: 'texto', texto: linea.slice(ultimo) });
  return tramos.length ? tramos : [{ tipo: 'texto', texto: '' }];
}

const RE_TITULO = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const RE_ITEM = /^\s{0,3}(?:[-*•]|\d{1,2}[.)])\s+(.*)$/;
const RE_ORDENADO = /^\s{0,3}\d{1,2}[.)]\s+/;
const RE_SEPARADOR = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;

/** Convierte el texto en bloques. Las líneas seguidas forman un párrafo; una línea vacía lo cierra. */
export function bloquesDe(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let parrafo: string[] = [];
  let lista: { ordenada: boolean; items: Tramo[][] } | null = null;

  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push({ tipo: 'parrafo', tramos: tramosDe(parrafo.join('\n')) });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista) bloques.push({ tipo: 'lista', ...lista });
    lista = null;
  };

  for (const cruda of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const linea = cruda.trimEnd();
    if (!linea.trim() || RE_SEPARADOR.test(linea)) {
      cerrarParrafo();
      cerrarLista();
      continue;
    }
    const titulo = RE_TITULO.exec(linea);
    if (titulo) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: 'titulo', tramos: tramosDe(titulo[1] ?? '') });
      continue;
    }
    const item = RE_ITEM.exec(linea);
    if (item) {
      cerrarParrafo();
      const ordenada = RE_ORDENADO.test(linea);
      if (!lista || lista.ordenada !== ordenada) {
        cerrarLista();
        lista = { ordenada, items: [] };
      }
      lista.items.push(tramosDe(item[1] ?? ''));
      continue;
    }
    if (lista && /^\s{2,}/.test(cruda)) {
      // Continuación de un elemento de lista (sangrado)
      const actual = lista.items[lista.items.length - 1];
      if (actual) actual.push({ tipo: 'texto', texto: ' ' }, ...tramosDe(linea.trim()));
      continue;
    }
    cerrarLista();
    parrafo.push(linea.trim());
  }
  cerrarParrafo();
  cerrarLista();
  return bloques;
}

/** Texto plano sin marcas (para títulos, resúmenes o notificaciones). */
export function sinMarcas(texto: string): string {
  return bloquesDe(texto)
    .map((b) => (b.tipo === 'lista' ? b.items.map((it) => it.map((t) => t.texto).join('')).join('\n') : b.tramos.map((t) => t.texto).join('')))
    .join('\n');
}
