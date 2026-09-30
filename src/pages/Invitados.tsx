/** Invitados (solo administración): quién puede entrar a SASTRA. */
import { useState } from 'react';
import type { Invitado } from '@shared/api';
import { api } from '@/lib/api';
import { useCarga } from '@/lib/useCarga';
import { useSesion } from '@/lib/sesion';
import { fechaMedia } from '@/lib/fechas';
import { Cabecera } from '@/components/Cabecera';
import { Columna } from '@/components/Disposicion';
import { Cargando } from '@/components/Cargando';
import { Aviso } from '@/components/Aviso';

export function Invitados() {
  const { yo } = useSesion();
  const { datos, error, cargando, setDatos } = useCarga(() => api.invitados());
  const [email, setEmail] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const agregar = async (e: React.FormEvent) => {
    e.preventDefault();
    const correo = email.trim().toLowerCase();
    if (!correo) return;
    setOcupado('agregar');
    setAviso(null);
    try {
      setDatos(await api.invitar(correo));
      setEmail('');
      setAviso({ tipo: 'ok', texto: `${correo} ya puede entrar con su cuenta de Google.` });
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo agregar.' });
    } finally {
      setOcupado(null);
    }
  };

  const quitar = async (inv: Invitado) => {
    setOcupado(inv.email);
    setAviso(null);
    try {
      setDatos(await api.desinvitar(inv.email));
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo quitar.' });
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="aparece">
      <Columna>
        <Cabecera titulo="Invitados" meta={datos ? `${datos.length} ${datos.length === 1 ? 'persona' : 'personas'}` : undefined}>
          <p className="m-0 mt-[10px] max-w-[40rem] text-[14px] leading-[1.5] text-[var(--texto-2)]">
            Solo los correos de esta lista pueden usar SASTRA. Quien entre con otro correo verá un aviso para pedir acceso.
          </p>
        </Cabecera>

        <form onSubmit={(e) => void agregar(e)} className="mt-8 flex max-w-[34rem] flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="correo" className="campo-etiqueta">
              Correo de Google
            </label>
            <input
              id="correo"
              className="campo"
              type="email"
              autoComplete="off"
              placeholder="nombre@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="boton" disabled={ocupado === 'agregar' || !email.trim()}>
            {ocupado === 'agregar' ? 'Agregando' : 'Agregar'}
          </button>
        </form>

        {aviso ? (
          <div className="mt-5 max-w-[34rem]">
            <Aviso tipo={aviso.tipo} onCerrar={() => setAviso(null)}>
              {aviso.texto}
            </Aviso>
          </div>
        ) : null}

        {cargando ? (
          <div className="pt-8">
            <Cargando texto="Cargando la lista" />
          </div>
        ) : error ? (
          <div className="pt-8">
            <Aviso tipo="error">{error}</Aviso>
          </div>
        ) : (
          <ul className="m-0 mt-8 max-w-[40rem] list-none border-t border-[var(--texto)] p-0 pb-16">
            {datos?.length ? (
              datos.map((inv) => (
                <li key={inv.email} className="flex items-center justify-between gap-4 border-b border-[var(--linea)] py-3">
                  <div className="flex flex-col gap-[2px]">
                    <span className="text-[15px]">{inv.email}</span>
                    <span className="text-[12px] text-[var(--texto-2)]">
                      {[inv.agregadoEn ? `desde el ${fechaMedia(inv.agregadoEn)}` : '', inv.agregadoPor ? `por ${inv.agregadoPor}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  {inv.email.toLowerCase() !== yo?.email?.toLowerCase() ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 shrink-0 items-center text-[12px] text-[var(--texto-2)] hover:text-[var(--texto)]"
                      disabled={ocupado === inv.email}
                      onClick={() => void quitar(inv)}
                    >
                      <span className="border-b border-current">{ocupado === inv.email ? 'Quitando' : 'Quitar'}</span>
                    </button>
                  ) : (
                    <span className="text-[12px] text-[var(--texto-2)]">Tú</span>
                  )}
                </li>
              ))
            ) : (
              <li className="py-4 text-[14px] text-[var(--texto-2)]">Aún no hay invitados. Agrega el primer correo arriba.</li>
            )}
          </ul>
        )}
      </Columna>
    </div>
  );
}
