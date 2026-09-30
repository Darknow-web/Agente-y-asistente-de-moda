/**
 * Contrato de la API entre cliente y servidor.
 * Autenticación: cabecera `Authorization: Bearer <ID token de Firebase>` en todas las rutas
 * salvo /api/salud (pública) y /api/jobs/* (cabecera `x-jobs-secret`).
 * Todas las respuestas de error tienen la forma { error: string, detalle?: string }.
 */
import type {
  Adjunto,
  Aviso,
  Conversacion,
  NombreAgente,
  Perfil,
  PlanDia,
  PlanSemanal,
  Prenda,
  RegistroUso,
  RespuestaSalud,
} from './types.js';

export interface ErrorApi {
  error: string;
  detalle?: string;
}

// GET /api/salud  (pública)
export type RespSalud = RespuestaSalud;

// GET /api/yo  → quién soy y si tengo acceso
export interface RespYo {
  uid: string;
  email: string;
  nombre?: string;
  foto?: string;
  /** true si el correo está en la lista de invitados */
  invitado: boolean;
  /** true si el correo está en ADMIN_EMAILS */
  admin: boolean;
  perfil: Perfil;
  /** cuántos mensajes le quedan hoy */
  mensajesRestantesHoy: number;
}

// PUT /api/perfil  body: Partial<Perfil> → Perfil
export type ReqPerfil = Partial<Perfil>;
export type RespPerfil = Perfil;

// ---------------------------------------------------------------- armario
// GET /api/prendas → Prenda[]
export type RespPrendas = Prenda[];

// POST /api/prendas/catalogar  body: { foto: Adjunto, pista?: string } → propuesta (no guarda)
export interface ReqCatalogar {
  foto: Adjunto;
  /** texto opcional del usuario: "es una camisa de lino que compré en Zara" */
  pista?: string;
}
export interface RespCatalogar {
  propuesta: Omit<Prenda, 'id' | 'creadaEn' | 'actualizadaEn' | 'usosDesdeLavado' | 'estado'>;
  /** preguntas si algo no se ve en la foto (tela, talla…) */
  preguntas: string[];
}

// POST /api/prendas  body: { prenda: Omit<Prenda,'id'|'creadaEn'|'actualizadaEn'>, foto?: Adjunto } → Prenda
export interface ReqCrearPrenda {
  prenda: Omit<Prenda, 'id' | 'creadaEn' | 'actualizadaEn'>;
  foto?: Adjunto;
}
// PATCH /api/prendas/:id  body: Partial<Prenda> → Prenda
// DELETE /api/prendas/:id → { ok: true }
// POST /api/prendas/:id/uso  body: { contexto?: string } → Prenda (incrementa usos, cambia estado)
// POST /api/prendas/:id/lavada → Prenda (usos a 0, estado limpia)

// ---------------------------------------------------------------- planes
// GET /api/planes/hoy → { dia: PlanDia | null, prendas: Prenda[] }
export interface RespHoy {
  dia: PlanDia | null;
  prendas: Prenda[];
  clima?: { temperaturaC: number; descripcion: string; lluvia: boolean };
}
// GET /api/planes/semana?inicio=YYYY-MM-DD → PlanSemanal | null
// POST /api/planes/semana  body: { inicio?: string; notas?: string } → PlanSemanal (genera con Planificación)
export interface ReqGenerarSemana {
  inicio?: string;
  notas?: string;
}
export type RespSemana = PlanSemanal | null;

// ---------------------------------------------------------------- deseos
// GET /api/deseos → Deseo[]   POST /api/deseos body: Omit<Deseo,'id'|'creadoEn'>   DELETE /api/deseos/:id

// ---------------------------------------------------------------- avisos
// GET /api/avisos → Aviso[]   POST /api/avisos/:id/leido → Aviso
export type RespAvisos = Aviso[];

// ---------------------------------------------------------------- conversaciones y chat
// GET /api/conversaciones → Pick<Conversacion,'id'|'titulo'|'actualizadaEn'>[]
// GET /api/conversaciones/:id → Conversacion
// POST /api/chat  body: PeticionChat → text/event-stream de EventoChat (ver types.ts)
export type { Adjunto, Conversacion, NombreAgente, RegistroUso };

// ---------------------------------------------------------------- administración (solo ADMIN_EMAILS)
// GET /api/invitados → { email: string; agregadoEn: string; agregadoPor: string }[]
// POST /api/invitados body: { email } → lista actualizada
// DELETE /api/invitados/:email → lista actualizada
export interface Invitado {
  email: string;
  agregadoEn: string;
  agregadoPor: string;
}

// GET /api/uso/resumen → gasto estimado del mes por agente (solo admin)
export interface RespResumenUso {
  mes: string; // YYYY-MM
  totalUsd: number;
  porAgente: { agente: NombreAgente; llamadas: number; usd: number }[];
  porUsuario: { uid: string; email?: string; llamadas: number; usd: number }[];
}

// ---------------------------------------------------------------- tareas programadas (cabecera x-jobs-secret)
// POST /api/jobs/look-del-dia · POST /api/jobs/plan-semanal · POST /api/jobs/recordatorios-lavado
export interface RespJob {
  ok: boolean;
  usuariosProcesados: number;
  detalles: string[];
}

/** Cabecera usada por el cliente */
export const CABECERA_AUTH = 'authorization';
export const CABECERA_JOBS = 'x-jobs-secret';
