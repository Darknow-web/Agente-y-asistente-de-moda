import { describe, expect, it } from 'vitest';
import { leerCuentaServicio } from './admin.js';

const LLAVE = '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n';
const json = JSON.stringify({ type: 'service_account', project_id: 'proyecto-x', client_email: 'firebase-adminsdk@proyecto-x.iam.gserviceaccount.com', private_key: LLAVE });

describe('leerCuentaServicio', () => {
  it('acepta el JSON tal cual', () => {
    const c = leerCuentaServicio(json);
    expect(c.clientEmail).toContain('firebase-adminsdk');
    expect(c.privateKey).toBe(LLAVE);
    expect(c.projectId).toBe('proyecto-x');
  });

  it('acepta el JSON en base64', () => {
    expect(leerCuentaServicio(Buffer.from(json).toString('base64')).privateKey).toBe(LLAVE);
  });

  it('repara los saltos de línea guardados como \\n literales', () => {
    const escapado = json.replace(/\\n/g, '\\\\n');
    expect(leerCuentaServicio(escapado).privateKey).toBe(LLAVE);
  });

  it('explica el error si el valor no sirve', () => {
    expect(() => leerCuentaServicio('no es json')).toThrow(/no es un JSON válido/);
    expect(() => leerCuentaServicio('{"project_id":"x"}')).toThrow(/client_email y private_key/);
  });
});
