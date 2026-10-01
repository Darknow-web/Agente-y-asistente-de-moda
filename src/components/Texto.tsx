/** Pinta el texto de un agente (Markdown mínimo) con el estilo de SASTRA. */
import { Fragment } from 'react';
import { bloquesDe, type Tramo } from '@/lib/markdown';

function Tramos({ tramos }: { tramos: Tramo[] }) {
  return (
    <>
      {tramos.map((t, i) =>
        t.tipo === 'negrita' ? (
          <strong key={i} className="font-medium">
            {t.texto}
          </strong>
        ) : t.tipo === 'cursiva' ? (
          <em key={i}>{t.texto}</em>
        ) : (
          <Fragment key={i}>{t.texto}</Fragment>
        ),
      )}
    </>
  );
}

export function Texto({
  texto,
  escribiendo = false,
  className = '',
}: {
  texto: string;
  /** Marca el último bloque con el cursor de "escribiendo". */
  escribiendo?: boolean;
  className?: string;
}) {
  const bloques = bloquesDe(texto);
  return (
    <>
      {bloques.map((b, i) => {
        const ultimo = escribiendo && i === bloques.length - 1 ? 'escribiendo' : '';
        if (b.tipo === 'titulo') {
          return (
            <p key={i} className={`serif m-0 mt-1 text-[19px] leading-[1.25] ${className} ${ultimo}`}>
              <Tramos tramos={b.tramos} />
            </p>
          );
        }
        if (b.tipo === 'lista') {
          const Etiqueta = b.ordenada ? 'ol' : 'ul';
          return (
            <Etiqueta key={i} className={`m-0 flex flex-col gap-1 pl-5 ${b.ordenada ? 'list-decimal' : 'list-disc'} ${className} ${ultimo}`}>
              {b.items.map((it, j) => (
                <li key={j} className="pl-1">
                  <Tramos tramos={it} />
                </li>
              ))}
            </Etiqueta>
          );
        }
        return (
          <p key={i} className={`m-0 whitespace-pre-line ${className} ${ultimo}`}>
            <Tramos tramos={b.tramos} />
          </p>
        );
      })}
    </>
  );
}
