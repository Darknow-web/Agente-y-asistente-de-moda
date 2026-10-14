/**
 * Plan y suscripción: estado, checkout con Mercado Pago, cancelación y webhook.
 * La suscripción solo la escribe el servidor (firestore.rules no deja escribir al cliente).
 */
import { Router as ExpressRouter, type Request } from 'express';
import type { PeriodoPago, Suscripcion } from '@shared/types.js';
import type { ReqCheckout, RespCheckout, RespSuscripcion } from '@shared/api.js';
import { olvidarSuscripcionEnCache, requiereInvitado, requiereSesion } from '../auth/middleware.js';
import { leerPlanes, limitesDe, planEfectivo } from '../config/planes.js';
import { contarHoy, contarMes, contarPrendas, guardarSuscripcion, leerSuscripcion, mensajesHoy } from '../data/repos.js';
import {
  ErrorPago,
  cancelarPreapproval,
  crearSuscripcion,
  leerPreapproval,
  pagosConfigurados,
  preapprovalDePago,
  suscripcionDesdePreapproval,
  validarFirma,
  type Preapproval,
} from '../pagos/mercadopago.js';
import { ErrorHttp, asincrono, peticionInvalida } from '../util/errores.js';
import { env } from '../util/env.js';

export const rutasSuscripcion = ExpressRouter();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esPremiumPagado(s: Suscripcion | null): boolean {
  return !!s && (s.estado === 'prueba' || s.estado === 'activa');
}

/**
 * Guarda el estado que informa Mercado Pago. Si la persona ya tiene otra suscripción activa, un aviso sobre
 * una preapproval vieja (un checkout abandonado que caduca, por ejemplo) no la pisa.
 */
async function aplicarPreapproval(uid: string, p: Preapproval): Promise<Suscripcion> {
  const previa = await leerSuscripcion(uid);
  if (previa?.mpPreapprovalId && previa.mpPreapprovalId !== p.id && esPremiumPagado(previa) && p.status !== 'authorized') {
    return previa;
  }
  const nueva = suscripcionDesdePreapproval(p, previa);
  await guardarSuscripcion(uid, nueva);
  olvidarSuscripcionEnCache(uid);
  return nueva;
}

async function armarRespuesta(req: Request, suscripcion: Suscripcion | null): Promise<RespSuscripcion> {
  const u = req.usuario!;
  const { plan, origen } = planEfectivo({ admin: u.admin, cortesia: u.cortesia, suscripcion });
  const config = leerPlanes();
  const [prendas, mensajes, mejorar, probador, compras] = await Promise.all([
    contarPrendas(u.uid).catch(() => 0),
    mensajesHoy(u.uid).catch(() => 0),
    contarHoy(u.uid, 'retoques').catch(() => 0),
    contarMes(u.uid, 'probador').catch(() => 0),
    contarMes(u.uid, 'compras').catch(() => 0),
  ]);
  return {
    plan,
    origen,
    suscripcion: suscripcion
      ? {
          estado: suscripcion.estado,
          periodo: suscripcion.periodo,
          vigenteHasta: suscripcion.vigenteHasta,
          pruebaUsada: suscripcion.pruebaUsada,
          emailPagador: suscripcion.emailPagador,
        }
      : null,
    limites: limitesDe(plan),
    planes: config.planes,
    usos: { prendas, mensajesHoy: mensajes, mejorarFotoHoy: mejorar, probadorMes: probador, comprasMes: compras },
    precios: config.precios,
    pagosConfigurados: pagosConfigurados(),
  };
}

function errorDePago(e: unknown): never {
  if (e instanceof ErrorPago) {
    console.error('[pagos]', e.message);
    throw new ErrorHttp(502, 'Mercado Pago no respondió como esperábamos. Inténtalo de nuevo en unos minutos.', e.message);
  }
  throw e;
}

rutasSuscripcion.get(
  '/suscripcion',
  requiereSesion,
  requiereInvitado,
  asincrono(async (req, res) => {
    const uid = req.usuario!.uid;
    let suscripcion = await leerSuscripcion(uid);
    // Al volver de Mercado Pago no esperamos al webhook: releemos esa suscripción si es de esta persona.
    const idVuelta = typeof req.query.preapproval_id === 'string' ? req.query.preapproval_id : '';
    if (idVuelta && pagosConfigurados()) {
      try {
        const p = await leerPreapproval(idVuelta);
        if (p.external_reference === uid) suscripcion = await aplicarPreapproval(uid, p);
      } catch (e) {
        console.warn('[pagos] no se pudo releer la suscripción al volver:', e instanceof Error ? e.message : e);
      }
    }
    res.json(await armarRespuesta(req, suscripcion));
  }),
);

