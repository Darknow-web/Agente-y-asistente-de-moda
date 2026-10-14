/**
 * Libro de Reclamaciones virtual (INDECOPI). Se puede registrar sin cuenta; solo el admin lo lista.
 */
import { Router as ExpressRouter } from 'express';
import type { ReqReclamacion } from '@shared/api.js';
import { auth } from '../auth/admin.js';
import { requiereAdmin, requiereSesion } from '../auth/middleware.js';
import { guardarReclamacion, listarReclamaciones } from '../data/repos.js';
import { ErrorHttp, asincrono, peticionInvalida } from '../util/errores.js';

export const rutasLegal = ExpressRouter();

/** Freno simple contra envíos masivos: 5 por IP cada hora (en memoria). */
const envios = new Map<string, number[]>();
function frenar(ip: string): void {
  const ahora = Date.now();
  const recientes = (envios.get(ip) ?? []).filter((t) => ahora - t < 3_600_000);
  if (recientes.length >= 5) throw new ErrorHttp(429, 'Recibimos varios registros seguidos desde tu conexión. Inténtalo en una hora.');
  recientes.push(ahora);
  envios.set(ip, recientes);
}

const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

rutasLegal.post(
  '/reclamaciones',
  asincrono(async (req, res) => {
    // Detrás de Cloudflare la IP real llega en CF-Connecting-IP (no la puede falsear el cliente).
    frenar(req.header('cf-connecting-ip') ?? req.ip ?? 'desconocida');
    const c = (req.body ?? {}) as Partial<ReqReclamacion>;
    const tipo = c.tipo === 'queja' ? 'queja' : c.tipo === 'reclamo' ? 'reclamo' : null;
    const datos = {
      nombre: texto(c.nombre, 120),
      documento: texto(c.documento, 20),
      email: texto(c.email, 160).toLowerCase(),
      telefono: texto(c.telefono, 30) || undefined,
      domicilio: texto(c.domicilio, 200) || undefined,
      servicio: texto(c.servicio, 160) || 'SASTRA',
      monto: typeof c.monto === 'number' && c.monto >= 0 ? c.monto : undefined,
      detalle: texto(c.detalle, 3000),
      pedido: texto(c.pedido, 1500),
    };
    if (!tipo || !datos.nombre || !datos.documento || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email) || datos.detalle.length < 10 || !datos.pedido) {
      throw peticionInvalida('Completa tipo, nombre, documento, correo, el detalle y tu pedido.');
    }
    // Si viene con sesión, se anota el uid (no es obligatorio).
    let uid: string | undefined;
    const token = (req.header('authorization') ?? '').replace(/^Bearer /, '');
    if (token) uid = await auth().verifyIdToken(token).then((d) => d.uid).catch(() => undefined);
    const r = await guardarReclamacion({ tipo, ...datos, ...(uid ? { uid } : {}) });
    res.status(201).json({ id: r.id });
  }),
);

rutasLegal.get(
  '/reclamaciones',
  requiereSesion,
  requiereAdmin,
  asincrono(async (_req, res) => {
    res.json(await listarReclamaciones());
  }),
);
