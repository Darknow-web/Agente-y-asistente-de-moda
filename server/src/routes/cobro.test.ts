/**
 * Puntos de cobro de punta a punta (rutas reales de Express) con Firestore, Firebase Auth y Mercado Pago
 * simulados: el plan Gratis recibe 402 'requiere-premium' en cada límite antes de gastar IA, Premium pasa,
 * y el webhook de Mercado Pago solo actúa con firma válida.
 */
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prenda, Suscripcion } from '@shared/types.js';

const estado = vi.hoisted(() => ({
  suscripcion: null as Suscripcion | null,
  prendas: 0,
  mensajesHoy: 0,
  retoquesHoy: 0,
  mes: { probador: 0, compras: 0 } as Record<string, number>,
  planExistente: false,
  guardadas: [] as Suscripcion[],
  armario: [] as Partial<Prenda>[],
  marcadas: [] as string[],
}));

vi.mock('../auth/admin.js', () => ({
  auth: () => ({ verifyIdToken: async (token: string) => ({ uid: token, email: `${token}@correo.pe` }) }),
  db: () => {
    throw new Error('Firestore no debe usarse en esta prueba');
  },
}));

vi.mock('../data/repos.js', () => ({
  estaInvitado: vi.fn(async () => false),
  leerSuscripcion: vi.fn(async () => estado.suscripcion),
  guardarSuscripcion: vi.fn(async (_uid: string, s: Suscripcion) => {
    estado.guardadas.push(s);
    estado.suscripcion = s;
  }),
  contarPrendas: vi.fn(async () => estado.prendas),
  mensajesHoy: vi.fn(async () => estado.mensajesHoy),
  contarHoy: vi.fn(async () => estado.retoquesHoy),
  contarMes: vi.fn(async (_uid: string, campo: string) => estado.mes[campo] ?? 0),
  sumarMes: vi.fn(async () => undefined),
  listarPrendas: vi.fn(async () => estado.armario),
  actualizarPrenda: vi.fn(async (_uid: string, id: string) => {
    estado.marcadas.push(id);
  }),
  leerPlan: vi.fn(async () => (estado.planExistente ? { semanaInicio: '2026-10-12', dias: [] } : null)),
}));

const SECRETO = 'secreto-webhook';
const fetchReal = globalThis.fetch;
let base = '';
let cerrar: () => void = () => undefined;

