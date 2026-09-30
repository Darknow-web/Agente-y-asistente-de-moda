/** Perfil: lo que Sastra sabe de ti, editable en línea, y accesos a avisos, deseos y diagnóstico. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Deseo, Genero, Perfil as TipoPerfil } from '@shared/types';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { useCarga } from '@/lib/useCarga';
import { DIAS_SEMANA, fechaMedia } from '@/lib/fechas';
import { Cabecera, EnlaceLinea } from '@/components/Cabecera';
import { Columna } from '@/components/Disposicion';
import { Aviso } from '@/components/Aviso';
import { Cargando } from '@/components/Cargando';

interface Campos {
  nombre: string;
  genero: Genero | '';
  ciudad: string;
  pais: string;
  superior: string;
  inferior: string;
  calzado: string;
  estilo: string;
  coloresFavoritos: string;
  coloresEvitar: string;
  presupuestoMensual: string;
  moneda: string;
  rutina: string[]; // 7 entradas, lunes a domingo
}

const GENEROS: { valor: Genero; texto: string }[] = [
  { valor: 'mujer', texto: 'Mujer' },
  { valor: 'hombre', texto: 'Hombre' },
  { valor: 'otro', texto: 'Otro' },
  { valor: 'prefiero-no-decir', texto: 'Prefiero no decirlo' },
];

const ABREV: Record<string, string> = {
  lunes: 'Lun',
  martes: 'Mar',
  miércoles: 'Mié',
  jueves: 'Jue',
  viernes: 'Vie',
  sábado: 'Sáb',
  domingo: 'Dom',
};

function aCampos(p: TipoPerfil): Campos {
  return {
    nombre: p.nombre ?? '',
    genero: p.genero ?? '',
    ciudad: p.ciudad ?? '',
    pais: p.pais ?? '',
    superior: p.tallas?.superior ?? '',
    inferior: p.tallas?.inferior ?? '',
    calzado: p.tallas?.calzado ?? '',
    estilo: (p.estilo ?? []).join(', '),
    coloresFavoritos: (p.coloresFavoritos ?? []).join(', '),
    coloresEvitar: (p.coloresEvitar ?? []).join(', '),
    presupuestoMensual: p.presupuestoMensual != null ? String(p.presupuestoMensual) : '',
    moneda: p.moneda ?? 'PEN',
    rutina: DIAS_SEMANA.map((d) => (p.rutina?.[d] ?? []).join(', ')),
  };
}

function lista(t: string): string[] {
  return t
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function desdeCampos(c: Campos): Partial<TipoPerfil> {
  const rutina: TipoPerfil['rutina'] = {};
  DIAS_SEMANA.forEach((d, i) => {
    const v = lista(c.rutina[i] ?? '');
    if (v.length) rutina[d] = v;
  });
  const presupuesto = Number.parseFloat(c.presupuestoMensual.replace(',', '.'));
  return {
    nombre: c.nombre.trim() || undefined,
    genero: c.genero || undefined,
    ciudad: c.ciudad.trim() || undefined,
    pais: c.pais.trim() || undefined,
    tallas: {
      superior: c.superior.trim() || undefined,
      inferior: c.inferior.trim() || undefined,
      calzado: c.calzado.trim() || undefined,
    },
    estilo: lista(c.estilo),
    coloresFavoritos: lista(c.coloresFavoritos),
    coloresEvitar: lista(c.coloresEvitar),
    presupuestoMensual: Number.isFinite(presupuesto) ? presupuesto : undefined,
    moneda: c.moneda.trim() || undefined,
    rutina,
  };
}

function simboloMoneda(m?: string): string {
  switch ((m ?? 'PEN').toUpperCase()) {
    case 'PEN':
      return 'S/';
    case 'USD':
      return 'US$';
    case 'EUR':
      return '€';
    case 'MXN':
      return 'MX$';
    default:
      return m ?? '';
  }
}

export function Perfil() {
  const { yo, salir, recargarYo } = useSesion();
  const perfil = yo?.perfil ?? {};
  const [editando, setEditando] = useState(false);
  const [campos, setCampos] = useState<Campos>(() => aCampos(perfil));
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const { datos: avisos } = useCarga(() => api.avisos());
  const { datos: deseos, setDatos: setDeseos, cargando: cargandoDeseos } = useCarga(() => api.deseos());
  const { datos: salud } = useCarga(() => api.salud());

  useEffect(() => {
    if (!editando) setCampos(aCampos(yo?.perfil ?? {}));
  }, [yo, editando]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setAviso(null);
    try {
      await api.guardarPerfil(desdeCampos(campos));
      await recargarYo();
      setEditando(false);
      setAviso({ tipo: 'ok', texto: 'Perfil guardado. Sastra ya lo tiene en cuenta.' });
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo guardar el perfil.' });
    } finally {
      setGuardando(false);
    }
  };

  const quitarDeseo = async (d: Deseo) => {
    try {
      await api.eliminarDeseo(d.id);
      setDeseos((lista) => (lista ?? []).filter((x) => x.id !== d.id));
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo quitar el deseo.' });
    }
  };

  const nombre = perfil.nombre || yo?.nombre?.split(' ')[0] || 'Tu perfil';
  const lugar = [perfil.ciudad, perfil.pais].filter(Boolean).join(', ');
  const desde = perfil.creadoEn ? fechaMedia(perfil.creadoEn) : null;
  const nuevos = (avisos ?? []).filter((a) => !a.leido).length;

  const rutinaTexto = perfil.rutina
    ? DIAS_SEMANA.filter((d) => perfil.rutina?.[d]?.length)
        .map((d) => `${ABREV[d]}: ${perfil.rutina?.[d]?.join(', ')}`)
        .join(' · ')
    : '';
  const tallasTexto = [
    perfil.tallas?.superior ? `Superior ${perfil.tallas.superior}` : '',
    perfil.tallas?.inferior ? `Inferior ${perfil.tallas.inferior}` : '',
    perfil.tallas?.calzado ? `Calzado ${perfil.tallas.calzado}` : '',
    perfil.tallas?.otros ?? '',
  ]
    .filter(Boolean)
    .join(' · ');

  const campo = (clave: keyof Omit<Campos, 'rutina'>, etiqueta: string, placeholder?: string, tipo = 'text') => (
    <div>
      <label htmlFor={`perfil-${clave}`} className="campo-etiqueta">
        {etiqueta}
      </label>
      <input
        id={`perfil-${clave}`}
        className="campo"
        type={tipo}
        inputMode={tipo === 'number' ? 'decimal' : undefined}
        placeholder={placeholder}
        value={campos[clave]}
        onChange={(e) => setCampos({ ...campos, [clave]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="aparece">
      <Columna>
        <Cabecera
          titulo={nombre}
          accion={<EnlaceLinea onClick={() => setEditando((v) => !v)}>{editando ? 'Cancelar' : 'Editar'}</EnlaceLinea>}
        >
          <p className="m-0 mt-[10px] text-[14px] text-[var(--texto-2)]">
            {[lugar, desde ? `Sastra te conoce desde el ${desde}` : yo?.email].filter(Boolean).join(' · ')}
          </p>
        </Cabecera>

        {aviso ? (
          <div className="mt-5 max-w-[40rem]">
            <Aviso tipo={aviso.tipo} onCerrar={() => setAviso(null)}>
              {aviso.texto}
            </Aviso>
          </div>
        ) : null}

        <div className="lg:grid lg:grid-cols-12 lg:gap-x-6">
          <div className="lg:col-span-7">
            {editando ? (
              <form onSubmit={(e) => void guardar(e)} className="mt-[22px] flex flex-col gap-8 border-t border-[var(--texto)] pt-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  {campo('nombre', 'Cómo quieres que te llame')}
                  <div>
                    <label htmlFor="perfil-genero" className="campo-etiqueta">
                      Género
                    </label>
                    <select
                      id="perfil-genero"
                      className="campo"
                      value={campos.genero}
                      onChange={(e) => setCampos({ ...campos, genero: e.target.value as Genero | '' })}
                    >
                      <option value="">Sin definir</option>
                      {GENEROS.map((g) => (
                        <option key={g.valor} value={g.valor}>
                          {g.texto}
                        </option>
                      ))}
                    </select>
                  </div>
                  {campo('ciudad', 'Ciudad', 'Lima')}
                  {campo('pais', 'País', 'Perú')}
                </div>

                <fieldset className="m-0 border-0 p-0">
                  <legend className="campo-etiqueta mb-3">Tu estilo, en tus palabras</legend>
                  <div className="grid gap-5">
                    {campo('estilo', 'Estilo', 'minimalista, cómoda, colores neutros')}
                    {campo('coloresFavoritos', 'Colores que te gustan', 'crudo, negro, azul marino')}
                    {campo('coloresEvitar', 'Colores que evitas', 'naranja, estampados grandes')}
                  </div>
                </fieldset>

                <fieldset className="m-0 border-0 p-0">
                  <legend className="campo-etiqueta mb-3">Rutina por día</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {DIAS_SEMANA.map((d, i) => (
                      <div key={d}>
                        <label htmlFor={`rutina-${d}`} className="campo-etiqueta capitalize">
                          {d}
                        </label>
                        <input
                          id={`rutina-${d}`}
                          className="campo"
                          placeholder="oficina, gimnasio"
                          value={campos.rutina[i] ?? ''}
                          onChange={(e) => {
                            const r = [...campos.rutina];
                            r[i] = e.target.value;
                            setCampos({ ...campos, rutina: r });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="m-0 border-0 p-0">
                  <legend className="campo-etiqueta mb-3">Tallas</legend>
                  <div className="grid grid-cols-3 gap-4">
                    {campo('superior', 'Superior', 'S')}
                    {campo('inferior', 'Inferior', '27')}
                    {campo('calzado', 'Calzado', '37')}
                  </div>
                </fieldset>

                <fieldset className="m-0 border-0 p-0">
                  <legend className="campo-etiqueta mb-3">Presupuesto de compras</legend>
                  <div className="grid grid-cols-[1fr_120px] gap-4">
                    {campo('presupuestoMensual', 'Al mes', '300', 'number')}
                    {campo('moneda', 'Moneda', 'PEN')}
                  </div>
                </fieldset>

                <div className="flex gap-3">
                  <button type="submit" className="boton flex-1" disabled={guardando}>
                    {guardando ? 'Guardando' : 'Guardar perfil'}
                  </button>
                  <button type="button" className="boton-2 flex-1" onClick={() => setEditando(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <dl className="mt-[22px] flex flex-col border-t border-[var(--texto)]">
                <Fila dt="Tu estilo, en tus palabras" dd={perfil.estilo?.length ? perfil.estilo.join(', ') : undefined} vacio="Cuéntaselo a Sastra en Editar." />
                <Fila dt="Rutina" dd={rutinaTexto || undefined} vacio="Con tu rutina, Planificación arma mejor la semana." />
                <Fila dt="Tallas" dd={tallasTexto || undefined} vacio="Sirven en el probador para saber qué talla pedir." />
                <Fila dt="Lo que Sastra ha aprendido" dd={perfil.aprendizajes?.length ? perfil.aprendizajes.join('. ') + '.' : undefined} vacio="Se irá llenando con tus conversaciones." />
                <Fila
                  dt="Presupuesto de compras"
                  dd={perfil.presupuestoMensual != null ? `${simboloMoneda(perfil.moneda)} ${perfil.presupuestoMensual} al mes` : undefined}
                  vacio="Sin presupuesto, Personal Shopper propone sin límite."
                />
              </dl>
            )}
          </div>

          <div className="mt-[22px] flex flex-col gap-[10px] lg:col-span-4 lg:col-start-9 lg:mt-[22px]">
            <EnlaceCaja a="/avisos" texto="Avisos y recordatorios" meta={avisos ? (nuevos ? `${nuevos} ${nuevos === 1 ? 'nuevo' : 'nuevos'}` : 'Al día') : ''} />
            <EnlaceCaja a="#deseos" texto="Lista de deseos" meta={deseos ? `${deseos.length} ${deseos.length === 1 ? 'prenda' : 'prendas'}` : ''} />
            <EnlaceCaja a="/probador" texto="Probador" meta="Foto o video" />
            <EnlaceCaja
              a="/diagnostico"
              texto="Diagnóstico de la app"
              meta={salud ? (salud.ok ? 'Todo en orden' : 'Revisar') : ''}
            />
            {yo?.admin ? <EnlaceCaja a="/invitados" texto="Invitados" meta="Administrar" /> : null}
          </div>
        </div>

        <section id="deseos" className="mt-12 max-w-[40rem]">
          <h2 className="h3 m-0">Lista de deseos</h2>
          {cargandoDeseos ? (
            <div className="pt-4">
              <Cargando compacto texto="Buscando" />
            </div>
          ) : !deseos?.length ? (
            <p className="m-0 mt-3 text-[14px] leading-[1.5] text-[var(--texto-2)]">
              Aún no hay deseos. En el probador o en el chat, pide a Sastra que guarde una prenda que te gustó.
            </p>
          ) : (
            <ul className="m-0 mt-4 list-none border-t border-[var(--texto)] p-0">
              {deseos.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-4 border-b border-[var(--linea)] py-[14px]">
                  <div className="flex flex-col gap-1">
                    <span className="text-[15px] leading-[1.35]">{d.nombre}</span>
                    <span className="text-[12px] text-[var(--texto-2)]">
                      {[
                        `Prioridad ${d.prioridad}`,
                        d.precioObjetivo != null ? `hasta ${simboloMoneda(perfil.moneda)} ${d.precioObjetivo}` : '',
                        d.motivo ?? '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {d.enlaces?.length ? (
                      <span className="flex flex-wrap gap-x-4 text-[12px]">
                        {d.enlaces.map((e) => (
                          <a key={e.url} href={e.url} target="_blank" rel="noreferrer" className="border-b border-[var(--texto)]">
                            {e.tienda ?? e.titulo}
                            {e.precio ? ` · ${e.precio}` : ''}
                          </a>
                        ))}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-11 shrink-0 items-center text-[12px] text-[var(--texto-2)] hover:text-[var(--texto)]"
                    onClick={() => void quitarDeseo(d)}
                  >
                    <span className="border-b border-current">Quitar</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-12 pb-16">
          <button type="button" className="boton-2" onClick={() => void salir()}>
            Salir
          </button>
        </div>
      </Columna>
    </div>
  );
}

function Fila({ dt, dd, vacio }: { dt: string; dd?: string; vacio: string }) {
  return (
    <div className="border-b border-[var(--linea)] py-[14px]">
      <dt>{dt}</dt>
      <dd className={dd ? '' : 'text-[var(--texto-2)]'}>{dd ?? vacio}</dd>
    </div>
  );
}

function EnlaceCaja({ a, texto, meta }: { a: string; texto: string; meta: string }) {
  const contenido = (
    <>
      {texto}
      <span className="text-[12px] text-[var(--texto-2)]">{meta}</span>
    </>
  );
  const clase = 'flex h-12 items-center justify-between border border-[var(--texto)] px-4 text-[14px] font-medium';
  return a.startsWith('#') ? (
    <a href={a} className={clase}>
      {contenido}
    </a>
  ) : (
    <Link to={a} className={clase}>
      {contenido}
    </Link>
  );
}
