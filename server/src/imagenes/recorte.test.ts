import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { ALTO_SALIDA, ANCHO_SALIDA, componerPrenda, encuadreDeMascara, mascaraDesdePrediccion, type Mascara } from './recorte.js';

function mascaraRect(ancho: number, alto: number, x0: number, y0: number, x1: number, y1: number): Mascara {
  const datos = Buffer.alloc(ancho * alto);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) datos[y * ancho + x] = 255;
  return { ancho, alto, datos };
}

describe('encuadreDeMascara', () => {
  it('encuentra el rectángulo de la prenda con margen', () => {
    const e = encuadreDeMascara(mascaraRect(200, 200, 50, 60, 150, 160), 0.1);
    expect(e).not.toBeNull();
    expect(e!.izquierda).toBe(40);
    expect(e!.arriba).toBe(50);
    expect(e!.ancho).toBe(120);
    expect(e!.alto).toBe(120);
    expect(e!.cobertura).toBeCloseTo(0.25, 2);
  });

  it('devuelve null si la máscara está vacía o cubre toda la imagen', () => {
    expect(encuadreDeMascara(mascaraRect(100, 100, 0, 0, 0, 0))).toBeNull();
    expect(encuadreDeMascara(mascaraRect(100, 100, 0, 0, 100, 100))).toBeNull();
    expect(encuadreDeMascara(mascaraRect(100, 100, 0, 0, 2, 2))).toBeNull(); // menos del 2 %
  });

  it('no se sale de la imagen al añadir el margen', () => {
    const e = encuadreDeMascara(mascaraRect(100, 100, 0, 0, 60, 60), 0.2)!;
    expect(e.izquierda).toBe(0);
    expect(e.arriba).toBe(0);
    expect(e.ancho).toBe(72);
  });
});

describe('mascaraDesdePrediccion', () => {
  it('normaliza mín..máx a 0..255', () => {
    const m = mascaraDesdePrediccion([0, 0.5, 1, 0.5], 2, 2);
    expect([...m]).toEqual([0, 128, 255, 128]);
  });
  it('no divide por cero si todo vale igual', () => {
    expect([...mascaraDesdePrediccion([1, 1], 2, 1)]).toEqual([0, 0]);
  });
});

describe('componerPrenda', () => {
  it('devuelve un JPEG 4:5 con la prenda centrada sobre el lino', async () => {
    const ancho = 300, alto = 300;
    // Foto: fondo gris, cuadrado rojo en el centro.
    const fondo = Buffer.alloc(ancho * alto * 3, 120);
    for (let y = 100; y < 200; y++) for (let x = 100; x < 200; x++) { const i = (y * ancho + x) * 3; fondo[i] = 220; fondo[i + 1] = 30; fondo[i + 2] = 30; }
    const foto = await sharp(fondo, { raw: { width: ancho, height: alto, channels: 3 } }).jpeg().toBuffer();
    const salida = await componerPrenda(foto, mascaraRect(ancho, alto, 100, 100, 200, 200));
    expect(salida).not.toBeNull();
    const meta = await sharp(salida!).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(ANCHO_SALIDA);
    expect(meta.height).toBe(ALTO_SALIDA);
    const { data } = await sharp(salida!).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => [data[(y * ANCHO_SALIDA + x) * 3], data[(y * ANCHO_SALIDA + x) * 3 + 1], data[(y * ANCHO_SALIDA + x) * 3 + 2]];
    // Esquina: lino (#eeeae1). Centro: rojo.
    const esquina = pixel(5, 5);
    expect(Math.abs(esquina[0] - 0xee)).toBeLessThan(4);
    expect(Math.abs(esquina[2] - 0xe1)).toBeLessThan(4);
    const centro = pixel(ANCHO_SALIDA / 2, ALTO_SALIDA / 2);
    expect(centro[0]).toBeGreaterThan(180);
    expect(centro[1]).toBeLessThan(80);
  });

  it('devuelve null si la máscara no sirve', async () => {
    const foto = await sharp({ create: { width: 50, height: 50, channels: 3, background: '#888' } }).jpeg().toBuffer();
    expect(await componerPrenda(foto, mascaraRect(50, 50, 0, 0, 0, 0))).toBeNull();
  });
});
