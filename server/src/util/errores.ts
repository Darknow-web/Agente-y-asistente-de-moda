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
  console.error('[sastra] error no controlado:', err);
  res.status(500).json({ error: 'Algo salió mal de nuestro lado. Inténtalo de nuevo en un momento.', detalle: mensaje });
}
