import { beforeEach, describe, expect, it } from 'vitest';
import { ejecutarAgente, extraerJson, mensajeUsuario, sistemaDe } from './base.js';
import { reiniciarEstadoRouter } from '../ai/router.js';
import type { ContextoCliente } from '../memory/contexto.js';

const ctx: ContextoCliente = {
  uid: 'prueba',
  perfil: { nombre: 'Valeria', ciudad: 'Lima', estilo: ['minimalista'] },
  prendas: [
    {
      id: 'p_1',
      nombre: 'Camisa blanca de lino',
      categoria: 'superior',
      colores: ['blanco'],
      estado: 'limpia',
      usosDesdeLavado: 0,
      usosMaxAntesDeLavar: 2,
      creadaEn: '2026-01-01T00:00:00Z',
      actualizadaEn: '2026-01-01T00:00:00Z',
    },
  ],
  hoy: '2026-09-30',
  zona: 'America/Lima',
};

describe('agentes (modo simulado)', () => {
  beforeEach(() => {
    process.env.MOTOR_MODO = 'simulado';
    reiniciarEstadoRouter();
  });

  it('compone el sistema con propósito, rol y contexto del cliente', () => {
    const s = sistemaDe('director', ctx);
    expect(s).toContain('SASTRA');
    expect(s).toContain('Dirección Creativa');
    expect(s).toContain('Camisa blanca de lino');
    expect(s).toContain('Valeria');
  });

  it('ejecuta el bucle de herramientas y devuelve el resultado al modelo', async () => {
    const llamadas: string[] = [];
    const r = await ejecutarAgente({
      agente: 'director',
      ctx,
      mensajes: [mensajeUsuario('Hola, usa:listar_prendas por favor')],
      herramientas: [
        { nombre: 'listar_prendas', descripcion: 'lista', parametros: { type: 'object', properties: {} } },
      ],
      ejecutar: async (nombre) => {
        llamadas.push(nombre);
        return [{ id: 'p_1' }];
      },
      maxVueltas: 3,
    });
    expect(llamadas).toEqual(['listar_prendas']);
    expect(r.herramientasUsadas).toEqual(['listar_prendas']);
    expect(r.vueltas).toBeGreaterThanOrEqual(2);
    expect(r.texto).toContain('[SIMULADO]');
    expect(r.proveedor).toBe('simulado');
  });

  it('extrae JSON aunque venga envuelto en texto o en bloque de código', () => {
    expect(extraerJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extraerJson('Aquí va: {"aprobado": true, "notas": []} gracias')).toEqual({ aprobado: true, notas: [] });
    expect(extraerJson('nada')).toBeNull();
  });
});
