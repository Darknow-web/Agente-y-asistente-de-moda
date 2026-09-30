/** Iconos de línea fina (1.5 px) en currentColor. */
import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { tamano?: number };

function base({ tamano = 20, ...resto }: Props) {
  return {
    width: tamano,
    height: tamano,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...resto,
  };
}

export function IconoCamara(p: Props) {
  return (
    <svg {...base(p)}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function IconoCampana(p: Props) {
  return (
    <svg {...base(p)}>
      <path d="M6 8a6 6 0 0 1 12 0v5l2 3H4l2-3V8Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconoVolver(p: Props) {
  return (
    <svg {...base(p)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function IconoCerrar(p: Props) {
  return (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconoLista(p: Props) {
  return (
    <svg {...base(p)}>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

/** El hilo: una pequeña onda que identifica a los departamentos trabajando. */
export function Hilo({ ancho = 28, color = 'var(--acento)', animado = false }: { ancho?: number; color?: string; animado?: boolean }) {
  return (
    <svg
      width={ancho}
      height={8}
      viewBox="0 0 28 8"
      aria-hidden="true"
      className={animado ? 'hilo-ondea' : undefined}
      style={{ flexShrink: 0 }}
    >
      <path d="M1 4c4-3 8 3 12 0s8 3 14 0" fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}
