/** Indicador de carga: una línea de hilo que recorre el ancho. Sin spinner. */
export function Cargando({
  texto,
  compacto = false,
}: {
  texto?: string;
  compacto?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={compacto ? 'flex flex-col gap-2' : 'flex flex-col gap-3 py-6'}
    >
      <div className="hilo-cargando" aria-hidden="true" />
      <span className="pequeno">{texto ?? 'Cargando'}</span>
    </div>
  );
}

/** Pantalla completa mientras se resuelve la sesión. */
export function CargandoPantalla({ texto }: { texto?: string }) {
  return (
    <div className="min-h-dvh flex items-end bg-[var(--fondo)]">
      <div className="contenedor pb-16">
        <Cargando texto={texto ?? 'Abriendo tu departamento de moda'} />
      </div>
    </div>
  );
}
