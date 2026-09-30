/** Utilidades compartidas por el chat y el probador. */
import { AGENTES, type NombreAgente } from '@shared/types';

/** Nombre corto del departamento para la interfaz ("Estilismo", "Cuidado"). */
export function nombreDepartamento(agente: NombreAgente): string {
  switch (agente) {
    case 'cuidado':
      return 'Cuidado';
    case 'director':
      return 'Dirección';
    case 'calidad':
      return 'Calidad';
    default:
      return AGENTES[agente]?.titulo ?? agente;
  }
}

/** "A", "A y B", "A, B y C" */
export function unirEs(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/** Departamentos visibles (el director es la voz de Sastra; calidad revisa por dentro). */
export function departamentosVisibles(agentes: Iterable<NombreAgente>): string[] {
  const vistos = new Set<string>();
  for (const a of agentes) {
    if (a === 'director' || a === 'calidad') continue;
    vistos.add(nombreDepartamento(a));
  }
  return [...vistos];
}

export function fraseTrabajando(agentes: Iterable<NombreAgente>): string | null {
  const nombres = departamentosVisibles(agentes);
  if (!nombres.length) return null;
  return `${unirEs(nombres)} ${nombres.length === 1 ? 'está' : 'están'} trabajando`;
}

export function fraseParticiparon(agentes: NombreAgente[] | undefined): string | null {
  const nombres = departamentosVisibles(agentes ?? []);
  if (!nombres.length) return null;
  return `${unirEs(nombres)} ${nombres.length === 1 ? 'participó' : 'participaron'} en esta respuesta`;
}

/** Divide un texto en párrafos por líneas en blanco. */
export function parrafos(texto: string): string[] {
  return texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
