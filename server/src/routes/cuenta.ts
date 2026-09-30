/**
 * Cuenta: quién soy, perfil, avisos, invitados (admin) y resumen de uso (admin).
 */
import { Router as ExpressRouter } from 'express';
import type { Perfil } from '@shared/types.js';
import type { RespResumenUso, RespYo } from '@shared/api.js';
import { requiereAdmin, requiereInvitado, requiereSesion } from '../auth/middleware.js';
import {
  agregarInvitado,
  guardarPerfil,
  leerPerfil,
  listarAvisos,
  listarInvitados,
  listarUsuariosActivos,
  marcarAvisoLeido,
  mensajesHoy,
  quitarInvitado,
  registrarAcceso,
  resumenConsumoMes,
} from '../data/repos.js';
import { asincrono, noEncontrado, peticionInvalida } from '../util/errores.js';
import { leerLimites } from '../config/limites.js';

export const rutasCuenta = ExpressRouter();

rutasCuenta.get(
  '/yo',
  requiereSesion,
  asincrono(async (req, res) => {
    const u = req.usuario!;
    const perfil = u.invitado ? await leerPerfil(u.uid) : {};
    if (u.invitado) registrarAcceso(u.uid, u.email, u.nombre).catch(() => undefined);
    const usados = u.invitado ? await mensajesHoy(u.uid) : 0;
    const respuesta: RespYo = {
      uid: u.uid,
      email: u.email,
      nombre: u.nombre,
      foto: u.foto,
      invitado: u.invitado,
      admin: u.admin,
      perfil,
      mensajesRestantesHoy: Math.max(0, leerLimites().mensajesPorUsuarioPorDia - usados),
    };
    res.json(respuesta);
  }),
);

rutasCuenta.put(
  '/perfil',
  requiereSesion,
  requiereInvitado,
  asincrono(async (req, res) => {
    const cambios = (req.body ?? {}) as Partial<Perfil>;
    delete (cambios as Record<string, unknown>).creadoEn;
    res.json(await guardarPerfil(req.usuario!.uid, cambios));
  }),
);

rutasCuenta.get(
  '/avisos',
  requiereSesion,
  requiereInvitado,
  asincrono(async (req, res) => {
    res.json(await listarAvisos(req.usuario!.uid));
  }),
);

rutasCuenta.post(
  '/avisos/:id/leido',
  requiereSesion,
  requiereInvitado,
  asincrono(async (req, res) => {
    const a = await marcarAvisoLeido(req.usuario!.uid, String(req.params.id));
    if (!a) throw noEncontrado('Ese aviso no existe.');
    res.json(a);
  }),
);

// ---------------------------------------------------------------- administración
rutasCuenta.get(
  '/invitados',
  requiereSesion,
  requiereAdmin,
  asincrono(async (_req, res) => {
    res.json(await listarInvitados());
  }),
);

rutasCuenta.post(
  '/invitados',
  requiereSesion,
  requiereAdmin,
  asincrono(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw peticionInvalida('Escribe un correo válido.');
    await agregarInvitado(email, req.usuario!.email);
    res.status(201).json(await listarInvitados());
  }),
);

rutasCuenta.delete(
  '/invitados/:email',
  requiereSesion,
  requiereAdmin,
  asincrono(async (req, res) => {
    await quitarInvitado(decodeURIComponent(String(req.params.email)));
    res.json(await listarInvitados());
  }),
);

rutasCuenta.get(
  '/uso/resumen',
  requiereSesion,
  requiereAdmin,
  asincrono(async (req, res) => {
    const mes = String(req.query.mes ?? new Date().toISOString().slice(0, 7));
    const registros = await resumenConsumoMes(mes);
    const usuarios = await listarUsuariosActivos();
    const emailPorUid = new Map(usuarios.map((u) => [u.uid, u.email]));
    const porAgente = new Map<string, { llamadas: number; usd: number }>();
    const porUsuario = new Map<string, { llamadas: number; usd: number }>();
    for (const r of registros) {
      const a = porAgente.get(r.agente) ?? { llamadas: 0, usd: 0 };
      a.llamadas++;
      a.usd += r.costoEstimadoUsd;
      porAgente.set(r.agente, a);
      // El uid viene de la ruta del documento; el registro no lo guarda: lo derivamos del id de referencia si existe
      const uid = (r as unknown as { uid?: string }).uid ?? 'desconocido';
      const u = porUsuario.get(uid) ?? { llamadas: 0, usd: 0 };
      u.llamadas++;
      u.usd += r.costoEstimadoUsd;
      porUsuario.set(uid, u);
    }
    const respuesta: RespResumenUso = {
      mes,
      totalUsd: registros.reduce((s, r) => s + r.costoEstimadoUsd, 0),
      porAgente: [...porAgente.entries()].map(([agente, v]) => ({ agente: agente as RespResumenUso['porAgente'][number]['agente'], ...v })),
      porUsuario: [...porUsuario.entries()].map(([uid, v]) => ({ uid, email: emailPorUid.get(uid), ...v })),
    };
    res.json(respuesta);
  }),
);
