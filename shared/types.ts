/**
 * Tipos compartidos entre cliente y servidor.
 * Todo en español para que el cliente (no técnico) pueda leerlos.
 */

// ------------------------------------------------------------ perfil
export type Genero = 'mujer' | 'hombre' | 'otro' | 'prefiero-no-decir';

export interface Rutina {
  /** Ej. "lunes": ["oficina", "gimnasio"] */
  [dia: string]: string[];
}

export interface Perfil {
  nombre?: string;
  genero?: Genero;
  ciudad?: string;
  pais?: string;
  /** Latitud/longitud opcional para el clima (se deriva de la ciudad) */
  lat?: number;
  lon?: number;
  tallas?: { superior?: string; inferior?: string; calzado?: string; otros?: string };
  /** Palabras del usuario: "minimalista", "colorido", "clásico", etc. */
  estilo?: string[];
  coloresFavoritos?: string[];
  coloresEvitar?: string[];
  rutina?: Rutina;
  /** Notas libres que los agentes van aprendiendo: "no le gusta el poliéster" */
  aprendizajes?: string[];
  presupuestoMensual?: number;
  moneda?: string;
  creadoEn?: string;
  actualizadoEn?: string;
}

// ------------------------------------------------------------ prendas
export type CategoriaPrenda =
  | 'superior'
  | 'inferior'
  | 'vestido'
  | 'abrigo'
  | 'calzado'
  | 'accesorio'
  | 'ropa-interior'
  | 'deporte'
  | 'otro';

export type EstadoPrenda = 'limpia' | 'usada' | 'para-lavar' | 'en-lavado' | 'reparar' | 'guardada';

export type Temporada = 'verano' | 'invierno' | 'entretiempo' | 'todo-el-ano';

export interface Prenda {
  id: string;
  nombre: string;
  categoria: CategoriaPrenda;
  subtipo?: string; // "camisa", "jean", "blazer", "zapatilla"…
  colores: string[]; // ["azul marino", "blanco"]
  tela?: string; // "algodón", "lana", "lino", "poliéster"…
  marca?: string;
  temporada?: Temporada;
  ocasiones?: string[]; // ["oficina", "casual", "fiesta", "deporte"]
  estado: EstadoPrenda;
  /** Usos desde el último lavado */
  usosDesdeLavado: number;
  /** Usos recomendados antes de lavar (lo fija Cuidado según la tela) */
  usosMaxAntesDeLavar: number;
  fotoUrl?: string;
  fotoMiniUrl?: string;
  notas?: string;
  favorita?: boolean;
  compradaEn?: string;
  precio?: number;
  creadaEn: string;
  actualizadaEn: string;
}

export interface Uso {
  id: string;
  prendaId: string;
  fecha: string; // ISO
  contexto?: string; // "oficina", "cena"
}

export interface Deseo {
  id: string;
  nombre: string;
  motivo?: string;
  prioridad: 'alta' | 'media' | 'baja';
  precioObjetivo?: number;
  enlaces?: { titulo: string; url: string; precio?: string; tienda?: string }[];
  creadoEn: string;
}

// ------------------------------------------------------------ planes
export interface Look {
  titulo: string;
  prendaIds: string[];
  motivo: string;
  clima?: string;
  ocasion?: string;
}

export interface PlanDia {
  fecha: string; // YYYY-MM-DD
  look: Look;
  alternativa?: Look;
  notas?: string;
}

export interface PlanSemanal {
  id: string;
  semanaInicio: string; // YYYY-MM-DD (lunes)
  dias: PlanDia[];
  generadoPor: string; // agente/modelo
  creadoEn: string;
}

// ------------------------------------------------------------ conversación
export type Rol = 'usuario' | 'sastra';

export interface Adjunto {
  tipo: 'imagen' | 'video';
  mime: string;
  /** base64 sin prefijo data: (solo en tránsito) o URL en Storage */
  datos?: string;
  url?: string;
  nombre?: string;
}

export interface Mensaje {
  id: string;
  rol: Rol;
  texto: string;
  adjuntos?: Adjunto[];
  /** Departamentos que participaron (para mostrar "Estilismo · Cuidado") */
  departamentos?: NombreAgente[];
  creadoEn: string;
}

export interface Conversacion {
  id: string;
  titulo?: string;
  resumen?: string; // resumen acumulado para no enviar todo el historial
  mensajes: Mensaje[];
  actualizadaEn: string;
}

// ------------------------------------------------------------ agentes
export type NombreAgente =
  | 'director'
  | 'guardarropa'
  | 'estilismo'
  | 'planificacion'
  | 'cuidado'
  | 'compras'
  | 'probador'
  | 'calidad';

export const AGENTES: Record<NombreAgente, { titulo: string; departamento: string }> = {
  director: { titulo: 'Dirección Creativa', departamento: 'Dirección' },
  guardarropa: { titulo: 'Guardarropa', departamento: 'Inventario' },
  estilismo: { titulo: 'Estilismo', departamento: 'Estilo' },
  planificacion: { titulo: 'Planificación', departamento: 'Agenda' },
  cuidado: { titulo: 'Cuidado de prendas', departamento: 'Cuidado' },
  compras: { titulo: 'Personal Shopper', departamento: 'Compras' },
  probador: { titulo: 'Probador', departamento: 'Compañía de compras' },
  calidad: { titulo: 'Control de calidad', departamento: 'Calidad' },
};

// ------------------------------------------------------------ avisos (autonomía)
export type TipoAviso = 'look-del-dia' | 'plan-semanal' | 'lavado' | 'compra' | 'sistema';

export interface Aviso {
  id: string;
  tipo: TipoAviso;
  titulo: string;
  cuerpo: string;
  datos?: Record<string, unknown>;
  leido: boolean;
  creadoEn: string;
}

// ------------------------------------------------------------ uso y costos
export interface RegistroUso {
  id: string;
  agente: NombreAgente;
  proveedor: 'gemini' | 'claude' | 'simulado';
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  costoEstimadoUsd: number;
  fecha: string;
}

// ------------------------------------------------------------ API
export interface RespuestaSalud {
  ok: boolean;
  firestore: 'ok' | 'sin-configurar' | 'error';
  storage: 'ok' | 'sin-configurar' | 'error';
  gemini: 'ok' | 'sin-llave' | 'error';
  claude: 'ok' | 'sin-llave' | 'error';
  modelos: { agente: NombreAgente; proveedor: string; modelo: string; valido: boolean }[];
  modo: 'real' | 'simulado';
  detalles?: string[];
}

export interface PeticionChat {
  conversacionId?: string;
  texto: string;
  adjuntos?: Adjunto[];
}

/** Eventos SSE del chat */
export type EventoChat =
  | { tipo: 'inicio'; conversacionId: string; mensajeId: string }
  | { tipo: 'departamento'; agente: NombreAgente; estado: 'trabajando' | 'listo' }
  | { tipo: 'texto'; delta: string }
  | { tipo: 'texto-reiniciar' }
  | { tipo: 'pregunta'; texto: string }
  | { tipo: 'fin'; mensaje: Mensaje }
  | { tipo: 'error'; mensaje: string };
