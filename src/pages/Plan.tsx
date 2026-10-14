/**
 * Plan: Gratis y Premium lado a lado, lo que lleva usado, y la suscripción con Mercado Pago.
 * Al volver de Mercado Pago (?preapproval_id=…) confirma el estado sin esperar al webhook.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { RespSuscripcion } from '@shared/api';
import type { LimitesPlan, PeriodoPago } from '@shared/types';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { fechaMedia } from '@/lib/fechas';
import { Cabecera } from '@/components/Cabecera';
import { Columna } from '@/components/Disposicion';
import { Cargando } from '@/components/Cargando';
import { Aviso } from '@/components/Aviso';

const soles = (monto: number) => `S/ ${monto.toFixed(2)}`;
const tope = (n: number | null, unidad: string) => (n === null ? 'Sin límite' : n === 0 ? 'No incluido' : `${n} ${unidad}`);

/** Filas de la comparación, en el orden en que importan a la persona. */
function filas(l: LimitesPlan): [string, string][] {
  return [
    ['Conversar con Sastra', tope(l.mensajesPorDia, 'mensajes al día')],
    ['Prendas en tu armario', tope(l.prendasMax, 'prendas')],
    ['Look del día, recorte de fondo y avisos', 'Incluido'],
    ['Plan de la semana', l.planSemanalAutomatico ? 'Automático cada domingo y rehacer cuando quieras' : 'Lo pides una vez por semana'],
    ['Fotos de catálogo con IA', l.fotoCatalogoAutomatica ? `Automáticas (${l.mejorarFotoPorDia} al día)` : tope(l.mejorarFotoPorDia, 'al día')],
    ['Probador antes de comprar', tope(l.probadorPorMes, 'al mes')],
    ['Compras con precios reales', tope(l.comprasPorMes, 'consultas al mes')],
  ];
}

