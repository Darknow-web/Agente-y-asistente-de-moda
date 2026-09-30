/** Hook mínimo para cargar datos de la API con estados de carga y error. */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useCarga<T>(cargar: () => Promise<T>, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const ref = useRef(cargar);
  ref.current = cargar;

  const recargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    setError(null);
    try {
      const r = await ref.current();
      setDatos(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo falló al cargar.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
    // Las dependencias las decide quien llama (p. ej. el id de la ruta).
  }, deps);

  return { datos, setDatos, error, cargando, recargar };
}
