/**
 * Cliente HTTP de SASTRA. Añade el ID token de Firebase, tipa las respuestas según shared/api.ts
 * y expone `chatStream` para leer el text/event-stream de POST /api/chat.
 */
import type {
  Adjunto,
  Ajuste,
  Conversacion,
  Deseo,
  EventoChat,
  Perfil,
  PeticionChat,
  PlanSemanal,
  Prenda,
} from '@shared/types';
import type {
  ErrorApi,
  Invitado,
  ReqAjuste,
  ReqCatalogar,
  ReqCrearPrenda,
  ReqGenerarSemana,
  ReqIndiceCompra,
  ReqPerfil,
  ReqRegistrarUso,
  ReqRespuestaPregunta,
  RespAvisos,
  RespCatalogar,
  RespClavePush,
  RespHoy,
  RespIndiceCompra,
  RespPerfil,
  RespPreguntaDelDia,
  RespPrendas,
  RespResumenArmario,
  RespResumenUso,
  RespSalud,
  RespSemana,
  RespYo,
} from '@shared/api';
import { auth } from './firebase';

export class ErrorHttp extends Error {
  estado: number;
  detalle?: string;
  constructor(mensaje: string, estado: number, detalle?: string) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.estado = estado;
    this.detalle = detalle;
  }
}

async function cabeceras(conJson: boolean): Promise<Record<string, string>> {
  const h: Record<string, string> = { Accept: 'application/json' };
  if (conJson) h['Content-Type'] = 'application/json';
  const usuario = auth?.currentUser;
  if (usuario) {
    try {
      const token = await usuario.getIdToken();
      h.Authorization = `Bearer ${token}`;
    } catch {
      /* sin token: el servidor responderá 401 */
    }
  }
  return h;
}

async function leerError(res: Response): Promise<never> {
  let mensaje = `Error ${res.status}`;
  let detalle: string | undefined;
  try {
    const cuerpo = (await res.json()) as Partial<ErrorApi>;
    if (cuerpo?.error) mensaje = cuerpo.error;
    detalle = cuerpo?.detalle;
  } catch {
    if (res.status === 404) mensaje = 'El servidor no respondió en esa ruta.';
    if (res.status >= 500) mensaje = 'El servidor tuvo un problema. Inténtalo de nuevo.';
  }
  throw new ErrorHttp(mensaje, res.status, detalle);
}

async function peticion<T>(metodo: string, ruta: string, cuerpo?: unknown, extra: { keepalive?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ruta, {
      method: metodo,
      headers: await cabeceras(cuerpo !== undefined),
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      keepalive: extra.keepalive,
    });
  } catch {
    throw new ErrorHttp('No hay conexión con el servidor.', 0);
  }
  if (!res.ok) return leerError(res);
  if (res.status === 204) return undefined as T;
  const texto = await res.text();
  if (!texto) return undefined as T;
  return JSON.parse(texto) as T;
}

export const get = <T>(ruta: string) => peticion<T>('GET', ruta);
export const post = <T>(ruta: string, cuerpo?: unknown, extra?: { keepalive?: boolean }) => peticion<T>('POST', ruta, cuerpo ?? {}, extra);
export const patch = <T>(ruta: string, cuerpo: unknown) => peticion<T>('PATCH', ruta, cuerpo);
export const put = <T>(ruta: string, cuerpo: unknown) => peticion<T>('PUT', ruta, cuerpo);
export const del = <T>(ruta: string) => peticion<T>('DELETE', ruta);

