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

/** Talla que usa la persona en una marca concreta ("en Zara soy M"). Más útil que centímetros. */
export interface TallaMarca {
  marca: string;
  categoria?: CategoriaPrenda;
  talla: string;
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
  /** Tallas por marca: lo que mejor predice el ajuste. */
  tallasPorMarca?: TallaMarca[];
  estaturaCm?: number;
  /** En palabras de la persona o estimado de una foto: "hombros anchos, cintura marcada". */
  silueta?: string;
  /** Bienvenida de cinco preguntas completada (si no, se ofrece al entrar). */
  bienvenidaCompletada?: boolean;
  /** Ids de las preguntas del día ya respondidas (o saltadas). */
  preguntasHechas?: string[];
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

/** Una manera de ponerse una prenda con lo que hay en el armario. */
export interface FormaDeUso {
  titulo: string;
  /** Prendas del armario que la acompañan (ids reales). */
  prendaIds: string[];
  motivo: string;
  /** Si para que funcione del todo falta una pieza, cuál (una sola). */
  faltaria?: string;
}

export type RetoqueFoto = 'recorte' | 'alisado';

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
  /** Foto tal como la subió el cliente, cuando `fotoUrl` es la versión pulida. */
  fotoOriginalUrl?: string;
  /** Qué se le hizo a la foto: 'recorte' (fondo quitado y luz nivelada) o 'alisado' (además, arrugas suavizadas con IA). */
  fotoRetoque?: RetoqueFoto;
  /** Guardarropa vio la prenda arrugada o con fondo sucio al catalogar: candidata al alisado. */
  fotoArrugada?: boolean;
  notas?: string;
  favorita?: boolean;
  compradaEn?: string;
  precio?: number;
  /** Usos acumulados desde que entró al armario (para el costo por uso y la ropa dormida). */
  usosTotales?: number;
  /** Fecha ISO del último uso registrado. */
  ultimoUso?: string;
  /** "Tres formas de ponértela", calculadas por Estilismo y guardadas. */
  formasDeUso?: FormaDeUso[];
  formasDeUsoEn?: string;
  creadaEn: string;
  actualizadaEn: string;
}

export interface Uso {
  id: string;
  prendaId: string;
  fecha: string; // ISO
  contexto?: string; // "oficina", "cena"
}

export type NivelAjuste = 'ajustado' | 'bien' | 'holgado';

/** Memoria de ajuste: cómo le quedó una prenda o una talla de una marca. */
export interface Ajuste {
  id: string;
  prendaId?: string;
  marca?: string;
  categoria?: CategoriaPrenda;
  talla?: string;
  ajuste: NivelAjuste;
  nota?: string;
  fecha: string;
}

export interface Deseo {
  id: string;
  nombre: string;
  motivo?: string;
  prioridad: 'alta' | 'media' | 'baja';
  precioObjetivo?: number;
  enlaces?: { titulo: string; url: string; precio?: string; tienda?: string }[];
  /** Enfriamiento: cuándo Sastra vuelve a preguntar si sigue queriéndolo (7 días por defecto). */
  recordatorioEn?: string;
  /** Ya se envió el recordatorio y la respuesta de Estilismo. */
  recordado?: boolean;
  /** Con qué prendas del armario lo combinaría (nombres), calculado al recordar. */
  combinaCon?: string[];
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
export type TipoAviso =
  | 'look-del-dia'
  | 'plan-semanal'
  | 'lavado'
  | 'compra'
  | 'estreno'
  | 'dormida'
  | 'deseo'
  | 'diario'
  | 'sistema';

export interface Aviso {
  id: string;
  tipo: TipoAviso;
  titulo: string;
  cuerpo: string;
  /** Departamento que lo generó (para el diario). */
  agente?: NombreAgente;
  datos?: Record<string, unknown>;
  leido: boolean;
  creadoEn: string;
}

/** Suscripción a notificaciones push de un navegador o móvil (Web Push). */
export interface SuscripcionPush {
  id: string;
  endpoint: string;
  claves: { p256dh: string; auth: string };
  dispositivo?: string;
  creadoEn: string;
}

/** Pregunta del día: una sola, con opciones, para completar el perfil sin formularios. */
export interface PreguntaPerfil {
  id: string;
  texto: string;
  /** Opciones de un toque; si está vacío, respuesta libre corta. */
  opciones: string[];
  permiteTexto?: boolean;
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
  modelos: { agente: NombreAgente; proveedor: string; modelo: string; valido: boolean; motivo?: 'sin-lista' | 'no-existe' }[];
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
  /** El texto mostrado hasta ahora era provisional (el modelo siguió trabajando): se empieza de nuevo. */
  | { tipo: 'texto-reiniciar' }
  | { tipo: 'pregunta'; texto: string }
  | { tipo: 'fin'; mensaje: Mensaje }
  | { tipo: 'error'; mensaje: string };