export function Plan() {
  const { yo, recargarYo } = useSesion();
  const [params, setParams] = useSearchParams();
  const idVuelta = params.get('preapproval_id') ?? undefined;

  const [datos, setDatos] = useState<RespSuscripcion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(!!idVuelta);
  const [periodo, setPeriodo] = useState<PeriodoPago>('mensual');
  const [email, setEmail] = useState(yo?.email ?? '');
  const [ocupado, setOcupado] = useState<'pagar' | 'cancelar' | null>(null);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Carga inicial; al volver de Mercado Pago, consulta unas veces hasta ver el pago autorizado.
  useEffect(() => {
    let vivo = true;
    let intentos = 0;
    const cargar = async () => {
      try {
        const r = await api.suscripcion(idVuelta);
        if (!vivo) return;
        setDatos(r);
        const listo = r.plan === 'premium' || !idVuelta;
        if (listo || intentos >= 10) {
          setConfirmando(false);
          if (idVuelta) {
            setParams({}, { replace: true });
            if (r.plan === 'premium') {
              setAviso('Listo: ya tienes Premium. Gracias por confiar en SASTRA.');
              void recargarYo();
            } else {
              setAviso('Mercado Pago aún no confirma el pago. Si lo completaste, se activará en unos minutos.');
            }
          }
          return;
        }
        intentos++;
        setTimeout(() => void cargar(), 3000);
      } catch (e) {
        if (vivo) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar tu plan.');
          setConfirmando(false);
        }
      }
    };
    void cargar();
    return () => {
      vivo = false;
    };
    // Solo al entrar o al volver de Mercado Pago.
  }, [idVuelta]);

  useEffect(() => {
    if (!email && yo?.email) setEmail(yo.email);
  }, [yo?.email, email]);

  const pagar = async () => {
    setOcupado('pagar');
    setError(null);
    try {
      const { url } = await api.checkout({ periodo, emailMercadoPago: email.trim() });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir Mercado Pago.');
      setOcupado(null);
    }
  };

  const cancelar = async () => {
    setOcupado('cancelar');
    setError(null);
    try {
      const r = await api.cancelarSuscripcion();
      setDatos(r);
      setConfirmarCancelar(false);
      setAviso(
        r.suscripcion?.vigenteHasta
          ? `Suscripción cancelada. Sigues con Premium hasta el ${fechaMedia(r.suscripcion.vigenteHasta)} y no habrá más cobros.`
          : 'Suscripción cancelada. No habrá más cobros.',
      );
      void recargarYo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cancelar.');
    } finally {
      setOcupado(null);
    }
  };

  if (!datos) {
    return (
      <div className="aparece">
        <Columna>
          <Cabecera titulo="Tu plan" />
          <div className="pt-8">
            {error ? <Aviso tipo="error">{error}</Aviso> : <Cargando texto={confirmando ? 'Confirmando tu pago con Mercado Pago' : 'Buscando tu plan'} />}
          </div>
        </Columna>
      </div>
    );
  }

  const { plan, origen, suscripcion: s, precios, usos, planes } = datos;
  const esPremium = plan === 'premium';
  const ahorroAnual = Math.round((1 - precios.anual / (precios.mensual * 12)) * 100);
  const conPrueba = !s?.pruebaUsada && precios.pruebaDias > 0;
  const puedeCancelar = !!s && origen === 'suscripcion' && (s.estado === 'prueba' || s.estado === 'activa' || s.estado === 'pausada');

  const estadoTexto = (() => {
    if (origen === 'admin') return 'Premium por administrar SASTRA.';
    if (origen === 'cortesia') return 'Premium de cortesía. No se te cobra nada.';
    if (!s || !esPremium) return 'Gratis para siempre, con límites diarios y mensuales. Premium los quita.';
    const hasta = s.vigenteHasta ? fechaMedia(s.vigenteHasta) : '';
    if (s.estado === 'prueba') return `Prueba gratis de Premium${hasta ? ` hasta el ${hasta}; ese día se hace el primer cobro` : ''}.`;
    if (s.estado === 'activa') return `Premium ${s.periodo === 'anual' ? 'anual' : 'mensual'}${hasta ? `. Próximo cobro el ${hasta}` : ''}.`;
    if (s.estado === 'cancelada') return `Cancelada. Sigues con Premium${hasta ? ` hasta el ${hasta}` : ''}, sin más cobros.`;
    if (s.estado === 'pausada') return `Cobro pausado en Mercado Pago. Premium${hasta ? ` hasta el ${hasta}` : ''}.`;
    return 'Gratis para siempre, con límites diarios y mensuales. Premium los quita.';
  })();

  return (
    <div className="aparece">
      <Columna>
        <Cabecera titulo="Tu plan" meta={esPremium ? 'Premium' : 'Gratis'}>
          <p className="m-0 mt-[10px] max-w-[40rem] text-[14px] leading-[1.5] text-[var(--texto-2)]">{estadoTexto}</p>
        </Cabecera>

        {aviso ? (
          <div className="mt-6 max-w-[40rem]">
            <Aviso tipo="ok" onCerrar={() => setAviso(null)}>
              {aviso}
            </Aviso>
          </div>
        ) : null}
        {error ? (
          <div className="mt-6 max-w-[40rem]">
            <Aviso tipo="error" onCerrar={() => setError(null)}>
              {error}
            </Aviso>
          </div>
        ) : null}

        {!esPremium ? (
          <section className="mt-8 max-w-[40rem]" aria-label="Lo que llevas usado">
            <h2 className="h3 m-0">Lo que llevas usado</h2>
            <dl className="m-0 mt-3 grid grid-cols-2 gap-x-6 border-t border-[var(--texto)] text-[14px]">
              <Uso dt="Mensajes hoy" usados={usos.mensajesHoy} limite={planes.gratis.mensajesPorDia} />
              <Uso dt="Prendas" usados={usos.prendas} limite={planes.gratis.prendasMax} />
              <Uso dt="Probador este mes" usados={usos.probadorMes} limite={planes.gratis.probadorPorMes} />
              <Uso dt="Compras este mes" usados={usos.comprasMes} limite={planes.gratis.comprasPorMes} />
            </dl>
          </section>
        ) : null}

        <section className="mt-10" aria-label="Comparación de planes">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-[var(--texto)] pb-2 text-[13px] font-semibold">
            <span />
            <span>Gratis</span>
            <span>Premium</span>
          </div>
          {filas(planes.gratis).map(([que, gratis], i) => (
            <div key={que} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-b border-[var(--linea)] py-3 text-[13px] leading-[1.4]">
              <span className="text-[var(--texto-2)]">{que}</span>
              <span>{gratis}</span>
              <span>{filas(planes.premium)[i]?.[1]}</span>
            </div>
          ))}
        </section>

        {origen === 'gratis' || (origen === 'suscripcion' && s?.estado === 'cancelada' && !esPremium) ? (
          <section className="mt-10 max-w-[34rem]" aria-label="Pasar a Premium">
            <h2 className="h2 m-0">Premium</h2>
            <div className="mt-4 flex gap-3" role="radiogroup" aria-label="Forma de pago">
              {(['mensual', 'anual'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={periodo === p}
                  onClick={() => setPeriodo(p)}
                  className={`flex flex-1 flex-col items-start gap-1 border px-4 py-3 text-left ${periodo === p ? 'border-[var(--texto)] border-2' : 'border-[var(--linea)]'}`}
                >
                  <span className="serif text-[22px] leading-none">{soles(p === 'mensual' ? precios.mensual : precios.anual)}</span>
                  <span className="text-[12px] text-[var(--texto-2)]">{p === 'mensual' ? 'al mes' : `al año · ahorras ${ahorroAnual} %`}</span>
                </button>
              ))}
            </div>

            <label htmlFor="email-mp" className="campo-etiqueta mt-5 block">
              Correo de tu cuenta de Mercado Pago
            </label>
            <input id="email-mp" className="campo" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="m-0 mt-2 text-[12px] leading-[1.45] text-[var(--texto-2)]">
              Mercado Pago pide que sea el mismo correo con el que pagas. Puedes pagar con tarjeta o Yape.
            </p>

            <button
              type="button"
              className="boton mt-5 w-full"
              disabled={!datos.pagosConfigurados || ocupado !== null || !email.includes('@')}
              onClick={() => void pagar()}
            >
              {ocupado === 'pagar'
                ? 'Abriendo Mercado Pago'
                : conPrueba
                  ? `Probar ${precios.pruebaDias} días gratis`
                  : `Suscribirme por ${soles(periodo === 'mensual' ? precios.mensual : precios.anual)}`}
            </button>
            <p className="m-0 mt-3 text-[12px] leading-[1.45] text-[var(--texto-2)]">
              {!datos.pagosConfigurados
                ? 'Los pagos se activan muy pronto.'
                : conPrueba
                  ? `No se cobra nada durante ${precios.pruebaDias} días. Si cancelas antes, no pagas. Después se cobra ${soles(periodo === 'mensual' ? precios.mensual : precios.anual)} ${periodo === 'mensual' ? 'cada mes' : 'cada año'}.`
                  : 'Cancelas cuando quieras desde aquí; Premium sigue hasta el final de lo que pagaste.'}
            </p>
          </section>
        ) : null}

        {puedeCancelar ? (
          <section className="mt-10 max-w-[34rem]">
            {confirmarCancelar ? (
              <div className="flex flex-col gap-3 border-t border-[var(--linea)] pt-4">
                <p className="m-0 text-[14px] leading-[1.5] text-[var(--texto-2)]">
                  No habrá más cobros. Sigues con Premium hasta el final del periodo que ya pagaste (o de tu prueba).
                </p>
                <div className="flex gap-3">
                  <button type="button" className="boton flex-1" disabled={ocupado !== null} onClick={() => void cancelar()}>
                    {ocupado === 'cancelar' ? 'Cancelando' : 'Sí, cancelar'}
                  </button>
                  <button type="button" className="boton-2 flex-1" onClick={() => setConfirmarCancelar(false)}>
                    Mantener Premium
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="boton-2" onClick={() => setConfirmarCancelar(true)}>
                Cancelar suscripción
              </button>
            )}
          </section>
        ) : null}

        <nav aria-label="Información legal" className="mt-12 flex flex-wrap gap-x-6 gap-y-2 pb-16 text-[12px] text-[var(--texto-2)]">
          <Link to="/terminos" className="border-b border-current">
            Términos y condiciones
          </Link>
          <Link to="/privacidad" className="border-b border-current">
            Privacidad
          </Link>
          <Link to="/libro-de-reclamaciones" className="border-b border-current">
            Libro de Reclamaciones
          </Link>
        </nav>
      </Columna>
    </div>
  );
}

function Uso({ dt, usados, limite }: { dt: string; usados: number; limite: number | null }) {
  const lleno = limite !== null && usados >= limite;
  return (
    <div className="border-b border-[var(--linea)] py-3">
      <dt className="text-[12px] text-[var(--texto-2)]">{dt}</dt>
      <dd className={`m-0 mt-1 ${lleno ? 'text-[var(--anil)]' : ''}`}>{limite === null ? usados : `${Math.min(usados, limite)} de ${limite}`}</dd>
    </div>
  );
}