beforeAll(async () => {
  vi.stubEnv('MP_WEBHOOK_SECRET', SECRETO);
  vi.stubEnv('MP_ACCESS_TOKEN', 'TEST-token');
  vi.stubEnv('ADMIN_EMAILS', 'admin@correo.pe');
  const { rutasArmario } = await import('./armario.js');
  const { rutasPlanes } = await import('./planes.js');
  const { rutasProbador } = await import('./probador.js');
  const { rutasChat } = await import('./chat.js');
  const { rutasSuscripcion } = await import('./suscripcion.js');
  const { manejadorErrores } = await import('../util/errores.js');
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  for (const r of [rutasArmario, rutasPlanes, rutasProbador, rutasChat, rutasSuscripcion]) app.use('/api', r);
  app.use(manejadorErrores);
  const servidor = app.listen(0);
  await new Promise((ok) => servidor.once('listening', ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  cerrar = () => servidor.close();
});

afterAll(() => {
  cerrar();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  Object.assign(estado, { suscripcion: null, prendas: 0, mensajesHoy: 0, retoquesHoy: 0, mes: { probador: 0, compras: 0 }, planExistente: false, guardadas: [], armario: [], marcadas: [] });
});

const premium: Suscripcion = { plan: 'premium', estado: 'activa', proveedor: 'mercadopago', mpPreapprovalId: 'pre-1', actualizadaEn: '' };
const FOTO = { tipo: 'imagen', mime: 'image/jpeg', datos: 'aGVsbG8=' };

async function llamar(ruta: string, cuerpo: unknown, usuario = 'u1', cabeceras: Record<string, string> = {}) {
  const res = await fetchReal(`${base}${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${usuario}`, ...cabeceras },
    body: JSON.stringify(cuerpo),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

describe('límites del plan Gratis', () => {
  it('armario lleno: catalogar devuelve 402 antes de llamar a la IA', async () => {
    estado.prendas = 100;
    const r = await llamar('/api/prendas/catalogar', { foto: FOTO });
    expect(r.status).toBe(402);
    expect(r.json.codigo).toBe('requiere-premium');
  });

  it('crear prenda con el armario lleno también se frena', async () => {
    estado.prendas = 100;
    const r = await llamar('/api/prendas', { prenda: { nombre: 'Polo', categoria: 'superior', colores: [] } });
    expect(r.status).toBe(402);
  });

  it('Mejorar foto es solo Premium; en Premium respeta el cupo diario', async () => {
    expect((await llamar('/api/prendas/p1/foto/mejorar', {})).status).toBe(402);
    estado.suscripcion = premium;
    estado.retoquesHoy = 30;
    const r = await llamar('/api/prendas/p1/foto/mejorar', {}, 'u2');
    expect(r.status).toBe(429);
    expect(r.json.codigo).toBe('cupo-fotos');
  });

  it('Pasar el armario a foto de catálogo: Gratis recibe 402; Premium marca solo las que faltan', async () => {
    estado.armario = [
      { id: 'a', fotoUrl: 'x', fotoRetoque: 'recorte' },
      { id: 'b', fotoUrl: 'x', fotoRetoque: 'catalogo' },
      { id: 'c', fotoUrl: 'x', fotoRetoque: 'original' },
      { id: 'd' },
    ];
    expect((await llamar('/api/armario/fotos-catalogo', {})).status).toBe(402);
    expect(estado.marcadas).toEqual([]);
    estado.suscripcion = premium;
    estado.retoquesHoy = 4;
    const r = await llamar('/api/armario/fotos-catalogo', {}, 'u3');
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ pendientes: ['a'], cupoHoy: 26 });
    expect(estado.marcadas).toEqual(['a']);
  });

  it('Probador: 3 al mes en Gratis', async () => {
    estado.mes.probador = 3;
    const r = await llamar('/api/probador/indice', { foto: FOTO });
    expect(r.status).toBe(402);
    expect(String(r.json.error)).toContain('Probador');
  });

  it('Rehacer la semana es Premium', async () => {
    estado.planExistente = true;
    expect((await llamar('/api/planes/semana', { inicio: '2026-10-12' })).status).toBe(402);
  });

  it('Chat: al agotar los mensajes gratis del día, 402 con invitación a Premium', async () => {
    estado.mensajesHoy = 10;
    const r = await llamar('/api/chat', { texto: 'hola' });
    expect(r.status).toBe(402);
    expect(r.json.codigo).toBe('requiere-premium');
  });

  it('Premium no tiene tope de prendas (pasa el control y sigue)', async () => {
    estado.suscripcion = premium;
    estado.prendas = 500;
    const r = await llamar('/api/prendas/catalogar', { foto: FOTO }, 'u3');
    expect(r.status).not.toBe(402);
  });
});

describe('webhook de Mercado Pago', () => {
  function firmar(dataId: string, requestId: string, ts = '1760000000') {
    const v1 = createHmac('sha256', SECRETO).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
    return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
  }

  it('rechaza una firma inválida sin tocar la suscripción', async () => {
    const r = await llamar('/api/pagos/mercadopago/webhook?type=subscription_preapproval&data.id=pre9', { type: 'subscription_preapproval', data: { id: 'pre9' } }, 'x', {
      'x-signature': 'ts=1,v1=deadbeef',
      'x-request-id': 'r1',
    });
    expect(r.status).toBe(401);
    expect(estado.guardadas).toHaveLength(0);
  });

  it('con firma válida relee la suscripción en Mercado Pago y la guarda para su dueño', async () => {
    const llamadasMp: string[] = [];
    vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (!u.startsWith('https://api.mercadopago.com')) return fetchReal(url, init);
      llamadasMp.push(u);
      return new Response(
        JSON.stringify({
          id: 'pre9',
          status: 'authorized',
          external_reference: 'u7',
          payer_email: 'pagador@correo.pe',
          date_created: new Date().toISOString(),
          next_payment_date: '2099-01-01T00:00:00Z',
          auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 19.9, currency_id: 'PEN', free_trial: { frequency: 7, frequency_type: 'days' } },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    try {
      const r = await llamar('/api/pagos/mercadopago/webhook?type=subscription_preapproval&data.id=pre9', { type: 'subscription_preapproval', data: { id: 'pre9' } }, 'x', firmar('pre9', 'req-77'));
      expect(r.status).toBe(200);
      expect(llamadasMp).toEqual(['https://api.mercadopago.com/preapproval/pre9']);
      expect(estado.guardadas.at(-1)).toMatchObject({ plan: 'premium', estado: 'prueba', mpPreapprovalId: 'pre9', pruebaUsada: true });
    } finally {
      vi.stubGlobal('fetch', fetchReal);
    }
  });

  it('ignora temas que no son de suscripciones', async () => {
    const r = await llamar('/api/pagos/mercadopago/webhook?type=payment&data.id=123', { type: 'payment', data: { id: '123' } }, 'x', firmar('123', 'req-1'));
    expect(r.status).toBe(200);
    expect(r.json.ignorado).toBe('payment');
  });
});
