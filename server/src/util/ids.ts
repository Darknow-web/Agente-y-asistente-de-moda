import { randomBytes } from 'node:crypto';

/** Identificador corto, seguro para URLs y Firestore. */
export function nuevoId(prefijo = ''): string {
  const cuerpo = randomBytes(9).toString('base64url');
  return prefijo ? `${prefijo}_${cuerpo}` : cuerpo;
}

export function ahora(): string {
  return new Date().toISOString();
}

/** YYYY-MM-DD en la zona horaria dada (por defecto Lima). */
export function fechaLocal(fecha = new Date(), zona = 'America/Lima'): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const g = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/** Lunes de la semana de una fecha YYYY-MM-DD. */
export function lunesDe(fechaISO: string): string {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  const dia = d.getUTCDay(); // 0 domingo
  const desplazamiento = dia === 0 ? -6 : 1 - dia;
  d.setUTCDate(d.getUTCDate() + desplazamiento);
  return d.toISOString().slice(0, 10);
}

export function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export function nombreDia(fechaISO: string): string {
  return DIAS[new Date(`${fechaISO}T12:00:00Z`).getUTCDay()];
}
