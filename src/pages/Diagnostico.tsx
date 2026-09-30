/** Diagnóstico: estado del servidor (/api/salud) y de la configuración de Firebase en el cliente. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useCarga } from '@/lib/useCarga';
import { useSesion } from '@/lib/sesion';
import { firebaseConfigurado, origenConfig, problemaConfig, proyectoId } from '@/lib/firebase';
import { Cabecera } from '@/components/Cabecera';
import { Cargando } from '@/components/Cargando';
import { Aviso } from '@/components/Aviso';
import { Lockup } from '@/components/Marca';

type Estado = 'ok' | 'falta' | 'error' | 'pendiente';

const TEXTO_ESTADO: Record<Estado, string> = {
  ok: 'ok',
  falta: 'falta',
  error: 'error',
  pendiente: 'sin datos',
};

function Fila({ nombre, estado, detalle }: { nombre: string; estado: Estado; detalle?: string }) {
  const color = estado === 'ok' ? 'text-[var(--texto-2)]' : estado === 'pendiente' ? 'text-[var(--texto-2)]' : 'text-[var(--anil)]';
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-[var(--linea)] py-3">
      <span className="text-[15px]">{nombre}</span>
      <span className={`text-right text-[13px] ${color}`}>{TEXTO_ESTADO[estado]}</span>
      {detalle ? <span className="col-span-2 text-[13px] leading-[1.5] text-[var(--texto-2)]">{detalle}</span> : null}
    </li>
  );
}

export function Diagnostico() {
  const { usuario } = useSesion();
  const { datos: salud, error, cargando } = useCarga(() => api.salud());
  const [copiado, setCopiado] = useState(false);

  const idProyecto = proyectoId || '<ID DEL PROYECTO>';
  const instruccion = `Conecta esta app a Firebase Firestore y Authentication usando el proyecto existente ${idProyecto}. La configuración va en src/lib/firebase.ts (variables VITE_FIREBASE_*). No modifiques firestore.rules ni storage.rules; ya existen en la raíz.`;

  const faltaFirestore = salud ? salud.firestore !== 'ok' : false;
  const mostrarBloque = !firebaseConfigurado || faltaFirestore;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(instruccion);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  };

  const estadoServidor: Estado = cargando ? 'pendiente' : error ? 'error' : 'ok';
  const mapa = (v: string | undefined): Estado =>
    v === 'ok' ? 'ok' : v === 'sin-configurar' || v === 'sin-llave' ? 'falta' : v ? 'error' : 'pendiente';

  const contenido = (
    <>
      <Cabecera titulo="Diagnóstico" meta={salud ? (salud.ok ? 'Todo en orden' : 'Hay algo que revisar') : undefined}>
        <p className="m-0 mt-[10px] max-w-[40rem] text-[14px] leading-[1.5] text-[var(--texto-2)]">
          Qué está conectado y qué falta. Nada de esto expone llaves: solo estados.
        </p>
      </Cabecera>

      <div className="lg:grid lg:grid-cols-12 lg:gap-x-6">
        <div className="lg:col-span-6">
          <h2 className="h3 m-0 mt-8">En este navegador</h2>
          <ul className="m-0 mt-3 list-none border-t border-[var(--texto)] p-0">
            <Fila
              nombre="Configuración de Firebase"
              estado={firebaseConfigurado ? 'ok' : 'falta'}
              detalle={
                firebaseConfigurado
                  ? `Proyecto ${proyectoId} · leída de ${origenConfig === 'json' ? 'src/lib/firebase-config.json' : origenConfig === 'applet' ? 'firebase-applet-config.json (AI Studio)' : 'las variables VITE_FIREBASE_*'}`
                  : problemaConfig
              }
            />
            <Fila nombre="Sesión con Google" estado={usuario ? 'ok' : firebaseConfigurado ? 'falta' : 'pendiente'} detalle={usuario?.email ?? undefined} />
          </ul>

          <h2 className="h3 m-0 mt-10">En el servidor</h2>
          {cargando ? (
            <div className="pt-4">
              <Cargando compacto texto="Consultando /api/salud" />
            </div>
          ) : (
            <ul className="m-0 mt-3 list-none border-t border-[var(--texto)] p-0">
              <Fila nombre="Servidor (/api/salud)" estado={estadoServidor} detalle={error ?? undefined} />
              <Fila nombre="Firestore" estado={mapa(salud?.firestore)} />
              <Fila nombre="Storage" estado={mapa(salud?.storage)} />
              <Fila nombre="Gemini" estado={mapa(salud?.gemini)} />
              <Fila nombre="Claude" estado={mapa(salud?.claude)} detalle={salud?.claude === 'sin-llave' ? 'Opcional. Sin llave, todo usa Gemini.' : undefined} />
              <Fila nombre="Modo" estado={salud ? 'ok' : 'pendiente'} detalle={salud ? (salud.modo === 'simulado' ? 'Simulado: responde sin llamar a ningún motor.' : 'Real') : undefined} />
              {salud?.modelos?.map((m) => (
                <Fila key={m.agente} nombre={`Motor de ${m.agente}`} estado={m.valido ? 'ok' : 'error'} detalle={`${m.proveedor} · ${m.modelo}`} />
              ))}
            </ul>
          )}
          {salud?.detalles?.length ? (
            <ul className="m-0 mt-4 list-none p-0 text-[13px] leading-[1.5] text-[var(--texto-2)]">
              {salud.detalles.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          ) : null}
        </div>

        {mostrarBloque ? (
          <div className="mt-10 lg:col-span-5 lg:col-start-8 lg:mt-8">
            <h2 className="h3 m-0">Cómo conectar Firebase</h2>
            <p className="m-0 mt-3 text-[14px] leading-[1.5] text-[var(--texto-2)]">
              Copia este texto y pégalo en el chat de AI Studio, o dáselo a quien mantiene la app.
            </p>
            <pre className="bloque-copiable mt-4">{instruccion}</pre>
            <div className="mt-3 flex items-center gap-4">
              <button type="button" className="boton-2" onClick={() => void copiar()}>
                {copiado ? 'Copiado' : 'Copiar texto'}
              </button>
            </div>
            <ol className="m-0 mt-6 flex list-decimal flex-col gap-2 pl-5 text-[14px] leading-[1.5]">
              <li>En AI Studio abre Settings y luego Integrations.</li>
              <li>Activa Firebase Firestore y Authentication y elige el proyecto existente.</li>
              <li>Habilita el proveedor Google en Authentication y añade el dominio de la app a los dominios autorizados.</li>
              <li>AI Studio genera las variables VITE_FIREBASE_*; si no, cópialas de la consola de Firebase al archivo .env.</li>
              <li>Vuelve a desplegar y recarga esta pantalla: Firestore y la configuración deben aparecer en ok.</li>
            </ol>
          </div>
        ) : null}
      </div>

      {salud && !salud.ok && !mostrarBloque ? (
        <div className="mt-8 max-w-[40rem]">
          <Aviso tipo="info">Falta alguna llave del servidor. Revisa las variables GEMINI_API_KEY y ADMIN_EMAILS en el entorno de Cloud Run.</Aviso>
        </div>
      ) : null}
    </>
  );

  // Sin sesión, la página se muestra sola (sirve para arreglar la configuración antes de poder entrar).
  if (!usuario) {
    return (
      <div className="min-h-dvh bg-[var(--fondo)] text-[var(--texto)]">
        <div className="contenedor aparece pb-16">
          <div className="flex h-[72px] items-center justify-between pt-7">
            <Link to="/" aria-label="SASTRA, inicio" className="inline-flex">
              <Lockup altura={30} />
            </Link>
            <Link to="/" className="inline-flex min-h-11 items-center text-[14px] font-medium">
              <span className="border-b border-[var(--texto)] pb-[2px]">Volver a la portada</span>
            </Link>
          </div>
          {contenido}
        </div>
      </div>
    );
  }

  return (
    <div className="aparece px-[var(--margen)] pb-16 lg:px-16">
      {contenido}
    </div>
  );
}
