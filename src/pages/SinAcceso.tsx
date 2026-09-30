/** Con sesión pero sin invitación. */
import { Lockup } from '@/components/Marca';
import { useSesion } from '@/lib/sesion';

export function SinAcceso() {
  const { usuario, yo, salir } = useSesion();
  const email = yo?.email || usuario?.email || 'tu correo';
  return (
    <div className="min-h-dvh bg-[var(--fondo)] text-[var(--texto)]">
      <div className="contenedor aparece flex min-h-dvh flex-col justify-center gap-8 py-16">
        <Lockup altura={28} />
        <div className="flex max-w-[34rem] flex-col gap-4 border-t border-[var(--texto)] pt-6">
          <h1 className="h2 m-0">Todavía no tienes acceso a SASTRA.</h1>
          <p className="m-0 text-[15px] leading-[1.55] text-[var(--texto-2)]">
            Entraste como <span className="text-[var(--texto)]">{email}</span>, pero ese correo aún no está en la
            lista de invitados. Pide a quien administra SASTRA que te agregue y vuelve a entrar.
          </p>
          <div className="pt-2">
            <button type="button" className="boton-2" onClick={() => void salir()}>
              Salir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
