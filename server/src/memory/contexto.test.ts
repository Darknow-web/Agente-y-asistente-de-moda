import { describe, expect, it } from 'vitest';
import { resumirPerfil, tablaArmario } from './contexto.js';

describe('contexto compacto', () => {
  it('resume el perfil en líneas legibles', () => {
    const r = resumirPerfil({ nombre: 'Ana', ciudad: 'Lima', pais: 'Perú', estilo: ['minimalista'], rutina: { lunes: ['oficina'] } });
    expect(r).toContain('Nombre: Ana');
    expect(r).toContain('Ciudad: Lima, Perú');
    expect(r).toContain('lunes: oficina');
  });

  it('avisa cuando no sabe nada del cliente', () => {
    expect(resumirPerfil({})).toContain('Todavía no sabemos');
  });

  it('tabla del armario: una línea por prenda con estado y usos', () => {
    const t = tablaArmario([
      {
        id: 'p_1',
        nombre: 'Jean recto',
        categoria: 'inferior',
        colores: ['azul oscuro'],
        estado: 'usada',
        usosDesdeLavado: 2,
        usosMaxAntesDeLavar: 6,
        tela: 'denim',
        creadaEn: '',
        actualizadaEn: '',
      },
    ]);
    expect(t).toContain('p_1 | Jean recto | inferior | azul oscuro | usada (usos 2/6) | denim');
  });

  it('marca lo usado hace poco (para rotar) y lo sin estrenar (para sacarlo)', () => {
    const base = { categoria: 'superior' as const, colores: ['blanco'], estado: 'limpia' as const, usosDesdeLavado: 0, usosMaxAntesDeLavar: 3, actualizadaEn: '' };
    const hace = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
    const t = tablaArmario([
      { ...base, id: 'a', nombre: 'Polo', creadaEn: hace(90), ultimoUso: hace(3), usosTotales: 4 },
      { ...base, id: 'b', nombre: 'Blusa', creadaEn: hace(10) },
    ]);
    expect(t).toContain('a | Polo | superior | blanco | limpia (usos 0/3) | usada hace 3 días');
    expect(t).toContain('b | Blusa | superior | blanco | limpia (usos 0/3) | sin estrenar');
  });

  it('armario vacío', () => {
    expect(tablaArmario([])).toContain('vacío');
  });
});
