/**
 * Probador: pantalla oscura. Tomas una foto o un video de lo que te estás probando
 * y Sastra da su veredicto en streaming sobre la imagen.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Adjunto, NombreAgente } from '@shared/types';
import { api, chatStream } from '@/lib/api';
import { prepararArchivo, urlDeAdjunto } from '@/lib/imagenes';
import { fraseTrabajando, parrafos } from '@/lib/chat';
import { Isotipo } from '@/components/Marca';
import { Hilo, IconoCamara, IconoVolver } from '@/components/Iconos';
import { Cargando } from '@/components/Cargando';
import { Aviso } from '@/components/Aviso';

type Fase = 'inicio' | 'preparando' | 'consultando' | 'veredicto';

const TEXTO_INICIAL = 'Estoy en el probador. ¿Qué opinas?';
const TEXTO_ETIQUETA = 'Aquí está la etiqueta.';

export function Probador() {
  const [fase, setFase] = useState<Fase>('inicio');
  const [medio, setMedio] = useState<Adjunto | null>(null);
  const [veredicto, setVeredicto] = useState('');
  const [enCurso, setEnCurso] = useState(false);
  const [trabajando, setTrabajando] = useState<NombreAgente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const conversacionRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const camaraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const etiquetaRef = useRef<HTMLInputElement>(null);

  // Tema oscuro mientras la pantalla está montada
  useEffect(() => {
    const raiz = document.documentElement;
    const anterior = raiz.getAttribute('data-tema');
    raiz.setAttribute('data-tema', 'oscuro');
    const meta = document.querySelector('meta[name="theme-color"]');
    const colorAnterior = meta?.getAttribute('content');
    meta?.setAttribute('content', '#000000');
    return () => {
      if (anterior) raiz.setAttribute('data-tema', anterior);
      else raiz.removeAttribute('data-tema');
      if (meta && colorAnterior) meta.setAttribute('content', colorAnterior);
      abortRef.current?.abort();
    };
  }, []);

  const consultar = async (adjunto: Adjunto, texto: string) => {
    setFase('consultando');
    setVeredicto('');
    setError(null);
    setAviso(null);
    setEnCurso(true);
    setTrabajando([]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let huboTexto = false;
    try {
      await chatStream(
        { conversacionId: conversacionRef.current, texto, adjuntos: [adjunto] },
        (ev) => {
          switch (ev.tipo) {
            case 'inicio':
              conversacionRef.current = ev.conversacionId;
              break;
            case 'departamento':
              setTrabajando((t) =>
                ev.estado === 'trabajando' ? (t.includes(ev.agente) ? t : [...t, ev.agente]) : t.filter((a) => a !== ev.agente),
              );
              break;
            case 'texto':
              huboTexto = true;
              setFase('veredicto');
              setVeredicto((v) => v + ev.delta);
              break;
            case 'pregunta':
              huboTexto = true;
              setFase('veredicto');
              setVeredicto((v) => `${v.trimEnd()}\n\n${ev.texto}`);
              break;
            case 'fin':
              huboTexto = huboTexto || Boolean(ev.mensaje.texto);
              setVeredicto(ev.mensaje.texto);
              setFase('veredicto');
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
      setEnCurso(false);
      setTrabajando([]);
      // Sin ninguna respuesta (error o corte), se vuelve al veredicto anterior o al inicio.
      setFase((f) => (f === 'consultando' ? (huboTexto ? 'veredicto' : texto === TEXTO_INICIAL ? 'inicio' : 'veredicto') : f));
    }
  };

  const alElegir = async (archivo: File | undefined, texto = TEXTO_INICIAL) => {
    if (!archivo) return;
    setError(null);
    setFase('preparando');
    try {
      const adjunto = await prepararArchivo(archivo);
      if (texto === TEXTO_INICIAL) {
        setMedio(adjunto);
        conversacionRef.current = undefined;
      }
      await consultar(adjunto, texto);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar el archivo.');
      setFase(medio ? 'veredicto' : 'inicio');
    } finally {
      for (const r of [camaraRef, videoRef, galeriaRef, etiquetaRef]) if (r.current) r.current.value = '';
    }
  };

  const guardarDeseo = async () => {
    const primera = parrafos(veredicto)[0] ?? '';
    const nombre = primera.split(/(?<=[.!?])\s/)[0]?.slice(0, 80).trim() || 'Prenda vista en el probador';
    setGuardando(true);
    setError(null);
    try {
      await api.crearDeseo({ nombre, prioridad: 'media', motivo: 'Visto en el probador con Sastra.' });
      setAviso('Guardado en tu lista de deseos.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el deseo.');
    } finally {
      setGuardando(false);
    }
  };

  const urlMedio = medio ? urlDeAdjunto(medio) : undefined;
  const partes = parrafos(veredicto);
  const titular = partes[0] ?? '';
  const resto = partes.slice(1);
  const fraseTrab = fraseTrabajando(trabajando);

  return (
    <div data-tema="oscuro" className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--fondo)] text-[var(--texto)]">
      {urlMedio ? (
        <>
          {medio?.tipo === 'video' ? (
            <video
              src={urlMedio}
              className="absolute inset-x-0 top-0 h-[62%] w-full object-cover"
              style={{ objectPosition: '50% 20%' }}
              muted
              playsInline
              autoPlay
              loop
            />
          ) : (
            <img
              src={urlMedio}
              alt="Foto tomada en el probador"
              className="absolute inset-x-0 top-0 h-[62%] w-full object-cover"
              style={{ objectPosition: '50% 20%' }}
            />
          )}
          <div
            className="absolute inset-x-0 top-[40%] h-[24%]"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0), #000)' }}
            aria-hidden="true"
          />
        </>
      ) : null}

      <div className="relative mx-auto flex w-full max-w-[48rem] flex-1 flex-col">
        <header className="flex h-14 items-center justify-between px-5 pt-[18px]">
          <Link to="/sastra" aria-label="Volver" className="inline-flex h-11 w-11 items-center">
            <IconoVolver />
          </Link>
          <span className="serif italic text-[17px]">Probador</span>
          <Isotipo tamano={28} titulo="SASTRA" fondo="var(--fondo)" />
        </header>

        <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="visualmente-oculto" onChange={(e) => void alElegir(e.target.files?.[0])} />
        <input ref={videoRef} type="file" accept="video/*" capture="environment" className="visualmente-oculto" onChange={(e) => void alElegir(e.target.files?.[0])} />
        <input ref={galeriaRef} type="file" accept="image/*,video/*" className="visualmente-oculto" onChange={(e) => void alElegir(e.target.files?.[0])} />
        <input ref={etiquetaRef} type="file" accept="image/*" capture="environment" className="visualmente-oculto" onChange={(e) => void alElegir(e.target.files?.[0], TEXTO_ETIQUETA)} />

        {fase === 'inicio' ? (
          <div className="aparece mt-auto flex flex-col gap-6 px-5 pb-10 pt-16">
            <h1 className="h2 m-0 max-w-[20ch]">Enséñale a Sastra lo que te estás probando.</h1>
            <p className="m-0 max-w-[36ch] text-[15px] leading-[1.55] text-[var(--texto-2)]">
              Una foto de cuerpo entero frente al espejo o un video corto. Te dice si te queda, con qué
              combina de tu armario y si llena un vacío real.
            </p>
            {error ? (
              <Aviso tipo="error" onCerrar={() => setError(null)}>
                {error}
              </Aviso>
            ) : null}
            <div className="flex flex-col gap-3">
              <button type="button" className="boton" onClick={() => camaraRef.current?.click()}>
                <IconoCamara tamano={18} />
                Tomar foto
              </button>
              <div className="flex gap-3">
                <button type="button" className="boton-2 flex-1" onClick={() => videoRef.current?.click()}>
                  Grabar video
                </button>
                <button type="button" className="boton-2 flex-1" onClick={() => galeriaRef.current?.click()}>
                  Elegir de la galería
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {fase === 'preparando' || fase === 'consultando' ? (
          <div className="mt-auto flex flex-col gap-4 px-5 pb-10">
            {fraseTrab ? (
              <div className="flex items-center gap-[10px] text-[12px] text-[var(--texto-2)]" role="status">
                <Hilo animado />
                <span>{fraseTrab}</span>
              </div>
            ) : null}
            <Cargando texto={fase === 'preparando' ? 'Preparando la imagen' : 'Sastra está mirando'} compacto />
            {error ? (
              <Aviso tipo="error" onCerrar={() => setError(null)}>
                {error}
              </Aviso>
            ) : null}
          </div>
        ) : null}

        {fase === 'veredicto' ? (
          <div className="mt-auto flex flex-col gap-[14px] px-5 pb-[22px] pt-10">
            <span className="text-[12px] text-[var(--texto-2)]">
              {medio?.tipo === 'video' ? 'Video del probador' : 'Foto del probador'}
              {medio?.nombre ? ` · ${medio.nombre}` : ''}
            </span>
            <h2 className={`h2 m-0 text-[30px] leading-[1.08] ${enCurso && !resto.length ? 'escribiendo' : ''}`}>{titular}</h2>
            {resto.map((p, i) => (
              <p
                key={i}
                className={`m-0 whitespace-pre-line ${
                  i === resto.length - 1 && resto.length > 1
                    ? 'text-[14px] leading-[1.5] text-[var(--texto-2)]'
                    : 'text-[15px] leading-[1.55] text-[var(--texto)]'
                } ${enCurso && i === resto.length - 1 ? 'escribiendo' : ''}`}
              >
                {p}
              </p>
            ))}
            {fraseTrab ? (
              <div className="flex items-center gap-[10px] text-[12px] text-[var(--texto-2)]" role="status">
                <Hilo animado color="var(--texto-2)" />
                <span>{fraseTrab}</span>
              </div>
            ) : null}
            {error ? (
              <Aviso tipo="error" onCerrar={() => setError(null)}>
                {error}
              </Aviso>
            ) : null}
            {aviso ? (
              <Aviso tipo="ok" onCerrar={() => setAviso(null)}>
                {aviso}
              </Aviso>
            ) : null}
            <div className="mt-1 flex gap-3">
              <button type="button" className="boton flex-1 text-[14px]" disabled={enCurso} onClick={() => etiquetaRef.current?.click()}>
                Enviar etiqueta
              </button>
              <button type="button" className="boton-2 flex-1 text-[14px]" disabled={enCurso || guardando || !veredicto} onClick={() => void guardarDeseo()}>
                {guardando ? 'Guardando' : 'Guardar en deseos'}
              </button>
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 w-fit items-center text-[13px] text-[var(--texto-2)] hover:text-[var(--texto)]"
              disabled={enCurso}
              onClick={() => galeriaRef.current?.click()}
            >
              <span className="border-b border-current pb-[2px]">Probar otra prenda</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
