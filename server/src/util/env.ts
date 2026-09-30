/**
 * Carga de variables de entorno sin dependencias externas.
 * En Cloud Run llegan ya definidas; en local se leen de .env si existe.
 */
import fs from 'node:fs';
import path from 'node:path';

let cargado = false;

export function cargarEnv(): void {
  if (cargado) return;
  cargado = true;
  const candidatos = [path.resolve(process.cwd(), '.env')];
  for (const archivo of candidatos) {
    if (!fs.existsSync(archivo)) continue;
    const texto = fs.readFileSync(archivo, 'utf8');
    for (const lineaCruda of texto.split(/\r?\n/)) {
      const linea = lineaCruda.trim();
      if (!linea || linea.startsWith('#')) continue;
      const i = linea.indexOf('=');
      if (i < 0) continue;
      const clave = linea.slice(0, i).trim();
      let valor = linea.slice(i + 1).trim();
      if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
        valor = valor.slice(1, -1);
      }
      if (process.env[clave] === undefined) process.env[clave] = valor;
    }
  }
}

export function env(nombre: string, porDefecto = ''): string {
  const v = process.env[nombre];
  return v === undefined || v === '' ? porDefecto : v;
}

export function esProduccion(): boolean {
  return env('NODE_ENV') === 'production';
}

export function adminEmails(): string[] {
  return env('ADMIN_EMAILS')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
