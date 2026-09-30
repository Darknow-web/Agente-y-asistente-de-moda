/** Utilidades de fecha en español y hora local. */

const LOCALE = 'es-PE';

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** YYYY-MM-DD en hora local. */
export function aFechaISO(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Convierte YYYY-MM-DD a Date local (mediodía, para evitar saltos de zona). */
export function desdeFechaISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

export function hoyISO(): string {
  return aFechaISO(new Date());
}

/** Lunes de la semana de `fecha` (hora local). */
export function lunesDeSemana(fecha = new Date()): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12);
  const dia = d.getDay(); // 0 = domingo
  const resta = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - resta);
  return d;
}

export function sumarDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

/** "Martes 30 de septiembre" */
export function fechaLarga(fecha = new Date()): string {
  const texto = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })
    .format(fecha)
    .replace(',', '');
  return capitalizar(texto);
}

/** "12 de septiembre" o "12 de septiembre de 2025" si es otro año. */
export function fechaMedia(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const mismoAno = fecha.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    ...(mismoAno ? {} : { year: 'numeric' }),
  }).format(fecha);
}

/** "Lun", "Mar"… */
export function diaCorto(fecha: Date): string {
  const texto = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }).format(fecha).replace('.', '');
  return capitalizar(texto.slice(0, 3));
}

/** "29 sep – 5 oct" */
export function rangoSemana(lunes: Date): string {
  const domingo = sumarDias(lunes, 6);
  const f = (d: Date) =>
    new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' }).format(d).replace('.', '');
  return `${f(lunes)} – ${f(domingo)}`;
}

/** "hace 5 min", "ayer", "12 sep" */
export function relativo(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const diff = Date.now() - fecha.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' }).format(fecha).replace('.', '');
}

export const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
