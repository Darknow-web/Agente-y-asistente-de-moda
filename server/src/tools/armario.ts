/**
 * Herramientas (function calling) que los agentes pueden usar sobre los datos del cliente.
 * Cada herramienta tiene su definición (para el modelo) y su ejecutor (sobre Firestore).
 */
import type { Herramienta } from '../ai/provider.js';
import type { ContextoCliente } from '../memory/contexto.js';
import type { CategoriaPrenda, Deseo, Perfil, Prenda, Temporada } from '@shared/types.js';
import {
  actualizarPrenda,
  agregarAprendizajes,
  crearDeseo,
  crearPrenda,
  guardarPerfil,
  listarPrendas,
  marcarLavada,
  registrarUso,
} from '../data/repos.js';
import { geocodificar, pronostico, resumenClima } from './clima.js';

const CATEGORIAS: CategoriaPrenda[] = ['superior', 'inferior', 'vestido', 'abrigo', 'calzado', 'accesorio', 'ropa-interior', 'deporte', 'otro'];
const TEMPORADAS: Temporada[] = ['verano', 'invierno', 'entretiempo', 'todo-el-ano'];

export const H = {
  listar_prendas: {
    nombre: 'listar_prendas',
    descripcion: 'Devuelve la lista completa y actualizada de prendas del cliente, con estado y usos. Úsala si necesitas más detalle del que ya tienes en el contexto.',
    parametros: { type: 'object', properties: { categoria: { type: 'string', enum: CATEGORIAS, description: 'Filtrar por categoría (opcional)' } } },
  },
  crear_prenda: {
    nombre: 'crear_prenda',
    descripcion: 'Registra una prenda nueva en el armario del cliente. Solo cuando el cliente confirmó que quiere guardarla.',
    parametros: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre corto y descriptivo, ej. "Camisa blanca de lino"' },
        categoria: { type: 'string', enum: CATEGORIAS },
        subtipo: { type: 'string', description: 'camisa, jean, blazer, zapatilla…' },
        colores: { type: 'array', items: { type: 'string' } },
        tela: { type: 'string' },
        marca: { type: 'string' },
        temporada: { type: 'string', enum: TEMPORADAS },
        ocasiones: { type: 'array', items: { type: 'string' } },
        usosMaxAntesDeLavar: { type: 'integer', description: 'Usos recomendados antes de lavar según tela y tipo' },
        notas: { type: 'string' },
      },
      required: ['nombre', 'categoria', 'colores'],
    },
  },
  editar_prenda: {
    nombre: 'editar_prenda',
    descripcion: 'Corrige datos de una prenda existente (tela, nombre, usos máximos, ocasiones, notas, favorita, estado).',
    parametros: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        cambios: {
          type: 'object',
          properties: {
            nombre: { type: 'string' },
            subtipo: { type: 'string' },
            colores: { type: 'array', items: { type: 'string' } },
            tela: { type: 'string' },
            marca: { type: 'string' },
            temporada: { type: 'string', enum: TEMPORADAS },
            ocasiones: { type: 'array', items: { type: 'string' } },
            usosMaxAntesDeLavar: { type: 'integer' },
            notas: { type: 'string' },
            favorita: { type: 'boolean' },
            estado: { type: 'string', enum: ['limpia', 'usada', 'para-lavar', 'en-lavado', 'reparar', 'guardada'] },
          },
        },
      },
      required: ['id', 'cambios'],
    },
  },
  registrar_uso: {
    nombre: 'registrar_uso',
    descripcion: 'Anota que el cliente usó una prenda hoy (suma un uso; si llega al máximo, pasa a "para-lavar").',
    parametros: {
      type: 'object',
      properties: { id: { type: 'string' }, contexto: { type: 'string', description: 'oficina, cena, gimnasio…' } },
      required: ['id'],
    },
  },
  marcar_lavada: {
    nombre: 'marcar_lavada',
    descripcion: 'Marca una prenda como recién lavada (usos a cero, estado limpia).',
    parametros: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  guardar_deseo: {
    nombre: 'guardar_deseo',
    descripcion: 'Guarda una prenda que el cliente quiere comprar (lista de deseos / compras guardadas).',
    parametros: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        motivo: { type: 'string', description: 'Qué vacío del armario llena' },
        prioridad: { type: 'string', enum: ['alta', 'media', 'baja'] },
        precioObjetivo: { type: 'number' },
        enlaces: {
          type: 'array',
          items: {
            type: 'object',
            properties: { titulo: { type: 'string' }, url: { type: 'string' }, precio: { type: 'string' }, tienda: { type: 'string' } },
            required: ['titulo', 'url'],
          },
        },
      },
      required: ['nombre', 'prioridad'],
    },
  },
  actualizar_perfil: {
    nombre: 'actualizar_perfil',
    descripcion: 'Guarda algo que el cliente contó sobre sí mismo: ciudad, tallas, estilo, rutina, colores, presupuesto, o un aprendizaje libre ("no le gusta el poliéster"). Úsala cada vez que aprendas algo útil y duradero.',
    parametros: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        genero: { type: 'string', enum: ['mujer', 'hombre', 'otro', 'prefiero-no-decir'] },
        ciudad: { type: 'string' },
        pais: { type: 'string' },
        tallas: { type: 'object', properties: { superior: { type: 'string' }, inferior: { type: 'string' }, calzado: { type: 'string' }, otros: { type: 'string' } } },
        estilo: { type: 'array', items: { type: 'string' } },
        coloresFavoritos: { type: 'array', items: { type: 'string' } },
        coloresEvitar: { type: 'array', items: { type: 'string' } },
        rutina: { type: 'object', description: 'Ej. {"lunes":["oficina","gimnasio"]}', properties: {}, additionalProperties: { type: 'array', items: { type: 'string' } } },
        presupuestoMensual: { type: 'number' },
        moneda: { type: 'string' },
        aprendizajes: { type: 'array', items: { type: 'string' }, description: 'Frases cortas que conviene recordar' },
      },
    },
  },
  clima: {
    nombre: 'clima',
    descripcion: 'Pronóstico de los próximos 7 días para una ciudad (por defecto la del perfil).',
    parametros: { type: 'object', properties: { ciudad: { type: 'string' }, pais: { type: 'string' } } },
  },
} satisfies Record<string, Herramienta>;

