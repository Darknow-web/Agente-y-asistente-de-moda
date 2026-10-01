/**
 * Añadir prenda: foto → Guardarropa cataloga → revisas la propuesta → se guarda.
 * Varias fotos de la galería → se catalogan en paralelo y se guardan todas de una vez (lote).
 */
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Adjunto } from '@shared/types';
import type { RespCatalogar } from '@shared/api';
import { api } from '@/lib/api';
import { comprimirImagen, urlDeAdjunto } from '@/lib/imagenes';
import { Cabecera } from '@/components/Cabecera';
import { Columna } from '@/components/Disposicion';
import { Cargando } from '@/components/Cargando';
import { Aviso } from '@/components/Aviso';
import { IconoCamara } from '@/components/Iconos';
import { aCampos, desdeCampos, FormularioPrenda, type CamposPrenda } from '@/components/FormularioPrenda';

type Fase = 'foto' | 'catalogando' | 'revisar' | 'guardando' | 'lote';

interface ItemLote {
  id: string;
  archivo: File;
  adjunto?: Adjunto;
  estado: 'preparando' | 'catalogando' | 'listo' | 'guardando' | 'guardada' | 'error';
  propuesta?: RespCatalogar['propuesta'];
  error?: string;
}

/** Fotos que se procesan a la vez en un lote (más no acelera: el límite lo pone el motor). */
const EN_PARALELO = 3;

/** Ejecuta `fn` sobre cada elemento con como máximo `n` a la vez. */
async function enParalelo<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const obrero = async () => {
    while (i < items.length) {
      const item = items[i++]!;
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, obrero));
}

const ETIQUETA_ESTADO: Record<ItemLote['estado'], string> = {
  preparando: 'Preparando',
  catalogando: 'Guardarropa la mira',
  listo: 'Lista',
  guardando: 'Guardando',
  guardada: 'En el armario',
  error: 'Falló',
};

