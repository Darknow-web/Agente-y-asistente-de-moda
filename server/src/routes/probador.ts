/**
 * Probador: índice de compra antes de pagar (JSON, una llamada aparte del chat).
 */
import { Router as ExpressRouter } from 'express';
import type { ReqIndiceCompra } from '@shared/api.js';
import { requiereInvitado, requiereSesion } from '../auth/middleware.js';
import { asincrono, peticionInvalida, requierePremium } from '../util/errores.js';
import { alcanzoLimite, limitesDe } from '../config/planes.js';
import { contarMes, sumarMes } from '../data/repos.js';
import { construirContexto } from '../memory/construir.js';
import { indiceCompra } from '../agents/probador/index.js';

export const rutasProbador = ExpressRouter();
rutasProbador.use('/probador', requiereSesion, requiereInvitado);

rutasProbador.post(
  '/probador/indice',
  asincrono(async (req, res) => {
    const { foto, pista } = (req.body ?? {}) as ReqIndiceCompra;
    if (!foto?.datos || foto.tipo !== 'imagen') throw peticionInvalida('Necesitamos una foto de la prenda.');
    const { uid, email, plan } = req.usuario!;
    const tope = limitesDe(plan).probadorPorMes;
    if (alcanzoLimite(tope, await contarMes(uid, 'probador'))) {
      throw requierePremium(`Usaste los ${tope} análisis del Probador incluidos este mes en el plan Gratis. Con Premium no hay límite.`);
    }
    const ctx = await construirContexto(uid, email, { conClima: false });
    const { resultado } = await indiceCompra(ctx, foto, pista);
    await sumarMes(uid, 'probador');
    res.json(resultado);
  }),
);