// ------------------------------------------------------------ funciones tipadas por recurso
export const api = {
  salud: () => get<RespSalud>('/api/salud'),
  yo: () => get<RespYo>('/api/yo'),
  guardarPerfil: (perfil: ReqPerfil) => put<RespPerfil>('/api/perfil', perfil),

  prendas: () => get<RespPrendas>('/api/prendas'),
  catalogar: (req: ReqCatalogar) => post<RespCatalogar>('/api/prendas/catalogar', req),
  crearPrenda: (req: ReqCrearPrenda) => post<Prenda>('/api/prendas', req),
  editarPrenda: (id: string, cambios: Partial<Prenda>) =>
    patch<Prenda>(`/api/prendas/${encodeURIComponent(id)}`, cambios),
  eliminarPrenda: (id: string) => del<{ ok: true }>(`/api/prendas/${encodeURIComponent(id)}`),
  registrarUso: (id: string, contexto?: string, ajuste?: ReqRegistrarUso['ajuste']) =>
    post<Prenda>(`/api/prendas/${encodeURIComponent(id)}/uso`, { contexto: contexto || undefined, ajuste } satisfies ReqRegistrarUso),
  marcarLavada: (id: string) => post<Prenda>(`/api/prendas/${encodeURIComponent(id)}/lavada`),
  /** Pulido en segundo plano tras subir (recorte gratuito; alisado solo si vino arrugada). `keepalive`: sigue aunque se cambie de pantalla. */
  pulirFoto: (id: string) => post<Prenda>(`/api/prendas/${encodeURIComponent(id)}/foto/pulir`, undefined, { keepalive: true }),
  mejorarFoto: (id: string) => post<Prenda>(`/api/prendas/${encodeURIComponent(id)}/foto/mejorar`),
  fotoOriginal: (id: string) => post<Prenda>(`/api/prendas/${encodeURIComponent(id)}/foto/original`),
  formasDeUso: (id: string, regenerar = false) =>
    post<Prenda>(`/api/prendas/${encodeURIComponent(id)}/formas${regenerar ? '?regenerar=1' : ''}`),
  resumenArmario: () => get<RespResumenArmario>('/api/armario/resumen'),
  ajustes: () => get<Ajuste[]>('/api/ajustes'),
  crearAjuste: (a: ReqAjuste) => post<Ajuste>('/api/ajustes', a),

  preguntaDelDia: () => get<RespPreguntaDelDia>('/api/pregunta-del-dia'),
  responderPregunta: (r: ReqRespuestaPregunta) => post<Perfil>('/api/pregunta-del-dia', r),

  indiceCompra: (req: ReqIndiceCompra) => post<RespIndiceCompra>('/api/probador/indice', req),

  clavePush: () => get<RespClavePush>('/api/push/clave'),
  suscribirPush: (s: PushSubscriptionJSON & { dispositivo?: string }) => post<{ ok: true }>('/api/push/suscripcion', s),
  desuscribirPush: (endpoint: string) => peticion<{ ok: true }>('DELETE', '/api/push/suscripcion', { endpoint }),

  hoy: () => get<RespHoy>('/api/planes/hoy'),
  semana: (inicio: string) => get<RespSemana>(`/api/planes/semana?inicio=${encodeURIComponent(inicio)}`),
  generarSemana: (req: ReqGenerarSemana) => post<PlanSemanal>('/api/planes/semana', req),

  deseos: () => get<Deseo[]>('/api/deseos'),
  crearDeseo: (deseo: Omit<Deseo, 'id' | 'creadoEn'>) => post<Deseo>('/api/deseos', deseo),
  eliminarDeseo: (id: string) => del<{ ok: true }>(`/api/deseos/${encodeURIComponent(id)}`),

  avisos: () => get<RespAvisos>('/api/avisos'),
  marcarLeido: (id: string) => post<RespAvisos[number]>(`/api/avisos/${encodeURIComponent(id)}/leido`),

  conversaciones: () =>
    get<Pick<Conversacion, 'id' | 'titulo' | 'actualizadaEn'>[]>('/api/conversaciones'),
  conversacion: (id: string) => get<Conversacion>(`/api/conversaciones/${encodeURIComponent(id)}`),

  invitados: () => get<Invitado[]>('/api/invitados'),
  invitar: (email: string) => post<Invitado[]>('/api/invitados', { email }),
  desinvitar: (email: string) => del<Invitado[]>(`/api/invitados/${encodeURIComponent(email)}`),
  resumenUso: () => get<RespResumenUso>('/api/uso/resumen'),
};

export type { Adjunto, Perfil, Prenda };

// ------------------------------------------------------------ chat en streaming (SSE sobre POST)
/**
 * Envía un mensaje a POST /api/chat y entrega cada EventoChat a `onEvento`.
 * Usa fetch + ReadableStream porque EventSource no permite POST ni cabeceras.
 */
export async function chatStream(
  peticionChat: PeticionChat,
  onEvento: (evento: EventoChat) => void,
  senal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { ...(await cabeceras(true)), Accept: 'text/event-stream' },
      body: JSON.stringify(peticionChat),
      signal: senal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return;
    throw new ErrorHttp('No hay conexión con el servidor.', 0);
  }
  if (!res.ok) return leerError(res);
  if (!res.body) throw new ErrorHttp('El servidor no devolvió ningún flujo.', 0);

  const lector = res.body.getReader();
  const decodificador = new TextDecoder();
  let pendiente = '';

  const procesarBloque = (bloque: string) => {
    const lineas = bloque.split(/\r?\n/);
    const datos: string[] = [];
    for (const linea of lineas) {
      if (linea.startsWith('data:')) datos.push(linea.slice(5).replace(/^ /, ''));
    }
    if (!datos.length) return;
    const json = datos.join('\n').trim();
    if (!json || json === '[DONE]') return;
    try {
      onEvento(JSON.parse(json) as EventoChat);
    } catch {
      /* línea no JSON: se ignora */
    }
  };

  try {
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      pendiente += decodificador.decode(value, { stream: true });
      let indice: number;
      while ((indice = pendiente.search(/\r?\n\r?\n/)) !== -1) {
        const salto = pendiente.slice(indice).match(/^\r?\n\r?\n/)?.[0].length ?? 2;
        const bloque = pendiente.slice(0, indice);
        pendiente = pendiente.slice(indice + salto);
        procesarBloque(bloque);
      }
    }
    pendiente += decodificador.decode();
    if (pendiente.trim()) procesarBloque(pendiente);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return;
    throw e;
  }
}