export function NuevaPrenda() {
  const navegar = useNavigate();
  const [fase, setFase] = useState<Fase>('foto');
  const [foto, setFoto] = useState<Adjunto | null>(null);
  const [pista, setPista] = useState('');
  const [campos, setCampos] = useState<CamposPrenda | null>(null);
  const [preguntas, setPreguntas] = useState<string[]>([]);
  const [respuestas, setRespuestas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lote, setLote] = useState<ItemLote[]>([]);
  const [guardandoLote, setGuardandoLote] = useState(false);
  const camaraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

  const actualizarItem = (id: string, cambios: Partial<ItemLote>) =>
    setLote((lista) => lista.map((it) => (it.id === id ? { ...it, ...cambios } : it)));

  /** Cataloga un elemento del lote (comprime + Guardarropa en modo rápido). */
  const catalogarItem = async (item: ItemLote) => {
    try {
      let adjunto = item.adjunto;
      if (!adjunto) {
        actualizarItem(item.id, { estado: 'preparando', error: undefined });
        adjunto = await comprimirImagen(item.archivo, 896);
        actualizarItem(item.id, { adjunto });
      }
      actualizarItem(item.id, { estado: 'catalogando', error: undefined });
      const r = await api.catalogar({ foto: adjunto, pista: pista.trim() || undefined, rapido: true });
      actualizarItem(item.id, { estado: 'listo', propuesta: r.propuesta });
    } catch (e) {
      actualizarItem(item.id, { estado: 'error', error: e instanceof Error ? e.message : 'No se pudo catalogar.' });
    }
  };

  /** Varias fotos a la vez: lote. */
  const alElegirVarias = async (archivos: File[]) => {
    setError(null);
    const nuevos: ItemLote[] = archivos.map((archivo, i) => ({ id: `${Date.now()}-${i}`, archivo, estado: 'preparando' }));
    setLote((lista) => [...lista, ...nuevos]);
    setFase('lote');
    await enParalelo(nuevos, EN_PARALELO, catalogarItem);
  };

  const reintentarFallidas = async () => {
    const fallidas = lote.filter((it) => it.estado === 'error');
    await enParalelo(fallidas, EN_PARALELO, catalogarItem);
  };

  const guardarLote = async () => {
    const listas = lote.filter((it) => it.estado === 'listo' && it.propuesta);
    if (!listas.length) return;
    setGuardandoLote(true);
    setError(null);
    await enParalelo(listas, EN_PARALELO, async (item) => {
      actualizarItem(item.id, { estado: 'guardando' });
      try {
        const creada = await api.crearPrenda({
          prenda: { ...item.propuesta!, estado: 'limpia', usosDesdeLavado: 0, favorita: false },
          foto: item.adjunto,
        });
        actualizarItem(item.id, { estado: 'guardada' });
        if (creada.fotoUrl) void api.pulirFoto(creada.id).catch(() => undefined); // recorte en segundo plano
      } catch (e) {
        actualizarItem(item.id, { estado: 'error', error: e instanceof Error ? e.message : 'No se pudo guardar.' });
      }
    });
    setGuardandoLote(false);
  };

  const alElegirArchivos = (lista: FileList | null) => {
    const archivos = Array.from(lista ?? []).filter((f) => f.type.startsWith('image/'));
    if (!archivos.length) return;
    if (archivos.length === 1 && fase !== 'lote') void alElegir(archivos[0]);
    else void alElegirVarias(archivos);
  };

  const alElegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    setFase('catalogando');
    try {
      const adjunto = await comprimirImagen(archivo);
      setFoto(adjunto);
      const r = await api.catalogar({ foto: adjunto, pista: pista.trim() || undefined });
      setCampos(aCampos(r.propuesta));
      setPreguntas(r.preguntas ?? []);
      setRespuestas((r.preguntas ?? []).map(() => ''));
      setFase('revisar');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo catalogar la foto.');
      // Si ya había una propuesta (cambio de foto), se conserva; si no, se vuelve a elegir foto.
      setFase(campos ? 'revisar' : 'foto');
    }
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campos) return;
    setFase('guardando');
    setError(null);
    try {
      const base = desdeCampos(campos);
      const notasExtra = preguntas
        .map((p, i) => (respuestas[i]?.trim() ? `${p} ${respuestas[i].trim()}` : ''))
        .filter(Boolean);
      const notas = [base.notas, ...notasExtra].filter(Boolean).join('\n') || undefined;
      const creada = await api.crearPrenda({
        prenda: { ...base, notas, estado: 'limpia', usosDesdeLavado: 0, favorita: false },
        foto: foto ?? undefined,
      });
      if (creada.fotoUrl) void api.pulirFoto(creada.id).catch(() => undefined); // recorte en segundo plano
      navegar('/armario', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la prenda.');
      setFase('revisar');
    }
  };

  const vistaFoto = foto ? urlDeAdjunto(foto) : undefined;

  return (
    <div className="aparece">
      <Columna>
        <Cabecera
          titulo="Nueva prenda"
          accion={
            <Link to="/armario" className="inline-flex min-h-11 items-end text-[13px]">
              <span className="border-b border-[var(--texto)] pb-[2px]">Armario</span>
            </Link>
          }
        >
          <p className="m-0 mt-[10px] text-[14px] leading-[1.45] text-[var(--texto-2)]">
            {fase === 'foto'
              ? 'Una prenda por foto, estirada o colgada, sobre fondo liso y con luz de día. Guardarropa la cataloga, quita el fondo y nivela la luz. Si eliges varias de la galería, se catalogan todas a la vez.'
              : fase === 'catalogando'
                ? 'Guardarropa está mirando la foto.'
                : fase === 'lote'
                  ? 'Guardarropa cataloga cada foto. Puedes corregir el nombre aquí y el resto después, desde la prenda.'
                  : 'Revisa lo que propone Guardarropa y corrige lo que haga falta.'}
          </p>
        </Cabecera>

        <input
          ref={camaraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="visualmente-oculto"
          onChange={(e) => void alElegir(e.target.files?.[0])}
        />
        <input
          ref={galeriaRef}
          type="file"
          accept="image/*"
          multiple
          className="visualmente-oculto"
          onChange={(e) => {
            alElegirArchivos(e.target.files);
            e.target.value = '';
          }}
        />

        {error ? (
          <div className="mt-6">
            <Aviso tipo="error" onCerrar={() => setError(null)}>
              {error}
            </Aviso>
          </div>
        ) : null}

        {fase === 'foto' ? (
          <div className="mt-8 flex max-w-[34rem] flex-col gap-6">
            <div>
              <label htmlFor="pista" className="campo-etiqueta">
                Algo que ayude (opcional)
              </label>
              <input
                id="pista"
                className="campo"
                value={pista}
                onChange={(e) => setPista(e.target.value)}
                placeholder="Es una camisa de lino que compré en Zara"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" className="boton flex-1" onClick={() => camaraRef.current?.click()}>
                <IconoCamara tamano={18} />
                Tomar foto
              </button>
              <button type="button" className="boton-2 flex-1" onClick={() => galeriaRef.current?.click()}>
                Elegir de la galería (una o varias)
              </button>
            </div>
          </div>
        ) : null}

        {fase === 'lote' ? (
          <div className="mt-8 flex flex-col gap-6 pb-16">
            <ul className="m-0 list-none border-t border-[var(--texto)] p-0">
              {lote.map((it) => {
                const vista = it.adjunto ? urlDeAdjunto(it.adjunto) : undefined;
                const enCurso = it.estado === 'preparando' || it.estado === 'catalogando' || it.estado === 'guardando';
                return (
                  <li key={it.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-4 border-b border-[var(--hilo)] py-3">
                    {vista ? (
                      <img src={vista} alt="" className="aspect-[4/5] w-14 object-cover" />
                    ) : (
                      <div className="aspect-[4/5] w-14 bg-[var(--hilo)]" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      {it.estado === 'listo' && it.propuesta ? (
                        <input
                          className="campo"
                          aria-label="Nombre de la prenda"
                          value={it.propuesta.nombre}
                          onChange={(e) => actualizarItem(it.id, { propuesta: { ...it.propuesta!, nombre: e.target.value } })}
                        />
                      ) : (
                        <p className="m-0 truncate text-[14px]">{it.propuesta?.nombre ?? it.archivo.name}</p>
                      )}
                      <p className="m-0 mt-1 text-[12px] text-[var(--texto-2)]">
                        {it.estado === 'error' ? (it.error ?? ETIQUETA_ESTADO.error) : it.propuesta ? `${it.propuesta.categoria}${it.propuesta.colores?.length ? ` · ${it.propuesta.colores.join(', ')}` : ''}` : ETIQUETA_ESTADO[it.estado]}
                      </p>
                    </div>
                    <span className={`text-[12px] ${it.estado === 'error' ? 'text-[var(--anil)]' : 'text-[var(--texto-2)]'}`} aria-live="polite">
                      {enCurso ? ETIQUETA_ESTADO[it.estado] : it.estado === 'guardada' ? ETIQUETA_ESTADO.guardada : it.estado === 'error' ? ETIQUETA_ESTADO.error : ''}
                    </span>
                  </li>
                );
              })}
            </ul>

            {(() => {
              const listas = lote.filter((it) => it.estado === 'listo').length;
              const fallidas = lote.filter((it) => it.estado === 'error').length;
              const enCurso = lote.some((it) => it.estado === 'preparando' || it.estado === 'catalogando' || it.estado === 'guardando');
              const guardadas = lote.filter((it) => it.estado === 'guardada').length;
              const todoHecho = !enCurso && listas === 0 && guardadas > 0;
              return (
                <div className="flex flex-col gap-3 sm:flex-row">
                  {todoHecho ? (
                    <Link to="/armario" className="boton flex-1">
                      Ver el armario ({guardadas} {guardadas === 1 ? 'prenda nueva' : 'prendas nuevas'})
                    </Link>
                  ) : (
                    <button type="button" className="boton flex-1" disabled={!listas || guardandoLote || enCurso} onClick={() => void guardarLote()}>
                      {guardandoLote ? 'Guardando' : enCurso ? 'Catalogando' : `Guardar ${listas} ${listas === 1 ? 'prenda' : 'prendas'}`}
                    </button>
                  )}
                  {fallidas ? (
                    <button type="button" className="boton-2 flex-1" disabled={enCurso} onClick={() => void reintentarFallidas()}>
                      Reintentar {fallidas} {fallidas === 1 ? 'fallida' : 'fallidas'}
                    </button>
                  ) : null}
                  <button type="button" className="boton-2 flex-1" disabled={enCurso} onClick={() => galeriaRef.current?.click()}>
                    Añadir más fotos
                  </button>
                  {!todoHecho ? (
                    <Link to="/armario" className="boton-2 flex-1">
                      Cancelar
                    </Link>
                  ) : null}
                </div>
              );
            })()}
          </div>
        ) : null}

        {fase === 'catalogando' ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-12">
            {vistaFoto ? (
              <img src={vistaFoto} alt="Foto elegida" className="aspect-[4/5] w-full max-w-[280px] object-cover lg:col-span-4" />
            ) : null}
            <div className="lg:col-span-6">
              <Cargando texto="Guardarropa identifica la prenda, la tela y los usos antes de lavar" />
            </div>
          </div>
        ) : null}

        {(fase === 'revisar' || fase === 'guardando') && campos ? (
          <form onSubmit={(e) => void guardar(e)} className="mt-8 grid gap-8 pb-16 lg:grid-cols-12">
            <div className="flex flex-col gap-3 lg:col-span-4">
              {vistaFoto ? (
                <img src={vistaFoto} alt={campos.nombre || 'Foto de la prenda'} className="aspect-[4/5] w-full object-cover" />
              ) : (
                <div className="aspect-[4/5] w-full bg-[var(--hilo)]" aria-hidden="true" />
              )}
              <button
                type="button"
                className="inline-flex min-h-11 w-fit items-center text-[13px]"
                onClick={() => galeriaRef.current?.click()}
              >
                <span className="border-b border-[var(--texto)] pb-[2px]">Cambiar la foto</span>
              </button>
            </div>

            <div className="flex flex-col gap-8 lg:col-span-7 lg:col-start-6">
              <FormularioPrenda valor={campos} onCambio={(c) => setCampos({ ...campos, ...c })} />

              {preguntas.length ? (
                <fieldset className="m-0 border-0 border-t border-[var(--texto)] p-0 pt-5">
                  <legend className="serif float-left mb-3 w-full text-[20px] leading-[1.2]">
                    Guardarropa pregunta
                  </legend>
                  <div className="clear-both grid gap-5">
                    {preguntas.map((p, i) => (
                      <div key={p}>
                        <label htmlFor={`pregunta-${i}`} className="campo-etiqueta text-[var(--texto)]">
                          {p}
                        </label>
                        <input
                          id={`pregunta-${i}`}
                          className="campo"
                          value={respuestas[i] ?? ''}
                          onChange={(e) => {
                            const copia = [...respuestas];
                            copia[i] = e.target.value;
                            setRespuestas(copia);
                          }}
                          placeholder="Si no lo sabes, déjalo en blanco"
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <div className="flex gap-3">
                <button type="submit" className="boton flex-1" disabled={fase === 'guardando'}>
                  {fase === 'guardando' ? 'Guardando' : 'Guardar en el armario'}
                </button>
                <Link to="/armario" className="boton-2 flex-1">
                  Cancelar
                </Link>
              </div>
            </div>
          </form>
        ) : null}
      </Columna>
    </div>
  );
}
