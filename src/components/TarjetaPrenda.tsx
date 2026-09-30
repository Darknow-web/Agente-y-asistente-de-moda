/** Tarjeta de prenda: foto 4:5 a sangre, nombre en Bodoni, meta en pequeño. */
import { Link } from 'react-router-dom';
import type { EstadoPrenda, Prenda } from '@shared/types';

export const ETIQUETA_ESTADO: Record<EstadoPrenda, string> = {
  limpia: 'limpia',
  usada: 'usada',
  'para-lavar': 'toca lavar',
  'en-lavado': 'en lavado',
  reparar: 'para reparar',
  guardada: 'guardada',
};

export function metaPrenda(prenda: Prenda): string {
  const partes: string[] = [];
  if (prenda.tela) partes.push(prenda.tela.charAt(0).toUpperCase() + prenda.tela.slice(1));
  partes.push(ETIQUETA_ESTADO[prenda.estado] ?? prenda.estado);
  partes.push(`${prenda.usosDesdeLavado} de ${prenda.usosMaxAntesDeLavar} usos`);
  return partes.join(' · ');
}

export function FotoPrenda({
  prenda,
  className = '',
  sizes,
}: {
  prenda: Pick<Prenda, 'nombre' | 'fotoUrl' | 'fotoMiniUrl' | 'colores'>;
  className?: string;
  sizes?: string;
}) {
  const src = prenda.fotoUrl ?? prenda.fotoMiniUrl;
  if (src) {
    return (
      <img
        src={src}
        alt={prenda.nombre}
        loading="lazy"
        sizes={sizes}
        className={`w-full object-cover bg-[var(--hilo)] ${className}`}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${prenda.nombre}, sin foto`}
      className={`w-full bg-[var(--hilo)] flex items-end p-3 ${className}`}
    >
      <span className="pequeno text-[var(--piedra)]">{prenda.colores?.join(', ') || 'Sin foto'}</span>
    </div>
  );
}

export function TarjetaPrenda({ prenda }: { prenda: Prenda }) {
  const alerta = prenda.estado === 'para-lavar';
  return (
    <Link to={`/armario/${encodeURIComponent(prenda.id)}`} className="flex flex-col gap-2 group">
      <FotoPrenda prenda={prenda} className="aspect-[4/5]" sizes="(min-width: 1024px) 25vw, 50vw" />
      <span className="serif text-[17px] leading-[1.2] group-hover:text-[var(--acento)]">{prenda.nombre}</span>
      <span className={`text-[12px] ${alerta ? 'text-[var(--anil)]' : 'text-[var(--texto-2)]'}`}>
        {metaPrenda(prenda)}
      </span>
    </Link>
  );
}
