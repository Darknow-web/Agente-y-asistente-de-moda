/** Campos editables de una prenda (alta y detalle). */
import type { CategoriaPrenda, Prenda, Temporada } from '@shared/types';
import { NOMBRE_CATEGORIA } from '@/pages/Armario';

export interface CamposPrenda {
  nombre: string;
  categoria: CategoriaPrenda;
  subtipo: string;
  colores: string;
  tela: string;
  marca: string;
  temporada: Temporada | '';
  ocasiones: string;
  usosMaxAntesDeLavar: string;
  notas: string;
}

export const NOMBRE_TEMPORADA: Record<Temporada, string> = {
  verano: 'Verano',
  invierno: 'Invierno',
  entretiempo: 'Entretiempo',
  'todo-el-ano': 'Todo el año',
};

type Base = Partial<Omit<Prenda, 'id' | 'creadaEn' | 'actualizadaEn'>>;

export function aCampos(p: Base): CamposPrenda {
  return {
    nombre: p.nombre ?? '',
    categoria: p.categoria ?? 'otro',
    subtipo: p.subtipo ?? '',
    colores: (p.colores ?? []).join(', '),
    tela: p.tela ?? '',
    marca: p.marca ?? '',
    temporada: p.temporada ?? '',
    ocasiones: (p.ocasiones ?? []).join(', '),
    usosMaxAntesDeLavar: p.usosMaxAntesDeLavar != null ? String(p.usosMaxAntesDeLavar) : '3',
    notas: p.notas ?? '',
  };
}

function lista(texto: string): string[] {
  return texto
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function desdeCampos(c: CamposPrenda): Omit<Prenda, 'id' | 'creadaEn' | 'actualizadaEn' | 'estado' | 'usosDesdeLavado'> {
  const usos = Number.parseInt(c.usosMaxAntesDeLavar, 10);
  return {
    nombre: c.nombre.trim() || 'Prenda sin nombre',
    categoria: c.categoria,
    subtipo: c.subtipo.trim() || undefined,
    colores: lista(c.colores),
    tela: c.tela.trim() || undefined,
    marca: c.marca.trim() || undefined,
    temporada: c.temporada || undefined,
    ocasiones: lista(c.ocasiones),
    usosMaxAntesDeLavar: Number.isFinite(usos) && usos > 0 ? usos : 3,
    notas: c.notas.trim() || undefined,
  };
}

export function FormularioPrenda({
  valor,
  onCambio,
  idBase = 'prenda',
}: {
  valor: CamposPrenda;
  onCambio: (cambios: Partial<CamposPrenda>) => void;
  idBase?: string;
}) {
  const campo = (
    clave: keyof CamposPrenda,
    etiqueta: string,
    opciones: { tipo?: string; placeholder?: string; min?: number } = {},
  ) => (
    <div>
      <label htmlFor={`${idBase}-${clave}`} className="campo-etiqueta">
        {etiqueta}
      </label>
      <input
        id={`${idBase}-${clave}`}
        className="campo"
        type={opciones.tipo ?? 'text'}
        inputMode={opciones.tipo === 'number' ? 'numeric' : undefined}
        min={opciones.min}
        placeholder={opciones.placeholder}
        value={valor[clave]}
        onChange={(e) => onCambio({ [clave]: e.target.value } as Partial<CamposPrenda>)}
      />
    </div>
  );

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">{campo('nombre', 'Nombre', { placeholder: 'Camisa blanca de lino' })}</div>
      <div>
        <label htmlFor={`${idBase}-categoria`} className="campo-etiqueta">
          Categoría
        </label>
        <select
          id={`${idBase}-categoria`}
          className="campo"
          value={valor.categoria}
          onChange={(e) => onCambio({ categoria: e.target.value as CategoriaPrenda })}
        >
          {(Object.keys(NOMBRE_CATEGORIA) as CategoriaPrenda[]).map((c) => (
            <option key={c} value={c}>
              {NOMBRE_CATEGORIA[c]}
            </option>
          ))}
        </select>
      </div>
      {campo('subtipo', 'Tipo', { placeholder: 'camisa, jean, blazer' })}
      {campo('colores', 'Colores', { placeholder: 'azul marino, blanco' })}
      {campo('tela', 'Tela', { placeholder: 'algodón, lana, lino' })}
      {campo('marca', 'Marca')}
      <div>
        <label htmlFor={`${idBase}-temporada`} className="campo-etiqueta">
          Temporada
        </label>
        <select
          id={`${idBase}-temporada`}
          className="campo"
          value={valor.temporada}
          onChange={(e) => onCambio({ temporada: e.target.value as Temporada | '' })}
        >
          <option value="">Sin definir</option>
          {(Object.keys(NOMBRE_TEMPORADA) as Temporada[]).map((t) => (
            <option key={t} value={t}>
              {NOMBRE_TEMPORADA[t]}
            </option>
          ))}
        </select>
      </div>
      {campo('ocasiones', 'Ocasiones', { placeholder: 'oficina, casual, fiesta' })}
      {campo('usosMaxAntesDeLavar', 'Usos antes de lavar', { tipo: 'number', min: 1 })}
      <div className="sm:col-span-2">
        <label htmlFor={`${idBase}-notas`} className="campo-etiqueta">
          Notas
        </label>
        <textarea
          id={`${idBase}-notas`}
          className="campo"
          value={valor.notas}
          onChange={(e) => onCambio({ notas: e.target.value })}
          placeholder="Talla, dónde la compraste, cómo te gusta llevarla"
        />
      </div>
    </div>
  );
}
