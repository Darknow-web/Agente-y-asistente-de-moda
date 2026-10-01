/** Detalle de una prenda: foto, atributos editables y acciones de uso, lavado y baja. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { NivelAjuste, Prenda } from '@shared/types';
import { api } from '@/lib/api';
import { useCarga } from '@/lib/useCarga';
import { fechaMedia } from '@/lib/fechas';
import { Columna } from '@/components/Disposicion';
import { Cargando } from '@/components/Cargando';
import { Aviso } from '@/components/Aviso';
import { EstadoVacio } from '@/components/EstadoVacio';
import { FotoPrenda, metaPrenda } from '@/components/TarjetaPrenda';
import { IconoVolver } from '@/components/Iconos';
import { NOMBRE_CATEGORIA } from './Armario';
import { aCampos, desdeCampos, FormularioPrenda, NOMBRE_TEMPORADA, type CamposPrenda } from '@/components/FormularioPrenda';

export function DetallePrenda() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const { datos: prendas, error, cargando, setDatos } = useCarga(() => api.prendas(), [id]);
  const prenda = prendas?.find((p) => p.id === id) ?? null;

  const [editando, setEditando] = useState(false);
  const [campos, setCampos] = useState<CamposPrenda | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [confirmarBaja, setConfirmarBaja] = useState(false);
  const [preguntarAjuste, setPreguntarAjuste] = useState(false);
  const [ajusteGuardado, setAjusteGuardado] = useState<NivelAjuste | null>(null);

  useEffect(() => {
    if (prenda && !editando) setCampos(aCampos(prenda));
  }, [prenda, editando]);

  const registrarUsoYPreguntar = async () => {
    if (!prenda) return;
    setAjusteGuardado(null);
    await accion('uso', () => api.registrarUso(prenda.id), 'Uso registrado.');
    setPreguntarAjuste(true);
  };

  const guardarAjuste = async (nivel: NivelAjuste) => {
    if (!prenda) return;
    try {
      await api.crearAjuste({ prendaId: prenda.id, marca: prenda.marca, categoria: prenda.categoria, ajuste: nivel });
      setAjusteGuardado(nivel);
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo guardar.' });
    } finally {
      setPreguntarAjuste(false);
    }
  };

  const pedirFormas = async (regenerar = false) => {
    if (!prenda) return;
    await accion('formas', () => api.formasDeUso(prenda.id, regenerar), regenerar ? 'Estilismo propuso otras tres.' : 'Estilismo propuso tres formas.');
  };

  const nombreDe = (idPrenda: string) => prendas?.find((p) => p.id === idPrenda)?.nombre ?? null;
  const costoPorUso = prenda?.precio != null && prenda.precio > 0 ? (prenda.usosTotales ? prenda.precio / prenda.usosTotales : null) : undefined;

  const actualizar = (nueva: Prenda) => {
    setDatos((lista) => (lista ?? []).map((p) => (p.id === nueva.id ? nueva : p)));
  };

  const accion = async (nombre: string, fn: () => Promise<Prenda>, mensaje: string) => {
    setOcupado(nombre);
    setAviso(null);
    try {
      actualizar(await fn());
      setAviso({ tipo: 'ok', texto: mensaje });
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo completar.' });
    } finally {
      setOcupado(null);
    }
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campos || !prenda) return;
    await accion('guardar', () => api.editarPrenda(prenda.id, desdeCampos(campos)), 'Cambios guardados.');
    setEditando(false);
  };

  const eliminar = async () => {
    if (!prenda) return;
    setOcupado('eliminar');
    try {
      await api.eliminarPrenda(prenda.id);
      navegar('/armario', { replace: true });
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo eliminar.' });
      setOcupado(null);
    }
  };

  return (
    <div className="aparece">
      <Columna>
        <header className="flex h-14 items-center justify-between pt-[18px] lg:h-auto lg:pt-10">
          <Link to="/armario" aria-label="Volver al armario" className="-ml-2 inline-flex h-11 w-11 items-center justify-center">
            <IconoVolver />
          </Link>
          {prenda ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center text-[13px]"
              onClick={() => setEditando((v) => !v)}
            >
              <span className="border-b border-[var(--texto)] pb-[2px]">{editando ? 'Cancelar' : 'Editar'}</span>
            </button>
          ) : null}
        </header>
      </Columna>

      {cargando ? (
        <Columna className="pt-6">
          <Cargando texto="Buscando la prenda" />
        </Columna>
      ) : error ? (
        <Columna className="pt-6">
          <Aviso tipo="error">{error}</Aviso>
        </Columna>
      ) : !prenda ? (
        <Columna className="pt-8">
          <EstadoVacio
            titulo="Esa prenda ya no está en tu armario."
            accion={
              <Link to="/armario" className="boton-2">
                Volver al armario
              </Link>
            }
          />
        </Columna>
      ) : (
        <div className="grid gap-6 px-[var(--margen)] pt-4 pb-16 lg:grid-cols-12 lg:gap-x-6 lg:px-16 lg:pt-8">
          <div className="lg:col-span-5">
            <FotoPrenda prenda={prenda} className="aspect-[4/5]" sizes="(min-width: 1024px) 40vw, 100vw" />
            {prenda.fotoUrl ? (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px] text-[var(--texto-2)]">
                <span>
                  {prenda.fotoRetoque === 'alisado'
                    ? 'Fondo recortado y arrugas alisadas.'
                    : prenda.fotoRetoque === 'recorte'
                      ? 'Fondo recortado y luz nivelada.'
                      : 'Foto tal como se subió.'}
                </span>
                <span className="flex gap-4">
                  <button
                    type="button"
                    className="min-h-11 border-b border-[var(--texto)] text-[var(--texto)] disabled:opacity-50"
                    disabled={ocupado !== null}
                    onClick={() => void accion('mejorar', () => api.mejorarFoto(prenda.id), 'Foto mejorada: fondo recortado y arrugas alisadas.')}
                  >
                    {ocupado === 'mejorar' ? 'Mejorando, medio minuto' : 'Mejorar foto'}
                  </button>
                  {prenda.fotoOriginalUrl ? (
                    <button
                      type="button"
                      className="min-h-11 border-b border-[var(--linea)] disabled:opacity-50"
                      disabled={ocupado !== null}
                      onClick={() => void accion('original', () => api.fotoOriginal(prenda.id), 'Volvió la foto original.')}
                    >
                      Ver original
                    </button>
                  ) : null}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-6 lg:col-span-6 lg:col-start-7">
            <div className="flex flex-col gap-[6px]">
              <h1 className="h2 m-0">{prenda.nombre}</h1>
              <p className={`m-0 text-[13px] ${prenda.estado === 'para-lavar' ? 'text-[var(--anil)]' : 'text-[var(--texto-2)]'}`}>
                {metaPrenda(prenda)}
              </p>
            </div>

            {aviso ? (
              <Aviso tipo={aviso.tipo} onCerrar={() => setAviso(null)}>
                {aviso.texto}
              </Aviso>
            ) : null}

            {editando && campos ? (
              <form onSubmit={(e) => void guardar(e)} className="flex flex-col gap-6">
                <FormularioPrenda valor={campos} onCambio={(c) => setCampos({ ...campos, ...c })} idBase="detalle" />
                <div className="flex gap-3">
                  <button type="submit" className="boton flex-1" disabled={ocupado === 'guardar'}>
                    {ocupado === 'guardar' ? 'Guardando' : 'Guardar cambios'}
                  </button>
                  <button type="button" className="boton-2 flex-1" onClick={() => setEditando(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <dl className="flex flex-col border-t border-[var(--texto)]">
                  <Fila dt="Categoría" dd={`${NOMBRE_CATEGORIA[prenda.categoria]}${prenda.subtipo ? ` · ${prenda.subtipo}` : ''}`} />
                  <Fila dt="Colores" dd={prenda.colores?.join(', ')} />
                  <Fila dt="Tela" dd={prenda.tela} />
                  <Fila dt="Marca" dd={prenda.marca} />
                  <Fila dt="Temporada" dd={prenda.temporada ? NOMBRE_TEMPORADA[prenda.temporada] : undefined} />
                  <Fila dt="Ocasiones" dd={prenda.ocasiones?.join(', ')} />
                  <Fila dt="Notas" dd={prenda.notas} />
                  <Fila dt="En tu armario desde" dd={fechaMedia(prenda.compradaEn ?? prenda.creadaEn)} />
                  <Fila dt="Último uso" dd={prenda.ultimoUso ? `${fechaMedia(prenda.ultimoUso)} · ${prenda.usosTotales ?? 1} ${(prenda.usosTotales ?? 1) === 1 ? 'uso' : 'usos'} en total` : 'Todavía sin estrenar'} />
                  {costoPorUso !== undefined ? (
                    <Fila
                      dt="Costo por uso"
                      dd={costoPorUso === null ? `S/ ${prenda.precio} y ningún uso todavía. Cada vez que te la pongas, baja.` : `S/ ${costoPorUso.toFixed(costoPorUso >= 10 ? 0 : 1)} por uso (${prenda.usosTotales} ${prenda.usosTotales === 1 ? 'uso' : 'usos'} desde S/ ${prenda.precio})`}
                    />
                  ) : null}
                </dl>

                <section className="border-t border-[var(--texto)] pt-4" aria-label="Tres formas de ponértela">
                  <div className="flex items-end justify-between gap-4">
                    <h2 className="serif m-0 text-[20px] leading-[1.2]">Tres formas de ponértela</h2>
                    {prenda.formasDeUso?.length ? (
                      <button type="button" className="inline-flex min-h-11 items-center text-[12px] text-[var(--texto-2)] hover:text-[var(--texto)]" disabled={ocupado !== null} onClick={() => void pedirFormas(true)}>
                        <span className="border-b border-current pb-[2px]">{ocupado === 'formas' ? 'Pensando' : 'Otras tres'}</span>
                      </button>
                    ) : null}
                  </div>
                  {prenda.formasDeUso?.length ? (
                    <ol className="m-0 mt-3 flex list-none flex-col gap-4 p-0">
                      {prenda.formasDeUso.map((f, i) => (
                        <li key={i} className="flex flex-col gap-1">
                          <span className="text-[15px] font-medium">{f.titulo}</span>
                          {f.prendaIds.length ? (
                            <span className="flex flex-wrap gap-x-3 text-[14px]">
                              {f.prendaIds.map((idOtra) =>
                                nombreDe(idOtra) ? (
                                  <Link key={idOtra} to={`/armario/${encodeURIComponent(idOtra)}`} className="border-b border-[var(--texto)]">
                                    {nombreDe(idOtra)}
                                  </Link>
                                ) : null,
                              )}
                            </span>
                          ) : null}
                          <span className="text-[13px] leading-[1.5] text-[var(--texto-2)]">
                            {f.motivo}
                            {f.faltaria ? ` Faltaría: ${f.faltaria}.` : ''}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="mt-3 flex flex-col gap-3">
                      <p className="m-0 text-[14px] leading-[1.5] text-[var(--texto-2)]">Estilismo arma tres looks con lo que ya tienes en el armario.</p>
                      <button type="button" className="boton-2 w-fit" disabled={ocupado !== null} onClick={() => void pedirFormas()}>
                        {ocupado === 'formas' ? 'Estilismo está pensando' : 'Pedir a Estilismo'}
                      </button>
                    </div>
                  )}
                </section>

                {preguntarAjuste ? (
                  <div className="flex flex-col gap-2 border-t border-[var(--linea)] pt-4" role="group" aria-label="Cómo te quedó">
                    <p className="m-0 text-[14px]">¿Cómo te quedó hoy? Sastra lo recuerda para la próxima compra.</p>
                    <div className="flex gap-2">
                      {(['ajustado', 'bien', 'holgado'] as NivelAjuste[]).map((n) => (
                        <button key={n} type="button" className="chip" onClick={() => void guardarAjuste(n)}>
                          {n === 'ajustado' ? 'Ajustada' : n === 'bien' ? 'Bien' : 'Holgada'}
                        </button>
                      ))}
                      <button type="button" className="inline-flex min-h-[34px] items-center text-[12px] text-[var(--texto-2)]" onClick={() => setPreguntarAjuste(false)}>
                        Omitir
                      </button>
                    </div>
                  </div>
                ) : ajusteGuardado ? (
                  <p className="m-0 text-[13px] text-[var(--texto-2)]">Anotado: te quedó {ajusteGuardado === 'bien' ? 'bien' : ajusteGuardado === 'ajustado' ? 'ajustada' : 'holgada'}.</p>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    className="boton flex-1"
                    disabled={ocupado !== null}
                    onClick={() => void registrarUsoYPreguntar()}
                  >
                    {ocupado === 'uso' ? 'Registrando' : 'Registrar uso'}
                  </button>
                  <button
                    type="button"
                    className="boton-2 flex-1"
                    disabled={ocupado !== null}
                    onClick={() => void accion('lavada', () => api.marcarLavada(prenda.id), 'Marcada como lavada. Vuelve a estar limpia.')}
                  >
                    {ocupado === 'lavada' ? 'Guardando' : 'Marcar lavada'}
                  </button>
                </div>

                {confirmarBaja ? (
                  <div className="flex flex-col gap-3 border-t border-[var(--linea)] pt-4">
                    <p className="m-0 text-[14px] text-[var(--texto-2)]">
                      Se eliminará la prenda y su historial de usos. No se puede deshacer.
                    </p>
                    <div className="flex gap-3">
                      <button type="button" className="boton flex-1" disabled={ocupado === 'eliminar'} onClick={() => void eliminar()}>
                        {ocupado === 'eliminar' ? 'Eliminando' : 'Sí, eliminar'}
                      </button>
                      <button type="button" className="boton-2 flex-1" onClick={() => setConfirmarBaja(false)}>
                        No, conservar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="inline-flex min-h-11 w-fit items-center text-[13px] text-[var(--texto-2)] hover:text-[var(--texto)]"
                    onClick={() => setConfirmarBaja(true)}
                  >
                    <span className="border-b border-current pb-[2px]">Eliminar</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Fila({ dt, dd }: { dt: string; dd?: string }) {
  if (!dd) return null;
  return (
    <div className="border-b border-[var(--linea)] py-[14px]">
      <dt>{dt}</dt>
      <dd className="whitespace-pre-line">{dd}</dd>
    </div>
  );
}
