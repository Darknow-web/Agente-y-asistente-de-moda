/**
 * Probador: índice de compra antes de pagar (JSON, una llamada aparte del chat).
 */
import { Router as ExpressRouter } from 'express';
import type { ReqIndiceCompra } from '@shared/api.js';
import { requiereInvitado, requiereSesion } from '../auth/middleware.js';
import { asincrono, peticionInvalida } from '../util/errores.js';
import { construirContexto } from '../memory/construir.js';
import { indiceCompra } from '../agents/probador/index.js';

export const rutasProbador = ExpressRouter();
rutasProbador.use('/probador', requiereSesion, requiereInvitado);

rutasProbador.post(
  '/probador/indice',
  asincrono(async (req, res) => {
    const { foto, pista } = (req.body ?? {}) as ReqIndiceCompra;
    if (!foto?.datos || foto.tipo !== 'imagen') throw peticionInvalida('Necesitamos una foto de la prenda.');
    const ctx = await construirContexto(req.usuario!.uid, req.usuario!.email, { conClima: false });
    const { resultado } = await indiceCompra(ctx, foto, pista);
    res.json(resultado);
  }),
);