export type NombreHerramienta = keyof typeof H;

export function herramientas(...nombres: NombreHerramienta[]): Herramienta[] {
  return nombres.map((n) => H[n]);
}

/** Ejecutor genérico: resuelve cualquier herramienta de este módulo sobre el cliente. */
export function ejecutorArmario(ctx: ContextoCliente) {
  return async (nombre: string, a: Record<string, unknown>): Promise<unknown> => {
    switch (nombre as NombreHerramienta) {
      case 'listar_prendas': {
        const prendas = await listarPrendas(ctx.uid);
        ctx.prendas = prendas;
        const cat = a.categoria as CategoriaPrenda | undefined;
        return (cat ? prendas.filter((p) => p.categoria === cat) : prendas).map(compactar);
      }
      case 'crear_prenda': {
        const datos = a as Partial<Prenda>;
        const prenda = await crearPrenda(ctx.uid, {
          nombre: String(datos.nombre ?? 'Prenda'),
          categoria: (datos.categoria as CategoriaPrenda) ?? 'otro',
          subtipo: datos.subtipo,
          colores: Array.isArray(datos.colores) ? (datos.colores as string[]) : [],
          tela: datos.tela,
          marca: datos.marca,
          temporada: datos.temporada,
          ocasiones: datos.ocasiones,
          estado: 'limpia',
          usosDesdeLavado: 0,
          usosMaxAntesDeLavar: Number(datos.usosMaxAntesDeLavar ?? 3),
          notas: datos.notas,
        });
        ctx.prendas = [prenda, ...ctx.prendas];
        return compactar(prenda);
      }
      case 'editar_prenda': {
        const p = await actualizarPrenda(ctx.uid, String(a.id), (a.cambios ?? {}) as Partial<Prenda>);
        if (!p) return { error: 'No existe esa prenda.' };
        ctx.prendas = ctx.prendas.map((x) => (x.id === p.id ? p : x));
        return compactar(p);
      }
      case 'registrar_uso': {
        const p = await registrarUso(ctx.uid, String(a.id), a.contexto ? String(a.contexto) : undefined);
        if (!p) return { error: 'No existe esa prenda.' };
        ctx.prendas = ctx.prendas.map((x) => (x.id === p.id ? p : x));
        return compactar(p);
      }
      case 'marcar_lavada': {
        const p = await marcarLavada(ctx.uid, String(a.id));
        if (!p) return { error: 'No existe esa prenda.' };
        ctx.prendas = ctx.prendas.map((x) => (x.id === p.id ? p : x));
        return compactar(p);
      }
      case 'guardar_deseo': {
        const d = await crearDeseo(ctx.uid, {
          nombre: String(a.nombre),
          motivo: a.motivo ? String(a.motivo) : undefined,
          prioridad: (a.prioridad as Deseo['prioridad']) ?? 'media',
          precioObjetivo: typeof a.precioObjetivo === 'number' ? a.precioObjetivo : undefined,
          enlaces: Array.isArray(a.enlaces) ? (a.enlaces as Deseo['enlaces']) : undefined,
        });
        return d;
      }
      case 'actualizar_perfil': {
        const { aprendizajes, ...resto } = a as Partial<Perfil> & { aprendizajes?: string[] };
        const limpio = Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== undefined && v !== null && v !== ''));
        if (Object.keys(limpio).length) ctx.perfil = await guardarPerfil(ctx.uid, limpio as Partial<Perfil>);
        if (aprendizajes?.length) {
          await agregarAprendizajes(ctx.uid, aprendizajes);
          ctx.perfil.aprendizajes = [...(ctx.perfil.aprendizajes ?? []), ...aprendizajes];
        }
        return { ok: true, perfil: ctx.perfil };
      }
      case 'clima': {
        const ciudad = (a.ciudad as string) || ctx.perfil.ciudad;
        if (!ciudad) return { error: 'No conocemos la ciudad del cliente. Pregúntasela.' };
        const geo = await geocodificar(ciudad, (a.pais as string) || ctx.perfil.pais);
        if (!geo) return { error: `No encontramos la ciudad "${ciudad}".` };
        const dias = await pronostico(geo.lat, geo.lon, ctx.zona);
        return { lugar: geo.nombre, dias: dias.map((d) => ({ fecha: d.fecha, resumen: resumenClima(d), lluvia: d.lluvia })) };
      }
      default:
        return { error: `Herramienta desconocida: ${nombre}` };
    }
  };
}

function compactar(p: Prenda) {
  return {
    id: p.id,
    nombre: p.nombre,
    categoria: p.categoria,
    subtipo: p.subtipo,
    colores: p.colores,
    tela: p.tela,
    marca: p.marca,
    temporada: p.temporada,
    ocasiones: p.ocasiones,
    estado: p.estado,
    usosDesdeLavado: p.usosDesdeLavado,
    usosMaxAntesDeLavar: p.usosMaxAntesDeLavar,
    favorita: p.favorita,
    notas: p.notas,
  };
}
