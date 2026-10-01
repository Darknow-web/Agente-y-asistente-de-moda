import { describe, expect, it } from 'vitest';
import { PREGUNTAS, aplicarRespuesta, proximaPregunta } from './preguntas.js';

describe('pregunta del día', () => {
  it('pregunta primero lo que falta y no repite lo ya hecho', () => {
    const vacio = proximaPregunta({});
    expect(vacio.pregunta?.id).toBe('ciudad');
    expect(vacio.pendientes).toBe(PREGUNTAS.length);
    const conCiudad = proximaPregunta({ ciudad: 'Lima', preguntasHechas: ['talla-superior'] });
    expect(conCiudad.pregunta?.id).toBe('talla-inferior');
  });

  it('no queda nada cuando el perfil está completo', () => {
    const completo = proximaPregunta({ preguntasHechas: PREGUNTAS.map((q) => q.id) });
    expect(completo.pregunta).toBeNull();
    expect(completo.pendientes).toBe(0);
  });

  it('traduce respuestas a campos del perfil y marca la pregunta como hecha', () => {
    expect(aplicarRespuesta({}, 'talla-calzado', '38')).toEqual({ tallas: { calzado: '38' }, preguntasHechas: ['talla-calzado'] });
    expect(aplicarRespuesta({}, 'estatura', '1,65 a 1,75')).toEqual({ estaturaCm: 170, preguntasHechas: ['estatura'] });
    expect(aplicarRespuesta({ tallasPorMarca: [{ marca: 'Zara', talla: 'S' }] }, 'marca-habitual', 'Zara M')).toEqual({
      tallasPorMarca: [{ marca: 'Zara', talla: 'M' }],
      preguntasHechas: ['marca-habitual'],
    });
    expect(aplicarRespuesta({}, 'presupuesto', 'S/ 100 a 300')).toEqual({ presupuestoMensual: 200, moneda: 'PEN', preguntasHechas: ['presupuesto'] });
  });

  it('saltar solo marca la pregunta como hecha; una pregunta desconocida devuelve null', () => {
    expect(aplicarRespuesta({}, 'ciudad', undefined, true)).toEqual({ preguntasHechas: ['ciudad'] });
    expect(aplicarRespuesta({}, 'no-existe', 'x')).toBeNull();
  });
});
