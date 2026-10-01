/**
 * Banco de "preguntas del día": una pregunta corta con opciones, de un toque, para completar el
 * perfil sin formularios. Cada respuesta se traduce a campos del perfil o a un aprendizaje.
 */
import type { Perfil, PreguntaPerfil } from '@shared/types.js';

interface Definicion extends PreguntaPerfil {
  /** Solo se pregunta si falta este dato. */
  faltaSi: (p: Perfil) => boolean;
  /** Convierte la respuesta en cambios del perfil. */
  aplicar: (respuesta: string, p: Perfil) => Partial<Perfil>;
}

const opcionesTalla = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const PREGUNTAS: Definicion[] = [
  {
    id: 'ciudad',
    texto: '¿En qué ciudad vives? Así Sastra mira el clima antes de vestirte.',
    opciones: ['Lima', 'Arequipa', 'Trujillo', 'Cusco'],
    permiteTexto: true,
    faltaSi: (p) => !p.ciudad,
    aplicar: (r) => ({ ciudad: r, pais: 'Perú' }),
  },
  {
    id: 'talla-superior',
    texto: '¿Qué talla usas normalmente en camisas y polos?',
    opciones: opcionesTalla,
    permiteTexto: true,
    faltaSi: (p) => !p.tallas?.superior,
    aplicar: (r, p) => ({ tallas: { ...(p.tallas ?? {}), superior: r } }),
  },
  {
    id: 'talla-inferior',
    texto: '¿Y en pantalones o jeans?',
    opciones: ['26', '28', '30', '32', '34', '36'],
    permiteTexto: true,
    faltaSi: (p) => !p.tallas?.inferior,
    aplicar: (r, p) => ({ tallas: { ...(p.tallas ?? {}), inferior: r } }),
  },
  {
    id: 'talla-calzado',
    texto: '¿Qué talla de zapato usas?',
    opciones: ['36', '37', '38', '39', '40', '41', '42', '43'],
    permiteTexto: true,
    faltaSi: (p) => !p.tallas?.calzado,
    aplicar: (r, p) => ({ tallas: { ...(p.tallas ?? {}), calzado: r } }),
  },
  {
    id: 'estatura',
    texto: '¿Cuánto mides, más o menos? Ayuda con largos y proporciones.',
    opciones: ['Menos de 1,55', '1,55 a 1,65', '1,65 a 1,75', '1,75 a 1,85', 'Más de 1,85'],
    faltaSi: (p) => !p.estaturaCm,
    aplicar: (r) => {
      const mapa: Record<string, number> = { 'Menos de 1,55': 152, '1,55 a 1,65': 160, '1,65 a 1,75': 170, '1,75 a 1,85': 180, 'Más de 1,85': 188 };
      const n = mapa[r] ?? Number.parseInt(r.replace(/\D/g, ''), 10);
      return Number.isFinite(n) && n > 100 ? { estaturaCm: n } : {};
    },
  },
  {
    id: 'silueta',
    texto: 'Si tuvieras que describir tu cuerpo en pocas palabras, ¿cuál se parece más?',
    opciones: ['Hombros más anchos que caderas', 'Caderas más anchas que hombros', 'Cintura marcada', 'Más recto, sin curvas marcadas', 'Prefiero no decirlo'],
    faltaSi: (p) => !p.silueta,
    aplicar: (r) => (r === 'Prefiero no decirlo' ? { silueta: 'prefiere no describirlo' } : { silueta: r.toLowerCase() }),
  },
  {
    id: 'marca-habitual',
    texto: '¿Hay una marca donde compres seguido y sepas tu talla? Escríbela así: "Zara M".',
    opciones: [],
    permiteTexto: true,
    faltaSi: (p) => !(p.tallasPorMarca?.length),
    aplicar: (r, p) => {
      const m = r.trim().match(/^(.+?)\s+([A-Za-z0-9/.,]+)$/);
      if (!m) return {};
      const nueva = { marca: m[1]!.trim(), talla: m[2]!.trim() };
      return { tallasPorMarca: [...(p.tallasPorMarca ?? []).filter((t) => t.marca.toLowerCase() !== nueva.marca.toLowerCase()), nueva] };
    },
  },
  {
    id: 'colores-evitar',
    texto: '¿Hay algún color que prefieras no ponerte?',
    opciones: ['Ninguno', 'Amarillo', 'Naranja', 'Rojo', 'Estampados grandes'],
    permiteTexto: true,
    faltaSi: (p) => !(p.coloresEvitar?.length),
    aplicar: (r) => (r === 'Ninguno' ? { coloresEvitar: [] } : { coloresEvitar: [r.toLowerCase()] }),
  },
  {
    id: 'presupuesto',
    texto: '¿Cuánto sueles gastar en ropa al mes? Sastra lo usa para frenar compras que no hacen falta.',
    opciones: ['Menos de S/ 100', 'S/ 100 a 300', 'S/ 300 a 600', 'Más de S/ 600'],
    faltaSi: (p) => p.presupuestoMensual == null,
    aplicar: (r) => {
      const mapa: Record<string, number> = { 'Menos de S/ 100': 80, 'S/ 100 a 300': 200, 'S/ 300 a 600': 450, 'Más de S/ 600': 800 };
      return { presupuestoMensual: mapa[r] ?? 200, moneda: 'PEN' };
    },
  },
  {
    id: 'ocasion-frecuente',
    texto: '¿Para qué te vistes más veces a la semana?',
    opciones: ['Oficina', 'Trabajo en campo o tiendas', 'Estudios', 'Casa', 'Salidas'],
    permiteTexto: true,
    faltaSi: (p) => !p.rutina || Object.keys(p.rutina).length === 0,
    aplicar: (r) => {
      const act = r.toLowerCase();
      const rutina: Perfil['rutina'] = {};
      for (const d of ['lunes', 'martes', 'miércoles', 'jueves', 'viernes']) rutina[d] = [act];
      return { rutina };
    },
  },
  {
    id: 'sentir',
    texto: 'Cuando te vistes bien, ¿cómo quieres sentirte?',
    opciones: ['Cómoda y práctica', 'Elegante', 'Con personalidad', 'Discreta'],
    permiteTexto: true,
    faltaSi: (p) => !(p.estilo?.length),
    aplicar: (r, p) => ({ estilo: [...(p.estilo ?? []), r.toLowerCase()] }),
  },
];

/** La próxima pregunta pendiente para este perfil, o null si no queda ninguna. */
export function proximaPregunta(perfil: Perfil): { pregunta: PreguntaPerfil | null; pendientes: number } {
  const hechas = new Set(perfil.preguntasHechas ?? []);
  const pendientes = PREGUNTAS.filter((q) => !hechas.has(q.id) && q.faltaSi(perfil));
  const [primera] = pendientes;
  return {
    pregunta: primera ? { id: primera.id, texto: primera.texto, opciones: primera.opciones, permiteTexto: primera.permiteTexto } : null,
    pendientes: pendientes.length,
  };
}

/** Cambios del perfil para una respuesta (o solo marcarla como hecha si se salta). */
export function aplicarRespuesta(perfil: Perfil, id: string, respuesta?: string, saltar = false): Partial<Perfil> | null {
  const def = PREGUNTAS.find((q) => q.id === id);
  if (!def) return null;
  const hechas = [...new Set([...(perfil.preguntasHechas ?? []), id])];
  if (saltar || !respuesta?.trim()) return { preguntasHechas: hechas };
  return { ...def.aplicar(respuesta.trim(), perfil), preguntasHechas: hechas };
}
