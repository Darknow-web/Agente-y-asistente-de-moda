/**
 * Sastra: la conversación. Sin burbujas: Sastra habla en párrafos con su nombre en pequeño,
 * tú escribes alineado a la derecha en piedra. El id de la conversación vive en ?c=.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Adjunto, Conversacion, Mensaje, NombreAgente } from '@shared/types';
import { api, chatStream } from '@/lib/api';
import { prepararArchivo, urlDeAdjunto } from '@/lib/imagenes';
import { useSesion } from '@/lib/sesion';
import { relativo } from '@/lib/fechas';
import { fraseParticiparon, fraseTrabajando, parrafos } from '@/lib/chat';
import { Lockup } from '@/components/Marca';
import { Hilo, IconoCamara, IconoCerrar, IconoLista } from '@/components/Iconos';
import { Cargando } from '@/components/Cargando';
import { Aviso } from '@/components/Aviso';

type MensajeLocal = Mensaje & { enCurso?: boolean };
type ResumenConversacion = Pick<Conversacion, 'id' | 'titulo' | 'actualizadaEn'>;

const SUGERENCIAS = ['¿Qué me pongo hoy?', '¿Qué toca lavar esta semana?', 'Quiero comprar un abrigo'];

export function Sastra() {
  const { yo, recargarYo } = useSesion();
  const [params, setParams] = useSearchParams();
  const conversacionId = params.get('c');

  const [mensajes, setMensajes] = useState<MensajeLocal[]>([]);
  const [cargandoConv, setCargandoConv] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [trabajando, setTrabajando] = useState<NombreAgente[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [conversaciones, setConversaciones] = useState<ResumenConversacion[] | null>(null);

  const idActualRef = useRef<string | null>(conversacionId);
  const abortRef = useRef<AbortController | null>(null);
  const finalRef = useRef<HTMLDivElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);
  const entradaRef = useRef<HTMLInputElement>(null);

  // Texto prellenado desde otras pantallas (?texto=)
  useEffect(() => {
    const texto = params.get('texto');
    if (texto) {
      setBorrador(texto);
      const siguiente = new URLSearchParams(params);
      siguiente.delete('texto');
      setParams(siguiente, { replace: true });
      setTimeout(() => entradaRef.current?.focus(), 50);
    }
    // Solo al montar: el parámetro se consume una vez.
  }, []);

  // Sin ?c= en la URL, retomamos la última conversación (salvo que se pida una nueva con ?nueva=1).
  useEffect(() => {
    if (conversacionId || params.get('nueva')) return;
    let cancelado = false;
    api
      .conversaciones()
      .then((lista) => {
        if (cancelado || !lista.length) return;
        setParams({ c: lista[0]!.id }, { replace: true });
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, []);

  // Cargar la conversación cuando cambia ?c=
  useEffect(() => {
    if (conversacionId === idActualRef.current) return;
    idActualRef.current = conversacionId;
    abortRef.current?.abort();
    setTrabajando([]);
    setError(null);
    if (!conversacionId) {
      setMensajes([]);
      return;
    }
    let cancelado = false;
    setCargandoConv(true);
    api
      .conversacion(conversacionId)
      .then((c) => {
        if (!cancelado) setMensajes(c.mensajes ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : 'No se pudo abrir la conversación.');
          setMensajes([]);
        }
      })
      .finally(() => {
        if (!cancelado) setCargandoConv(false);
      });
    return () => {
      cancelado = true;
    };
  }, [conversacionId]);

  useEffect(() => {
    finalRef.current?.scrollIntoView({ block: 'end' });
  }, [mensajes, trabajando]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const abrirPanel = async () => {
    setPanelAbierto(true);
    try {
      setConversaciones(await api.conversaciones());
    } catch {
      setConversaciones([]);
    }
  };

  const irA = (id: string | null) => {
    setPanelAbierto(false);
    if (id) setParams({ c: id });
    else setParams({ nueva: '1' });
  };

  const alAdjuntar = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    setPreparando(true);
    setError(null);
    try {
      const nuevos: Adjunto[] = [];
      for (const archivo of Array.from(archivos).slice(0, 3)) nuevos.push(await prepararArchivo(archivo));
      setAdjuntos((a) => [...a, ...nuevos].slice(0, 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar el archivo.');
    } finally {
      setPreparando(false);
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  const enviar = useCallback(
    async (textoForzado?: string) => {
      const texto = (textoForzado ?? borrador).trim();
      if ((!texto && !adjuntos.length) || enviando) return;
      const ahora = new Date().toISOString();
      const idUsuario = `local-u-${Date.now()}`;
      const idSastra = `local-s-${Date.now()}`;
      const paraEnviar = adjuntos;

      setMensajes((m) => [
        ...m,
        { id: idUsuario, rol: 'usuario', texto, adjuntos: paraEnviar, creadoEn: ahora },
        { id: idSastra, rol: 'sastra', texto: '', creadoEn: ahora, enCurso: true },
      ]);
      setBorrador('');
      setAdjuntos([]);
      setError(null);
      setEnviando(true);
      setTrabajando([]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let huboFin = false;

      const actualizarSastra = (fn: (m: MensajeLocal) => MensajeLocal) =>
        setMensajes((lista) => lista.map((m) => (m.id === idSastra ? fn(m) : m)));

      try {
        await chatStream(
          { conversacionId: idActualRef.current ?? undefined, texto, adjuntos: paraEnviar.length ? paraEnviar : undefined },
          (ev) => {
            switch (ev.tipo) {
              case 'inicio':
                if (ev.conversacionId !== idActualRef.current) {
                  idActualRef.current = ev.conversacionId;
                  setParams({ c: ev.conversacionId }, { replace: true });
                }
                break;
              case 'departamento':
                setTrabajando((t) =>
                  ev.estado === 'trabajando'
                    ? t.includes(ev.agente)
                      ? t
                      : [...t, ev.agente]
                    : t.filter((a) => a !== ev.agente),
                );
                break;
              case 'texto':
                actualizarSastra((m) => ({ ...m, texto: m.texto + ev.delta }));
                break;
              case 'texto-reiniciar':
                actualizarSastra((m) => ({ ...m, texto: '' }));
                break;
              case 'pregunta':
                actualizarSastra((m) => ({ ...m, texto: `${m.texto.trimEnd()}\n\n${ev.texto}` }));
                break;
              case 'fin':
                huboFin = true;
                setMensajes((lista) => lista.map((m) => (m.id === idSastra ? { ...ev.mensaje, enCurso: false } : m)));
                break;
              case 'error':
                setError(ev.mensaje);
                break;
            }
          },
          ctrl.signal,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sastra no pudo responder.');
      } finally {
        setEnviando(false);
        setTrabajando([]);
        if (!huboFin) {
          setMensajes((lista) =>
            lista
              .map((m) => (m.id === idSastra ? { ...m, enCurso: false } : m))
              .filter((m) => !(m.id === idSastra && !m.texto)),
          );
        }
        void recargarYo();
      }
    },
    [borrador, adjuntos, enviando, setParams, recargarYo],
  );

  const sinMensajesHoy = yo ? yo.mensajesRestantesHoy <= 0 : false;
  const fraseTrab = fraseTrabajando(trabajando);
  const vacio = !cargandoConv && mensajes.length === 0;

  return (
    <div className="relative flex h-[calc(100dvh-76px)] flex-col -mb-[96px] lg:mb-0 lg:h-dvh">
      <header className="mx-[var(--margen)] flex h-14 shrink-0 items-center justify-between border-b border-[var(--linea)] pt-[14px] lg:mx-16 lg:h-20 lg:pt-4">
        <button
          type="button"
          onClick={() => void abrirPanel()}
          aria-label="Conversaciones anteriores"
          aria-expanded={panelAbierto}
          className="-ml-3 inline-flex h-11 w-11 items-center justify-center"
        >
          <IconoLista />
        </button>
        <Lockup altura={22} />
        <Link to="/probador" className="inline-flex min-h-11 items-center text-[13px] text-[var(--texto-2)] hover:text-[var(--texto)]">
          Probador
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[44rem] flex-col gap-[22px] px-[var(--margen)] pt-6 pb-6 text-[15px] leading-[1.55] lg:px-16 lg:pt-10">
          {cargandoConv ? <Cargando texto="Abriendo la conversación" compacto /> : null}

          {vacio ? (
            <div className="aparece flex flex-col gap-2">
              <span className="serif italic text-[15px] text-[var(--texto-2)]">Sastra</span>
              <p className="m-0">
                {yo?.perfil.nombre ? `Hola, ${yo.perfil.nombre}. ` : ''}
                Cuéntame qué tienes hoy o mándame una foto de una prenda. Estilismo, Cuidado y el resto del
                departamento están detrás.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGERENCIAS.map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => void enviar(s)} disabled={enviando || sinMensajesHoy}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {mensajes.map((m) =>
            m.rol === 'usuario' ? (
              <div key={m.id} className="flex max-w-[78%] flex-col items-end gap-2 self-end text-right text-[var(--texto-2)]">
                {m.adjuntos?.length ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {m.adjuntos.map((a, i) => (
                      <MiniAdjunto key={i} adjunto={a} />
                    ))}
                  </div>
                ) : null}
                {m.texto ? <p className="m-0 whitespace-pre-line">{m.texto}</p> : null}
              </div>
            ) : (
              <div key={m.id} className="flex flex-col gap-2">
                <span className="serif italic text-[15px] text-[var(--texto-2)]">Sastra</span>
                {parrafos(m.texto).map((p, i, arr) => (
                  <p key={i} className={`m-0 whitespace-pre-line ${m.enCurso && i === arr.length - 1 ? 'escribiendo' : ''}`}>
                    {p}
                  </p>
                ))}
                {m.enCurso && !m.texto && !fraseTrab ? <p className="m-0 escribiendo text-[var(--texto-2)]"></p> : null}
                {!m.enCurso && fraseParticiparon(m.departamentos) ? (
                  <div className="flex items-center gap-[10px] pt-1 text-[12px] text-[var(--texto-2)]">
                    <Hilo />
                    <span>{fraseParticiparon(m.departamentos)}</span>
                  </div>
                ) : null}
              </div>
            ),
          )}

          {fraseTrab ? (
            <div className="flex items-center gap-[10px] text-[12px] text-[var(--texto-2)]" role="status">
              <Hilo animado />
              <span>{fraseTrab}</span>
            </div>
          ) : null}

          {error ? (
            <Aviso tipo="error" onCerrar={() => setError(null)}>
              {error}
            </Aviso>
          ) : null}
          <div ref={finalRef} />
        </div>
      </div>

      <form
        className="shrink-0 border-t border-[var(--linea)] bg-[var(--fondo)]"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <div className="mx-auto max-w-[44rem] px-[var(--margen)] pt-3 pb-[22px] lg:px-16">
          {adjuntos.length ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {adjuntos.map((a, i) => (
                <div key={i} className="relative">
                  <MiniAdjunto adjunto={a} />
                  <button
                    type="button"
                    aria-label={`Quitar ${a.tipo === 'video' ? 'video' : 'foto'}`}
                    onClick={() => setAdjuntos((lista) => lista.filter((_, j) => j !== i))}
                    className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center border border-[var(--texto)] bg-[var(--fondo)]"
                  >
                    <IconoCerrar tamano={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {preparando ? (
            <div className="mb-3">
              <Cargando texto="Preparando el archivo" compacto />
            </div>
          ) : null}
          {sinMensajesHoy ? (
            <p className="m-0 mb-3 text-[13px] text-[var(--texto-2)]">
              Has usado tus mensajes de hoy. Mañana Sastra vuelve a estar disponible.
            </p>
          ) : null}
          <div className="flex items-center gap-[10px]">
            <input
              ref={archivoRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="visualmente-oculto"
              onChange={(e) => void alAdjuntar(e.target.files)}
            />
            <button
              type="button"
              aria-label="Adjuntar foto o video"
              onClick={() => archivoRef.current?.click()}
              disabled={preparando || adjuntos.length >= 3}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--texto)] disabled:opacity-40"
            >
              <IconoCamara />
            </button>
            <label htmlFor="mensaje" className="visualmente-oculto">
              Mensaje
            </label>
            <input
              id="mensaje"
              ref={entradaRef}
              type="text"
              className="campo h-11"
              placeholder="Escríbele a Sastra"
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              disabled={sinMensajesHoy}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={enviando || sinMensajesHoy || (!borrador.trim() && !adjuntos.length)}
              className="inline-flex h-11 shrink-0 items-center border border-[var(--texto)] bg-[var(--texto)] px-4 text-[14px] font-medium tracking-[0.04em] text-[var(--inverso)] disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        </div>
      </form>

      {panelAbierto ? (
        <div className="absolute inset-0 z-30 flex" role="dialog" aria-modal="true" aria-label="Conversaciones">
          <div className="flex h-full w-[82%] max-w-[360px] flex-col gap-4 border-r border-[var(--linea)] bg-[var(--fondo)] px-5 pt-5 pb-6">
            <div className="flex items-center justify-between">
              <span className="serif text-[22px]">Conversaciones</span>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setPanelAbierto(false)}
                className="-mr-2 inline-flex h-11 w-11 items-center justify-center"
              >
                <IconoCerrar />
              </button>
            </div>
            <button type="button" className="boton-2 w-full" onClick={() => irA(null)}>
              Nueva conversación
            </button>
            <div className="flex-1 overflow-y-auto">
              {conversaciones === null ? (
                <Cargando compacto texto="Buscando" />
              ) : conversaciones.length === 0 ? (
                <p className="m-0 pt-2 text-[14px] text-[var(--texto-2)]">Aún no hay conversaciones guardadas.</p>
              ) : (
                <ul className="m-0 list-none border-t border-[var(--linea)] p-0">
                  {conversaciones.map((c) => (
                    <li key={c.id} className="border-b border-[var(--linea)]">
                      <button
                        type="button"
                        onClick={() => irA(c.id)}
                        aria-current={c.id === conversacionId ? 'true' : undefined}
                        className={`flex min-h-11 w-full flex-col items-start gap-[2px] py-3 text-left ${
                          c.id === conversacionId ? 'text-[var(--texto)]' : 'text-[var(--texto-2)] hover:text-[var(--texto)]'
                        }`}
                      >
                        <span className="text-[14px] leading-[1.35]">{c.titulo || 'Conversación'}</span>
                        <span className="text-[12px] text-[var(--texto-2)]">{relativo(c.actualizadaEn)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar conversaciones"
            className="flex-1 bg-[var(--texto)]/20"
            onClick={() => setPanelAbierto(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function MiniAdjunto({ adjunto }: { adjunto: Adjunto }) {
  const url = urlDeAdjunto(adjunto);
  if (adjunto.tipo === 'imagen' && url) {
    return <img src={url} alt={adjunto.nombre ?? 'Foto adjunta'} className="h-[120px] w-[96px] object-cover" />;
  }
  return (
    <div className="flex h-[120px] w-[96px] items-end bg-[var(--hilo)] p-2 text-left text-[11px] leading-[1.3] text-[var(--piedra)]">
      {adjunto.tipo === 'video' ? 'Video' : 'Archivo'}
      {adjunto.nombre ? ` · ${adjunto.nombre}` : ''}
    </div>
  );
}
