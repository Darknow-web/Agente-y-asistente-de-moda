/**
 * Portada (sin sesión). Reproduce la maqueta Main.dc.html; en teléfono se apila:
 * titular, foto, botón.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lockup } from '@/components/Marca';
import { Aviso } from '@/components/Aviso';
import { useSesion } from '@/lib/sesion';

const DEPARTAMENTOS = [
  'Dirección Creativa',
  'Guardarropa',
  'Estilismo',
  'Planificación',
  'Cuidado',
  'Personal Shopper',
  'Probador',
];

const PASOS = [
  {
    titulo: 'Sube tus prendas',
    texto: 'Una foto basta. Guardarropa reconoce la prenda, la tela y cuántos usos aguanta antes de lavar.',
  },
  {
    titulo: 'Cada mañana, un look',
    texto: 'Estilismo y Planificación cruzan tu agenda, el clima y lo que tienes limpio. Tú solo eliges.',
  },
  {
    titulo: 'Te acompaña al comprar',
    texto: 'En el probador, mándale una foto. Te dice si te queda, con qué combina y si llena un vacío real.',
  },
];

export function Portada() {
  const { entrar, firebaseConfigurado, problemaConfig } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  const alEntrar = async () => {
    setError(null);
    if (!firebaseConfigurado) {
      setError(problemaConfig ?? 'Falta conectar Firebase.');
      return;
    }
    setEntrando(true);
    try {
      await entrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--fondo)] text-[var(--texto)]">
      <div className="mx-auto flex min-h-dvh max-w-[var(--ancho-max)] flex-col">
        <header className="flex h-[72px] items-center justify-between px-[var(--margen)] pt-7">
          <Link to="/" aria-label="SASTRA, inicio" className="inline-flex">
            <Lockup altura={34} />
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-6 text-[14px] font-medium tracking-[0.01em] lg:gap-10">
            <a href="#como" className="hidden sm:inline-flex min-h-11 items-center">
              Cómo funciona
            </a>
            <a href="#departamento" className="hidden sm:inline-flex min-h-11 items-center">
              El departamento
            </a>
            <button
              type="button"
              onClick={alEntrar}
              disabled={entrando}
              className="inline-flex h-11 items-center bg-[var(--texto)] px-[22px] tracking-[0.04em] text-[var(--inverso)] disabled:opacity-40"
            >
              Entrar con Google
            </button>
          </nav>
        </header>

        <section className="aparece mt-6 grid flex-1 grid-cols-1 gap-y-8 pl-[var(--margen)] pr-[var(--margen)] lg:grid-cols-12 lg:gap-x-6 lg:pr-0">
          <div className="flex flex-col justify-center lg:col-span-5 lg:pb-24 lg:pr-6">
            <h1 className="display m-0 text-[44px] leading-[0.98] tracking-[-0.01em] sm:text-[60px] lg:text-[84px]">
              Tu armario,
              <br />
              con un departamento de moda detrás.
            </h1>
            <p className="m-0 mt-7 max-w-[30em] text-[17px] leading-[1.5] text-[var(--texto-2)] lg:mt-9 lg:text-[18px]">
              Sastra conoce cada prenda que tienes, te viste cada mañana según tu día y tu clima, cuida tu
              ropa y te acompaña cuando sales a comprar.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4 lg:mt-11">
              <button
                type="button"
                onClick={alEntrar}
                disabled={entrando}
                className="inline-flex h-[52px] items-center justify-center bg-[var(--texto)] px-7 text-[15px] font-medium tracking-[0.04em] text-[var(--inverso)] disabled:opacity-40"
              >
                {entrando ? 'Abriendo Google' : 'Empezar con Google'}
              </button>
              <a href="#como" className="inline-flex min-h-11 items-center text-[15px] font-medium">
                <span className="border-b border-[var(--texto)] pb-[2px]">Ver cómo funciona</span>
              </a>
            </div>
            {error ? (
              <div className="mt-6 max-w-[30em]">
                <Aviso
                  tipo="error"
                  onCerrar={() => setError(null)}
                  accion={
                    !firebaseConfigurado ? (
                      <Link to="/diagnostico" className="inline-flex min-h-11 items-center text-[13px]">
                        <span className="border-b border-[var(--texto)]">Ver diagnóstico</span>
                      </Link>
                    ) : undefined
                  }
                >
                  {error}
                </Aviso>
              </div>
            ) : null}
          </div>

          <figure className="relative m-0 -mr-[var(--margen)] aspect-[4/5] sm:aspect-[3/2] lg:col-span-7 lg:mr-0 lg:aspect-auto lg:min-h-[560px]">
            <div className="absolute inset-0 bg-[var(--hilo)]" aria-hidden="true" />
            <img
              src="/hero.jpg"
              alt="Armario con prendas en tonos crudos y una rama de pampa"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: '60% 50%' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
              }}
            />
            <figcaption
              className="serif absolute bottom-5 left-6 italic text-[18px] text-[var(--lino)]"
              style={{ textShadow: '0 1px 12px rgba(0,0,0,0.35)' }}
            >
              Lo que ya tienes es el punto de partida.
            </figcaption>
          </figure>
        </section>

        <section id="como" className="px-[var(--margen)] pt-16 pb-14 lg:pt-28 lg:pb-24">
          <h2 className="h2 m-0">Cómo funciona</h2>
          <ol className="m-0 mt-8 grid list-none gap-8 p-0 border-t border-[var(--texto)] pt-8 sm:grid-cols-3 sm:gap-6">
            {PASOS.map((paso, i) => (
              <li key={paso.titulo} className="flex flex-col gap-2">
                <span className="pequeno">{i + 1}</span>
                <span className="serif text-[22px] leading-[1.15]">{paso.titulo}</span>
                <p className="m-0 text-[15px] leading-[1.55] text-[var(--texto-2)]">{paso.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer
          id="departamento"
          className="mx-[var(--margen)] flex flex-col gap-4 border-t border-[var(--texto)] pb-7 pt-[22px] text-[13px] lg:flex-row lg:items-baseline lg:justify-between lg:gap-6"
        >
          <span className="serif shrink-0 italic text-[17px] text-[var(--texto-2)]">
            Un solo interlocutor, siete departamentos
          </span>
          <ul className="m-0 flex list-none flex-wrap gap-x-8 gap-y-2 p-0">
            {DEPARTAMENTOS.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </footer>
      </div>
    </div>
  );
}
