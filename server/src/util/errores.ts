import type { NextFunction, Request, Response } from 'express';

/** Error con código HTTP y mensaje para el usuario (en español, amable). */
export class ErrorHttp extends Error {
  constructor(
    public readonly codigo: number,
    message: string,
    public readonly detalle?: string,
  ) {
    super(message);
    this.name = 'ErrorHttp';
  }
}

export const noAutorizado = (m = 'Necesitas iniciar sesión.') => new ErrorHttp(401, m);
export const prohibido = (m = 'No tienes permiso para hacer esto.') => new ErrorHttp(403, m);
export const noEncontrado = (m = 'No encontramos lo que buscas.') => new ErrorHttp(404, m);
export const peticionInvalida = (m: string, detalle?: string) => new ErrorHttp(400, m, detalle);

/** Envuelve controladores async para que los errores lleguen al manejador global. */
export function asincrono(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function manejadorErrores(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ErrorHttp) {
    res.status(err.codigo).json({ error: err.message, detalle: err.detalle });
    return;
  }
  const mensaje = err instanceof Error ? err.message : String(err);
  // Errores de tamaño del body (express.json) y JSON malformado
  if (typeof err === 'object' && err && 'type' in err) {
    const tipo = (err as { type?: string }).type;
    if (tipo === 'entity.too.large') {
      res.status(413).json({ error: 'El archivo es demasiado grande. Prueba con una foto o video más pequeño.' });
      return;
    }
    if (tipo === 'entity.parse.failed') {
      res.status(400).json({ error: 'No pudimos leer la petición.' });
      return;
    }
  }
  if (err instanceof Error && err.name === 'ErrorProveedor') {
    console.error('[sastra] fallo del motor de IA:', mensaje);
    res.status(502).json({ error: explicarFalloMotor(mensaje), detalle: mensaje });
    return;
  }
  console.error('[sastra] error no controlado:', err);
  res.status(500).json({ error: 'Algo salió mal de nuestro lado. Inténtalo de nuevo en un momento.', detalle: mensaje });
}

/** Traduce el error crudo de un proveedor de IA a una frase con la causa y qué hacer. */
export function explicarFalloMotor(mensaje: string): string {
  const m = mensaje.toLowerCase();
  const motor = m.includes('claude') ? 'Claude' : m.includes('gemini') ? 'Gemini' : 'el motor de IA';
  if (m.includes('401') || m.includes('authentication') || m.includes('api key not valid') || m.includes('invalid x-api-key')) {
    return `La llave de ${motor} fue rechazada. Revisa que esté bien copiada en la configuración del servidor.`;
  }
  if (m.includes('403') || m.includes('permission')) return `${motor} no permite usar ese modelo con esta llave.`;
  if (m.includes('402') || m.includes('credit') || m.includes('billing') || m.includes('prepay')) {
    return `${motor} no tiene saldo. Carga crédito en la cuenta del proveedor.`;
  }
  if (m.includes('429') || m.includes('quota') || m.includes('rate')) return `${motor} está al límite de peticiones. Espera un minuto e inténtalo de nuevo.`;
  if (m.includes('503') || m.includes('high demand') || m.includes('overloaded') || m.includes('529')) {
    return `${motor} tiene mucha demanda ahora mismo. Espera unos segundos y vuelve a intentarlo.`;
  }
  if (m.includes('no respondió en')) return `${motor} tardó demasiado en responder. Inténtalo de nuevo.`;
  if (m.includes('404') || m.includes('not found') || m.includes('not_found')) return `El modelo configurado para ${motor} no existe. Revisa server/src/config/modelos.json.`;
  return `${motor} devolvió un error (${mensaje.slice(0, 160)}).`;
}
