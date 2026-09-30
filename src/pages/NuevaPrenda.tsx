/** Añadir prenda: foto → Guardarropa cataloga → revisas la propuesta → se guarda. */
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Adjunto } from '@shared/types';
import { api } from '@/lib/api';
import { comprimirImagen, urlDeAdjunto } from '@/lib/imagenes';
import { Cabecera } from '@/components/Cabecera';
import { Columna } from '@/components/Disposicion';
import { Cargando } from '@/components/Cargando';
import { Aviso } from '@/components/Aviso';
import { IconoCamara } from '@/components/Iconos';
import { aCampos, desdeCampos, FormularioPrenda, type CamposPrenda } from '@/components/FormularioPrenda';

type Fase = 'foto' | 'catalogando' | 'revisar' | 'guardando';

export function NuevaPrenda() {
  const navegar = useNavigate();
  const [fase, setFase] = useState<Fase>('foto');
  const [foto, setFoto] = useState<Adjunto | null>(null);
  const [pista, setPista] = useState('');
  const [campos, setCampos] = useState<CamposPrenda | null>(null);
  const [preguntas, setPreguntas] = useState<string[]>([]);
  const [respuestas, setRespuestas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const camaraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);

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
      await api.crearPrenda({
        prenda: { ...base, notas, estado: 'limpia', usosDesdeLavado: 0, favorita: false },
        foto: foto ?? undefined,
      });
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
              ? 'Una foto sobre fondo claro, con la prenda extendida o colgada. Guardarropa hace el resto.'
              : fase === 'catalogando'
                ? 'Guardarropa está mirando la foto.'
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
          className="visualmente-oculto"
          onChange={(e) => void alElegir(e.target.files?.[0])}
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
                Elegir de la galería
              </button>
            </div>
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
