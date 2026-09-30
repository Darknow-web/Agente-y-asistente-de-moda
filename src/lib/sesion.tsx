/**
 * Contexto de sesión: usuario de Firebase, datos de /api/yo y acciones de entrar/salir.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { RespYo } from '@shared/api';
import { auth, entrarConGoogle, firebaseConfigurado, problemaConfig, salirDeFirebase } from './firebase';
import { api, ErrorHttp } from './api';

export interface Sesion {
  usuario: User | null;
  yo: RespYo | null;
  /** true mientras se resuelve el estado de autenticación o se carga /api/yo */
  cargando: boolean;
  /** mensaje si /api/yo falló (servidor caído, sin configurar…) */
  errorYo: string | null;
  firebaseConfigurado: boolean;
  problemaConfig?: string;
  entrar: () => Promise<void>;
  salir: () => Promise<void>;
  recargarYo: () => Promise<void>;
}

const Contexto = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [yo, setYo] = useState<RespYo | null>(null);
  const [authListo, setAuthListo] = useState(!firebaseConfigurado || !auth);
  const [cargandoYo, setCargandoYo] = useState(false);
  const [errorYo, setErrorYo] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    const parar = onAuthStateChanged(auth, (u) => {
      setUsuario(u);
      setAuthListo(true);
      if (!u) {
        setYo(null);
        setErrorYo(null);
      }
    });
    return parar;
  }, []);

  const cargarYo = useCallback(async (u: User) => {
    setCargandoYo(true);
    setErrorYo(null);
    try {
      const datos = await api.yo();
      setYo(datos);
    } catch (e) {
      if (e instanceof ErrorHttp && e.estado === 403) {
        // El servidor decidió que no está invitado.
        setYo({
          uid: u.uid,
          email: u.email ?? '',
          nombre: u.displayName ?? undefined,
          foto: u.photoURL ?? undefined,
          invitado: false,
          admin: false,
          perfil: {},
          mensajesRestantesHoy: 0,
        });
      } else {
        setYo(null);
        setErrorYo(e instanceof Error ? e.message : 'No se pudo cargar tu cuenta.');
      }
    } finally {
      setCargandoYo(false);
    }
  }, []);

  useEffect(() => {
    if (usuario) void cargarYo(usuario);
  }, [usuario, cargarYo]);

  const entrar = useCallback(async () => {
    await entrarConGoogle();
  }, []);

  const salir = useCallback(async () => {
    await salirDeFirebase();
    setYo(null);
  }, []);

  const recargarYo = useCallback(async () => {
    if (usuario) await cargarYo(usuario);
  }, [usuario, cargarYo]);

  const valor = useMemo<Sesion>(
    () => ({
      usuario,
      yo,
      cargando: !authListo || (Boolean(usuario) && cargandoYo && !yo),
      errorYo,
      firebaseConfigurado,
      problemaConfig,
      entrar,
      salir,
      recargarYo,
    }),
    [usuario, yo, authListo, cargandoYo, errorYo, entrar, salir, recargarYo],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): Sesion {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSesion debe usarse dentro de ProveedorSesion.');
  return ctx;
}
