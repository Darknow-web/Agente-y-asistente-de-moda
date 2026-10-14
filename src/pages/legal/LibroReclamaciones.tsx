/** Libro de Reclamaciones virtual (D.S. 011-2011-PCM). Se puede registrar sin cuenta. */
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { PROVEEDOR } from '@/lib/legal';
import { Aviso } from '@/components/Aviso';
import { PaginaLegal } from './PaginaLegal';

const VACIO = {
  tipo: 'reclamo' as 'reclamo' | 'queja',
  nombre: '',
  documento: '',
  domicilio: '',
  telefono: '',
  email: '',
  servicio: 'Suscripción SASTRA Premium',
  monto: '',
  detalle: '',
  pedido: '',
};

export function LibroReclamaciones() {
  const [f, setF] = useState(VACIO);
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);

  const campo = (k: keyof typeof VACIO) => (e: { target: { value: string } }) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const monto = Number.parseFloat(f.monto.replace(',', '.'));
      const r = await api.reclamacion({
        tipo: f.tipo,
        nombre: f.nombre,
        documento: f.documento,
        domicilio: f.domicilio || undefined,
        telefono: f.telefono || undefined,
        email: f.email,
        servicio: f.servicio,
        monto: Number.isFinite(monto) ? monto : undefined,
        detalle: f.detalle,
        pedido: f.pedido,
      });
      setCodigo(r.id);
      setF(VACIO);
      setAcepto(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <PaginaLegal titulo="Libro de Reclamaciones">
      <p className="m-0">
        {PROVEEDOR.nombre} · RUC {PROVEEDOR.ruc} · {PROVEEDOR.domicilio}. Conforme al Código de Protección y Defensa del Consumidor, responderemos en un
        plazo máximo de 15 días hábiles al correo que indiques.
      </p>
      <p className="m-0 text-[13px] text-[var(--texto-2)]">
        Reclamo: disconformidad con el servicio. Queja: malestar con la atención, sin relación directa con el servicio.
      </p>

      {codigo ? (
        <Aviso tipo="ok" onCerrar={() => setCodigo(null)}>
          Registrado con el código {codigo}. Guárdalo; te llegará la respuesta a tu correo.
        </Aviso>
      ) : null}
      {error ? (
        <Aviso tipo="error" onCerrar={() => setError(null)}>
          {error}
        </Aviso>
      ) : null}

      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4">
        <fieldset className="m-0 flex gap-6 border-0 p-0">
          <legend className="campo-etiqueta">Tipo</legend>
          {(['reclamo', 'queja'] as const).map((t) => (
            <label key={t} className="inline-flex min-h-11 items-center gap-2 text-[15px]">
              <input type="radio" className="accent-[var(--texto)]" name="tipo" checked={f.tipo === t} onChange={() => setF((p) => ({ ...p, tipo: t }))} />
              {t === 'reclamo' ? 'Reclamo' : 'Queja'}
            </label>
          ))}
        </fieldset>
        <Entrada id="nombre" etiqueta="Nombre completo" valor={f.nombre} onChange={campo('nombre')} requerido />
        <Entrada id="documento" etiqueta="DNI o carné de extranjería" valor={f.documento} onChange={campo('documento')} requerido />
        <Entrada id="email" etiqueta="Correo" tipo="email" valor={f.email} onChange={campo('email')} requerido />
        <Entrada id="telefono" etiqueta="Teléfono (opcional)" valor={f.telefono} onChange={campo('telefono')} />
        <Entrada id="domicilio" etiqueta="Domicilio (opcional)" valor={f.domicilio} onChange={campo('domicilio')} />
        <Entrada id="servicio" etiqueta="Servicio contratado" valor={f.servicio} onChange={campo('servicio')} requerido />
        <Entrada id="monto" etiqueta="Monto reclamado en soles (opcional)" valor={f.monto} onChange={campo('monto')} />
        <div>
          <label htmlFor="detalle" className="campo-etiqueta">
            Detalle
          </label>
          <textarea id="detalle" className="campo min-h-32" value={f.detalle} onChange={campo('detalle')} required minLength={10} maxLength={3000} />
        </div>
        <div>
          <label htmlFor="pedido" className="campo-etiqueta">
            Qué solicitas
          </label>
          <textarea id="pedido" className="campo min-h-20" value={f.pedido} onChange={campo('pedido')} required maxLength={1500} />
        </div>
        <label className="inline-flex items-start gap-2 text-[13px] leading-[1.45]">
          <input type="checkbox" className="mt-1 accent-[var(--texto)]" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          Declaro que los datos son verdaderos y acepto que se usen para atender este registro.
        </label>
        <button type="submit" className="boton" disabled={enviando || !acepto}>
          {enviando ? 'Registrando' : 'Registrar'}
        </button>
      </form>
    </PaginaLegal>
  );
}

function Entrada({
  id,
  etiqueta,
  valor,
  onChange,
  tipo = 'text',
  requerido = false,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (e: { target: { value: string } }) => void;
  tipo?: string;
  requerido?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="campo-etiqueta">
        {etiqueta}
      </label>
      <input id={id} className="campo" type={tipo} value={valor} onChange={onChange} required={requerido} />
    </div>
  );
}