rutasSuscripcion.post(
  '/suscripcion/checkout',
  requiereSesion,
  requiereInvitado,
  asincrono(async (req, res) => {
    const u = req.usuario!;
    const { periodo, emailMercadoPago } = (req.body ?? {}) as Partial<ReqCheckout>;
    if (periodo !== 'mensual' && periodo !== 'anual') throw peticionInvalida('Elige pago mensual o anual.');
    const email = String(emailMercadoPago ?? '').trim().toLowerCase();
    if (!EMAIL.test(email)) throw peticionInvalida('Escribe el correo de tu cuenta de Mercado Pago.');
    if (u.origenPlan === 'admin' || u.origenPlan === 'cortesia') throw peticionInvalida('Ya tienes Premium de cortesía; no necesitas pagar.');
    if (!pagosConfigurados()) throw new ErrorHttp(503, 'Los pagos todavía no están activos. Vuelve a intentarlo pronto.');
    const previa = await leerSuscripcion(u.uid);
    if (esPremiumPagado(previa)) throw peticionInvalida('Ya tienes Premium activo.');
    let p: Preapproval;
    try {
      p = await crearSuscripcion({ uid: u.uid, emailPagador: email, periodo: periodo as PeriodoPago, conPrueba: !previa?.pruebaUsada });
    } catch (e) {
      errorDePago(e);
    }
    if (!p.init_point) throw new ErrorHttp(502, 'Mercado Pago no devolvió el enlace de pago. Inténtalo de nuevo.');
    const respuesta: RespCheckout = { url: p.init_point };
    res.json(respuesta);
  }),
);

rutasSuscripcion.post(
  '/suscripcion/cancelar',
  requiereSesion,
  requiereInvitado,
  asincrono(async (req, res) => {
    const uid = req.usuario!.uid;
    const previa = await leerSuscripcion(uid);
    if (!previa?.mpPreapprovalId || previa.estado === 'cancelada') throw peticionInvalida('No tienes una suscripción activa que cancelar.');
    let p: Preapproval;
    try {
      p = await cancelarPreapproval(previa.mpPreapprovalId);
    } catch (e) {
      errorDePago(e);
    }
    const nueva = await aplicarPreapproval(uid, p);
    res.json(await armarRespuesta(req, nueva));
  }),
);

// Webhook de Mercado Pago: sin sesión, con firma. Responde 200 a lo que no nos interesa para que no reintente.
rutasSuscripcion.post(
  '/pagos/mercadopago/webhook',
  asincrono(async (req, res) => {
    const cuerpo = (req.body ?? {}) as { type?: string; topic?: string; data?: { id?: string | number } };
    const tipo = String(req.query.type ?? req.query.topic ?? cuerpo.type ?? cuerpo.topic ?? '');
    const dataId = String(req.query['data.id'] ?? cuerpo.data?.id ?? '');
    const secreto = env('MP_WEBHOOK_SECRET');
    if (!secreto) {
      console.error('[pagos] llegó un webhook pero falta MP_WEBHOOK_SECRET; se rechaza.');
      throw new ErrorHttp(503, 'Webhook no configurado.');
    }
    const firmaOk = validarFirma({ xSignature: req.header('x-signature'), xRequestId: req.header('x-request-id'), dataId, secreto });
    if (!firmaOk) throw new ErrorHttp(401, 'Firma inválida.');

    let idPreapproval: string | null = null;
    if (tipo === 'subscription_preapproval') idPreapproval = dataId;
    else if (tipo === 'subscription_authorized_payment') idPreapproval = await preapprovalDePago(dataId).catch(errorDePago);
    if (!idPreapproval) {
      res.json({ ok: true, ignorado: tipo || 'sin tipo' });
      return;
    }
    const p = await leerPreapproval(idPreapproval).catch(errorDePago);
    const uid = p.external_reference;
    if (!uid) {
      res.json({ ok: true, ignorado: 'sin external_reference' });
      return;
    }
    const s = await aplicarPreapproval(uid, p);
    console.log(`[pagos] ${tipo} ${idPreapproval} → ${uid}: ${s.estado}`);
    res.json({ ok: true });
  }),
);
