/** Una pregunta al día, de un toque, para que Sastra conozca mejor a la persona sin formularios. */
import { useState } from 'react';
import type { PreguntaPerfil } from '@shared/types';
import { api } from '@/lib/api';
import { useCarga } from '@/lib/useCarga';
import { useSesion } from '@/lib/sesion';

export function PreguntaDelDia() {
  const { recargarYo } = useSesion();
  const { datos, setDatos } = useCarga(() => api.preguntaDelDia());
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [gracias, setGracias] = useState(false);
  const pregunta: PreguntaPerfil | null | undefined = datos?.pregunta;

  if (!pregunta || gracias) {
    if (gracias) {
      return (
        <section className="border-t border-[var(--texto)] pt-4">
          <p className="m-0 text-[14px] text-[var(--texto-2)]">Gracias. Sastra ya lo tiene en cuenta.</p>
        </section>
      );
    }
    return null;
  }

  const responder = async (respuesta?: string, saltar = false) => {
    setEnviando(true);
    try {
      await api.responderPregunta({ id: pregunta.id, respuesta, saltar });
      setGracias(!saltar);
      setDatos(null);
      void recargarYo();
      if (saltar) {
        // Siguiente pregunta pendiente, sin recargar la página
        const siguiente = await api.preguntaDelDia();
        setDatos(siguiente);
        setTexto('');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="border-t border-[var(--texto)] pt-4" aria-label="Pregunta del día">
      <p className="m-0 text-[12px] text-[var(--texto-2)]">Una pregunta para conocerte mejor{datos?.pendientes ? ` · quedan ${datos.pendientes}` : ''}</p>
      <p className="serif m-0 mt-1 text-[19px] leading-[1.25]">{pregunta.texto}</p>
      {pregunta.opciones.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {pregunta.opciones.map((o) => (
            <button key={o} type="button" className="chip" disabled={enviando} onClick={() => void responder(o)}>
              {o}
            </button>
          ))}
        </div>
      ) : null}
      {pregunta.permiteTexto ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (texto.trim()) void responder(texto.trim());
          }}
        >
          <input className="campo" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escríbelo aquí" aria-label="Tu respuesta" />
          <button type="submit" className="boton-2 shrink-0" disabled={enviando || !texto.trim()}>
            Listo
          </button>
        </form>
      ) : null}
      <button
        type="button"
        className="mt-2 inline-flex min-h-11 items-center text-[12px] text-[var(--texto-2)] hover:text-[var(--texto)]"
        disabled={enviando}
        onClick={() => void responder(undefined, true)}
      >
        <span className="border-b border-current pb-[2px]">Ahora no</span>
      </button>
    </section>
  );
}
