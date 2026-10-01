import { describe, expect, it } from 'vitest';
import { bloquesDe, sinMarcas, tramosDe } from './markdown';

describe('markdown mínimo', () => {
  it('reconoce negritas y cursivas dentro de una línea', () => {
    expect(tramosDe('Ponte la **camisa blanca** con el jean *recto*.')).toEqual([
      { tipo: 'texto', texto: 'Ponte la ' },
      { tipo: 'negrita', texto: 'camisa blanca' },
      { tipo: 'texto', texto: ' con el jean ' },
      { tipo: 'cursiva', texto: 'recto' },
      { tipo: 'texto', texto: '.' },
    ]);
  });

  it('no confunde guiones bajos de identificadores ni multiplicaciones con cursivas', () => {
    expect(tramosDe('prenda_azul_1 y 2 * 3 = 6')).toEqual([{ tipo: 'texto', texto: 'prenda_azul_1 y 2 * 3 = 6' }]);
  });

  it('separa títulos, listas y párrafos', () => {
    const bloques = bloquesDe('## Para hoy\nHace 18°.\n\n- **Camisa** blanca\n- Jean recto\n1. Primero\n2. Segundo\n---\nListo.');
    expect(bloques.map((b) => b.tipo)).toEqual(['titulo', 'parrafo', 'lista', 'lista', 'parrafo']);
    const lista = bloques[2];
    expect(lista.tipo === 'lista' && !lista.ordenada && lista.items.length === 2).toBe(true);
    const ordenada = bloques[3];
    expect(ordenada.tipo === 'lista' && ordenada.ordenada && ordenada.items.length === 2).toBe(true);
  });

  it('une líneas seguidas en un párrafo y una línea vacía lo cierra', () => {
    const bloques = bloquesDe('Primera línea\nsegunda línea\n\nOtro párrafo');
    expect(bloques).toHaveLength(2);
    expect(bloques[0].tipo === 'parrafo' && bloques[0].tramos[0].texto).toBe('Primera línea\nsegunda línea');
  });

  it('quita las marcas para texto plano', () => {
    expect(sinMarcas('### Hoy\n**Camisa** y *jean*\n- uno\n- dos')).toBe('Hoy\nCamisa y jean\nuno\ndos');
  });
});
