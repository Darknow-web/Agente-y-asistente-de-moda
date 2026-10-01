/**
 * Bienvenida: cinco preguntas con opciones, dos minutos, para que el departamento trabaje desde el
 * primer día sin esperar a que la persona lo cuente todo en el chat.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Perfil } from '@shared/types';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { DIAS_SEMANA } from '@/lib/fechas';
import { Lockup } from '@/components/Marca';
import { Aviso } from '@/components/Aviso';

interface Paso {
  id: 'ciudad' | 'semana' | 'estilo' | 'tallas' | 'presupuesto';
  titulo: string;
  ayuda: string;
  opciones: string[];
  multiple?: boolean;
  texto?: string;
}

const PASOS: Paso[] = [
  { id: 'ciudad', titulo: '¿En qué ciudad vives?', ayuda: 'Sastra mira el clima antes de vestirte.', opciones: ['Lima', 'Arequipa', 'Trujillo', 'Cusco', 'Piura'], texto: 'Otra ciudad' },
  {
    id: 'semana',
    titulo: '¿Cómo es tu semana?',
    ayuda: 'Marca todo lo que haces casi todas las semanas.',
    opciones: ['Oficina', 'Trabajo en campo o tiendas', 'Estudios', 'Trabajo en casa', 'Gimnasio', 'Salidas', 'Reuniones formales'],
    multiple: true,
  },
  {
    id: 'estilo',
    titulo: 'Tu estilo, en tres palabras',
    ayuda: 'Elige las que más se parecen a ti.',
    opciones: ['Minimalista', 'Clásica', 'Cómoda', 'Elegante', 'Urbana', 'Colorida', 'Discreta', 'Con personalidad'],
    multiple: true,
    texto: 'Otra palabra',
  },
  { id: 'tallas', titulo: '¿Qué talla usas arriba?', ayuda: 'Camisas, polos, blusas. Las demás tallas te las pregunta Sastra después, de a una.', opciones: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], texto: 'Otra talla' },
  { id: 'presupuesto', titulo: '¿Cuánto gastas en ropa al mes?', ayuda: 'Sirve para frenar compras que no hacen falta, no para juzgar.', opciones: ['Menos de S/ 100', 'S/ 100 a 300', 'S/ 300 a 600', 'Más de S/ 600', 'Prefiero no decirlo'] },
];

const PRESUPUESTO: Record<string, number | undefined> = { 'Menos de S/ 100': 80, 'S/ 100 a 300': 200, 'S/ 300 a 600': 450, 'Más de S/ 600': 800, 'Prefiero no decirlo': undefined };

function aPerfil(resp: Record<string, string[]>): Partial<Perfil> {
  const ciudad = resp.ciudad?.[0];
  const semana = (resp.semana ?? []).map((s) => s.toLowerCase());
  const rutina: Perfil['rutina'] = {};
  const laborables = semana.filter((s) => !['gimnasio', 'salidas'].includes(s));
  for (const d of DIAS_SEMANA.slice(0, 5)) rutina[d] = laborables.length ? laborables : [];
  if (semana.includes('gimnasio')) for (const d of ['martes', 'jueves']) rutina[d] = [...(rutina[d] ?? []), 'gimnasio'];
  if (semana.includes('salidas')) {
    rutina.viernes = [...(rutina.viernes ?? []), 'salida'];
    rutina.sábado = ['salida'];
  }
  const presupuesto = PRESUPUESTO[resp.presupuesto?.[0] ?? ''];
  return {
    ciudad: ciudad || undefined,
    pais: ciudad ? 'Perú' : undefined,
    rutina: Object.fromEntries(Object.entries(rutina).filter(([, v]) => v.length)),
    estilo: (resp.estilo ?? []).map((s) => s.toLowerCase()),
    tallas: resp.tallas?.[0] ? { superior: resp.tallas[0] } : undefined,
    presupuestoMensual: presupuesto,
    moneda: presupuesto ? 'PEN' : undefined,
    bienvenidaCompletada: true,
  };
}

export function Bienvenida() {
  const navegar = useNavigate();
  const { yo, recargarYo } = useSesion();
  const [indice, setIndice] = useState(0);
  const [resp, setResp] = useState<Record<string, string[]>>({});
  const [otro, setOtro] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paso = PASOS[indice]!;
  const elegidas = resp[paso.id] ?? [];

  const alternar = (opcion: string) => {
    const actuales = resp[paso.id] ?? [];
    const nuevas = paso.multiple ? (actuales.includes(opcion) ? actuales.filter((o) => o !== opcion) : [...actuales, opcion]) : [opcion];
    setResp({ ...resp, [paso.id]: nuevas });
    if (!paso.multiple) setTimeout(() => void siguiente({ ...resp, [paso.id]: nuevas }), 150);
  };

  const siguiente = async (respuestas = resp) => {
    const conOtro = otro.trim() ? { ...respuestas, [paso.id]: [...(respuestas[paso.id] ?? []), otro.trim()] } : respuestas;
    setOtro('');
    if (indice < PASOS.length - 1) {
      setResp(conOtro);
      setIndice(indice + 1);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await api.guardarPerfil(aPerfil(conOtro));
      await recargarYo();
      navegar('/hoy', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      setGuardando(false);
    }
  };

  const saltar = async () => {
    setGuardando(true);
    try {
      await api.guardarPerfil({ bienvenidaCompletada: true });
      await recargarYo();
    } finally {
      navegar('/hoy', { replace: true });
    }
  };

  const nombre = yo?.perfil.nombre || yo?.nombre?.split(' ')[0];

  return (
    <div className="aparece min-h-dvh bg-[var(--fondo)] text-[var(--texto)]">
      <div className="mx-auto flex min-h-dvh max-w-[40rem] flex-col px-[var(--margen)] pb-12 pt-8">
        <header className="flex items-center justify-between">
          <Lockup altura={28} />
          <span className="pequeno">
            {indice + 1} de {PASOS.length}
          </span>
        </header>

        <div className="mt-10 flex flex-col gap-2">
          {indice === 0 ? (
            <p className="m-0 text-[14px] text-[var(--texto-2)]">{nombre ? `Hola, ${nombre}. ` : ''}Cinco preguntas y el departamento empieza a trabajar para ti.</p>
          ) : null}
          <h1 className="h1 m-0 text-[32px] leading-[1.05]">{paso.titulo}</h1>
          <p className="m-0 text-[14px] leading-[1.5] text-[var(--texto-2)]">{paso.ayuda}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2" role={paso.multiple ? 'group' : 'radiogroup'}>
          {paso.opciones.map((o) => (
            <button
              key={o}
              type="button"
              className="chip"
              aria-pressed={elegidas.includes(o)}
              disabled={guardando}
              onClick={() => alternar(o)}
            >
              {o}
            </button>
          ))}
        </div>

        {paso.texto ? (
          <div className="mt-4">
            <label htmlFor="bienvenida-otro" className="campo-etiqueta">
              {paso.texto}
            </label>
            <input id="bienvenida-otro" className="campo" value={otro} onChange={(e) => setOtro(e.target.value)} placeholder="Escríbelo" />
          </div>
        ) : null}

        {error ? (
          <div className="mt-4">
            <Aviso tipo="error" onCerrar={() => setError(null)}>
              {error}
            </Aviso>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-3 pt-10">
          {paso.multiple || paso.texto ? (
            <button type="button" className="boton" disabled={guardando || (!elegidas.length && !otro.trim() && paso.id !== 'semana')} onClick={() => void siguiente()}>
              {guardando ? 'Guardando' : indice === PASOS.length - 1 ? 'Empezar' : 'Siguiente'}
            </button>
          ) : null}
          <div className="flex justify-between">
            <button type="button" className="inline-flex min-h-11 items-center text-[13px] text-[var(--texto-2)]" disabled={indice === 0 || guardando} onClick={() => setIndice(indice - 1)}>
              Atrás
            </button>
            <button type="button" className="inline-flex min-h-11 items-center text-[13px] text-[var(--texto-2)]" disabled={guardando} onClick={() => void saltar()}>
              <span className="border-b border-current pb-[2px]">Lo hago después</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
