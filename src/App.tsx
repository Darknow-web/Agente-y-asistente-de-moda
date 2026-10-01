/** Rutas de SASTRA y guardas de sesión. */
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSesion } from './lib/sesion';
import { Disposicion } from './components/Disposicion';
import { CargandoPantalla } from './components/Cargando';
import { Aviso } from './components/Aviso';
import { Portada } from './pages/Portada';
import { SinAcceso } from './pages/SinAcceso';
import { Hoy } from './pages/Hoy';
import { Sastra } from './pages/Sastra';
import { Armario } from './pages/Armario';
import { NuevaPrenda } from './pages/NuevaPrenda';
import { DetallePrenda } from './pages/DetallePrenda';
import { Semana } from './pages/Semana';
import { Probador } from './pages/Probador';
import { Perfil } from './pages/Perfil';
import { Avisos } from './pages/Avisos';
import { Diagnostico } from './pages/Diagnostico';
import { Invitados } from './pages/Invitados';
import { Bienvenida } from './pages/Bienvenida';

/** Sin bienvenida completada y sin datos básicos → se ofrece la bienvenida una vez. */
function necesitaBienvenida(perfil: { bienvenidaCompletada?: boolean; ciudad?: string; estilo?: string[] }): boolean {
  return !perfil.bienvenidaCompletada && !perfil.ciudad && !(perfil.estilo?.length);
}

/** Solo con sesión e invitación. Envuelve en la disposición con navegación. */
function Privado({ children, sinNav = false, soloAdmin = false }: { children: ReactNode; sinNav?: boolean; soloAdmin?: boolean }) {
  const { usuario, yo, cargando, errorYo, recargarYo, salir } = useSesion();
  const ubicacion = useLocation();

  if (cargando) return <CargandoPantalla />;
  if (!usuario) return <Navigate to="/" replace state={{ desde: ubicacion.pathname }} />;
  if (!yo) {
    return (
      <div className="min-h-dvh bg-[var(--fondo)] text-[var(--texto)]">
        <div className="contenedor flex min-h-dvh max-w-[40rem] flex-col justify-center gap-6 py-16">
          <Aviso
            tipo="error"
            accion={
              <button type="button" className="inline-flex min-h-11 items-center text-[13px]" onClick={() => void recargarYo()}>
                <span className="border-b border-[var(--texto)]">Reintentar</span>
              </button>
            }
          >
            {errorYo ?? 'No se pudo cargar tu cuenta.'}
          </Aviso>
          <div className="flex gap-4">
            <a href="/diagnostico" className="boton-2">
              Ver diagnóstico
            </a>
            <button type="button" className="inline-flex min-h-11 items-center text-[13px] text-[var(--texto-2)]" onClick={() => void salir()}>
              Salir
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!yo.invitado) return <Navigate to="/sin-acceso" replace />;
  if (soloAdmin && !yo.admin) return <Navigate to="/perfil" replace />;
  if (necesitaBienvenida(yo.perfil) && ubicacion.pathname !== '/bienvenida' && ubicacion.pathname !== '/diagnostico') {
    return <Navigate to="/bienvenida" replace />;
  }
  return <Disposicion sinNav={sinNav}>{children}</Disposicion>;
}

function Inicio() {
  const { usuario, yo, cargando } = useSesion();
  if (cargando) return <CargandoPantalla />;
  if (usuario && yo?.invitado) return <Navigate to="/hoy" replace />;
  if (usuario && yo && !yo.invitado) return <Navigate to="/sin-acceso" replace />;
  return <Portada />;
}

function RutaSinAcceso() {
  const { usuario, yo, cargando } = useSesion();
  if (cargando) return <CargandoPantalla />;
  if (!usuario) return <Navigate to="/" replace />;
  if (yo?.invitado) return <Navigate to="/hoy" replace />;
  return <SinAcceso />;
}

function RutaDiagnostico() {
  const { usuario, yo, cargando } = useSesion();
  if (cargando) return <CargandoPantalla />;
  if (usuario && yo?.invitado) {
    return (
      <Disposicion>
        <Diagnostico />
      </Disposicion>
    );
  }
  return <Diagnostico />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/sin-acceso" element={<RutaSinAcceso />} />
      <Route path="/diagnostico" element={<RutaDiagnostico />} />
      <Route
        path="/bienvenida"
        element={
          <Privado sinNav>
            <Bienvenida />
          </Privado>
        }
      />
      <Route
        path="/hoy"
        element={
          <Privado>
            <Hoy />
          </Privado>
        }
      />
      <Route
        path="/sastra"
        element={
          <Privado>
            <Sastra />
          </Privado>
        }
      />
      <Route
        path="/armario"
        element={
          <Privado>
            <Armario />
          </Privado>
        }
      />
      <Route
        path="/armario/nueva"
        element={
          <Privado>
            <NuevaPrenda />
          </Privado>
        }
      />
      <Route
        path="/armario/:id"
        element={
          <Privado>
            <DetallePrenda />
          </Privado>
        }
      />
      <Route
        path="/semana"
        element={
          <Privado>
            <Semana />
          </Privado>
        }
      />
      <Route
        path="/probador"
        element={
          <Privado sinNav>
            <Probador />
          </Privado>
        }
      />
      <Route
        path="/perfil"
        element={
          <Privado>
            <Perfil />
          </Privado>
        }
      />
      <Route
        path="/avisos"
        element={
          <Privado>
            <Avisos />
          </Privado>
        }
      />
      <Route
        path="/invitados"
        element={
          <Privado soloAdmin>
            <Invitados />
          </Privado>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
