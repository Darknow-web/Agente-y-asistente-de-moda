/** Hoy: el look del día con la primera prenda en grande. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Prenda } from '@shared/types';
import { api } from '@/lib/api';
import { useCarga } from '@/lib/useCarga';
import { useSesion } from '@/lib/sesion';
import { fechaLarga } from '@/lib/fechas';
import { Isotipo } from '@/components/Marca';
import { IconoCampana } from '@/components/Iconos';
import { Cargando } from '@/components/Cargando';
import { EstadoVacio } from '@/components/EstadoVacio';
import { Aviso } from '@/components/Aviso';
import { FotoPrenda, metaPrenda } from '@/components/TarjetaPrenda';
import { Columna } from '@/components/Disposicion';
import { PreguntaDelDia } from '@/components/PreguntaDelDia';

export function Hoy() {
  const navegar = useNavigate();
  const { yo } = useSesion();
  const { datos, error, cargando, recargar } = useCarga(() => api.hoy());
  const { datos: resumen } = useCarga(() => api.resumenArmario());
  const [registrando, setRegistrando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const dia = datos?.dia ?? null;
  const prendasLook: Prenda[] = dia
    ? dia.look.prendaIds
        .map((id) => datos?.prendas.find((p) => p.id === id))
        .filter((p): p is Prenda => Boolean(p))
    : [];
  const principal = prendasLook.find((p) => p.fotoUrl) ?? prendasLook[0];
  const ciudad = yo?.perfil.ciudad;

  const subtitulo = (() => {
    if (!dia) return null;
    const partes: string[] = [];
    if (dia.look.ocasion) partes.push(dia.look.ocasion);
    const clima = datos?.clima
      ? `${Math.round(datos.clima.temperaturaC)}° y ${datos.clima.descripcion.toLowerCase()}${ciudad ? ` en ${ciudad}` : ''}`
      : dia.look.clima;
    if (clima) partes.push(clima);
    return partes.length ? partes.map((p) => p.replace(/\.?$/, '.')).join(' ') : null;
  })();

  const meLoPongo = async () => {
    if (!prendasLook.length) return;
    setRegistrando(true);
    setAviso(null);
    try {
      await Promise.all(prendasLook.map((p) => api.registrarUso(p.id, dia?.look.ocasion)));
      setAviso({
        tipo: 'ok',
        texto: `Listo. Registré el uso de ${prendasLook.length} ${prendasLook.length === 1 ? 'prenda' : 'prendas'}. Cuidado avisará cuando toque lavar.`,
      });
      void recargar(true);
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo registrar el uso.' });
    } finally {
      setRegistrando(false);
    }
  };

  const otraOpcion = () => {
    navegar(`/sastra?texto=${encodeURIComponent('Dame otra opción para hoy')}`);
  };

  return (
    <div className="aparece">
      <Columna>
        <header className="flex h-14 items-center justify-between pt-[18px] lg:h-auto lg:pt-10">
          <Isotipo tamano={30} titulo="SASTRA" />
          <span className="pequeno">{fechaLarga()}</span>
          <Link
            to="/avisos"
            aria-label="Avisos"
            className="inline-flex h-11 w-11 items-center justify-end"
          >
            <IconoCampana />
          </Link>
        </header>

        <div className="pt-[18px] lg:pt-12">
          <h1 className="h1 m-0 text-[34px] leading-[1.05] lg:text-[var(--t-h1)]">Tu look de hoy</h1>
          {subtitulo ? (
            <p className="m-0 mt-2 text-[14px] leading-[1.45] text-[var(--texto-2)]">{subtitulo}</p>
          ) : null}
        </div>
      </Columna>

      {cargando ? (
        <Columna className="pt-6">
          <Cargando texto="Estilismo revisa tu armario y el clima" />
        </Columna>
      ) : error ? (
        <Columna className="pt-6">
          <Aviso tipo="error">{error}</Aviso>
        </Columna>
      ) : !dia ? (
        <Columna className="pt-8">
          {datos && datos.prendas.length === 0 ? (
            <EstadoVacio
              titulo="Aún no hay prendas en tu armario."
              texto="Sube la primera foto y Sastra la cataloga. Con unas cuantas prendas ya puede vestirte."
              accion={
                <Link to="/armario/nueva" className="boton">
                  Añadir prenda
                </Link>
              }
            />
          ) : (
            <EstadoVacio
              titulo="Aún no hay un look para hoy."
              texto="Planificación prepara tu semana los domingos. Si quieres uno ahora, pídeselo a Sastra."
              accion={
                <>
                  <Link
                    to={`/sastra?texto=${encodeURIComponent('¿Qué me pongo hoy?')}`}
                    className="boton"
                  >
                    Pedir un look a Sastra
                  </Link>
                  <Link to="/semana" className="boton-2">
                    Planificar mi semana
                  </Link>
                </>
              }
            />
          )}
        </Columna>
      ) : (
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-6 lg:px-16">
          <Link
            to="/sastra"
            className="mx-[var(--margen)] mt-[18px] block h-[420px] overflow-hidden lg:col-span-6 lg:mx-0 lg:mt-10 lg:h-auto lg:aspect-[4/5]"
            aria-label="Hablar con Sastra sobre este look"
          >
            {principal ? (
              <FotoPrenda prenda={principal} className="h-full" sizes="(min-width: 1024px) 40vw, 100vw" />
            ) : (
              <div className="h-full w-full bg-[var(--hilo)]" aria-hidden="true" />
            )}
          </Link>

          <div className="flex flex-col gap-[6px] px-[var(--margen)] pt-4 lg:col-span-5 lg:col-start-8 lg:px-0 lg:pt-10">
            <p className="serif m-0 text-[20px] leading-[1.2] lg:text-[28px]">{dia.look.titulo}</p>
            <p className="m-0 text-[14px] leading-[1.45] text-[var(--texto-2)] lg:text-[15px]">{dia.look.motivo}</p>
            {dia.notas ? <p className="m-0 text-[14px] leading-[1.45] text-[var(--texto-2)]">{dia.notas}</p> : null}

            {prendasLook.length ? (
              <ul className="m-0 mt-4 list-none border-t border-[var(--linea)] p-0">
                {prendasLook.map((p) => (
                  <li key={p.id} className="border-b border-[var(--linea)]">
                    <Link
                      to={`/armario/${encodeURIComponent(p.id)}`}
                      className="flex min-h-11 items-center justify-between gap-4 py-[10px] text-[14px]"
                    >
                      <span>{p.nombre}</span>
                      <span
                        className={`shrink-0 text-[12px] ${p.estado === 'para-lavar' ? 'text-[var(--anil)]' : 'text-[var(--texto-2)]'}`}
                      >
                        {metaPrenda(p)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {prendasLook.length > 1 ? (
              <div className="mt-3 flex gap-2" aria-label="Las prendas del look">
                {prendasLook.map((p) => (
                  <Link key={p.id} to={`/armario/${encodeURIComponent(p.id)}`} className="w-14 shrink-0" aria-label={p.nombre}>
                    <FotoPrenda prenda={p} className="aspect-[4/5]" sizes="56px" />
                  </Link>
                ))}
              </div>
            ) : null}

            {dia.alternativa ? (
              <p className="m-0 mt-3 text-[13px] leading-[1.45] text-[var(--texto-2)]">
                Alternativa: {dia.alternativa.titulo}.
              </p>
            ) : null}

            <div className="mt-[18px] flex gap-3">
              <button
                type="button"
                className="boton flex-1"
                onClick={() => void meLoPongo()}
                disabled={registrando || !prendasLook.length}
              >
                {registrando ? 'Registrando' : 'Me lo pongo'}
              </button>
              <button type="button" className="boton-2 flex-1" onClick={otraOpcion}>
                Otra opción
              </button>
            </div>
            {aviso ? (
              <div className="mt-4">
                <Aviso tipo={aviso.tipo} onCerrar={() => setAviso(null)}>
                  {aviso.texto}
                </Aviso>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {!cargando ? (
        <Columna className="pb-10 pt-10">
          <div className="flex max-w-[40rem] flex-col gap-8">
            {resumen?.sinEstrenar.length ? (
              <section className="border-t border-[var(--texto)] pt-4" aria-label="Estreno pendiente">
                <p className="m-0 text-[12px] text-[var(--texto-2)]">Estreno pendiente</p>
                <p className="serif m-0 mt-1 text-[19px] leading-[1.25]">
                  {resumen.sinEstrenar.length === 1 ? 'Una prenda nueva espera su primer día.' : `${resumen.sinEstrenar.length} prendas nuevas esperan su primer día.`}
                </p>
                <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[14px]">
                  {resumen.sinEstrenar.slice(0, 4).map((p) => (
                    <li key={p.id}>
                      <Link to={`/armario/${encodeURIComponent(p.id)}`} className="border-b border-[var(--texto)]">
                        {p.nombre}
                      </Link>
                      <span className="text-[var(--texto-2)]"> · {p.dias} {p.dias === 1 ? 'día' : 'días'}</span>
                    </li>
                  ))}
                </ul>
                <p className="m-0 mt-2 text-[13px] text-[var(--texto-2)]">Abre la prenda y Estilismo te da tres formas de ponértela.</p>
              </section>
            ) : null}

            {resumen?.dormidas.length ? (
              <section className="border-t border-[var(--texto)] pt-4" aria-label="Ropa dormida">
                <p className="m-0 text-[12px] text-[var(--texto-2)]">Ropa dormida</p>
                <p className="serif m-0 mt-1 text-[19px] leading-[1.25]">
                  {resumen.dormidas.length === 1 ? 'Una prenda lleva más de dos meses sin salir.' : `${resumen.dormidas.length} prendas llevan más de dos meses sin salir.`}
                </p>
                <p className="m-0 mt-2 text-[14px] leading-[1.5] text-[var(--texto-2)]">
                  {resumen.valorSinUso ? `Suman ${resumen.moneda === 'PEN' ? 'S/' : resumen.moneda} ${resumen.valorSinUso} que no se están usando. ` : ''}
                  <Link to="/armario?filtro=dormidas" className="border-b border-[var(--texto)] text-[var(--texto)]">
                    Verlas en el armario
                  </Link>
                </p>
              </section>
            ) : null}

            <PreguntaDelDia />
          </div>
        </Columna>
      ) : null}
    </div>
  );
}
