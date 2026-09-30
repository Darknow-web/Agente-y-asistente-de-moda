/**
 * Clima con Open-Meteo (gratis, sin llave). Geocodifica la ciudad del perfil una vez.
 */
export interface Clima {
  fecha: string;
  temperaturaMinC: number;
  temperaturaMaxC: number;
  temperaturaC: number;
  descripcion: string;
  lluvia: boolean;
}

const CODIGOS: Record<number, string> = {
  0: 'despejado',
  1: 'mayormente despejado',
  2: 'parcialmente nublado',
  3: 'nublado',
  45: 'niebla',
  48: 'niebla con escarcha',
  51: 'llovizna ligera',
  53: 'llovizna',
  55: 'llovizna intensa',
  61: 'lluvia ligera',
  63: 'lluvia',
  65: 'lluvia intensa',
  71: 'nieve ligera',
  73: 'nieve',
  75: 'nieve intensa',
  80: 'chubascos ligeros',
  81: 'chubascos',
  82: 'chubascos fuertes',
  95: 'tormenta',
};

const cacheGeo = new Map<string, { lat: number; lon: number; nombre: string }>();

export async function geocodificar(ciudad: string, pais?: string): Promise<{ lat: number; lon: number; nombre: string } | null> {
  const clave = `${ciudad}|${pais ?? ''}`.toLowerCase();
  if (cacheGeo.has(clave)) return cacheGeo.get(clave)!;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=5&language=es&format=json`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const datos = (await r.json()) as { results?: { latitude: number; longitude: number; name: string; country?: string }[] };
  let res = datos.results ?? [];
  if (pais) {
    const filtrados = res.filter((x) => (x.country ?? '').toLowerCase().includes(pais.toLowerCase()));
    if (filtrados.length) res = filtrados;
  }
  const mejor = res[0];
  if (!mejor) return null;
  const out = { lat: mejor.latitude, lon: mejor.longitude, nombre: `${mejor.name}${mejor.country ? ', ' + mejor.country : ''}` };
  cacheGeo.set(clave, out);
  return out;
}

const cacheClima = new Map<string, { hasta: number; datos: Clima[] }>();

/** Pronóstico diario para los próximos 7 días. */
export async function pronostico(lat: number, lon: number, zona = 'America/Lima'): Promise<Clima[]> {
  const clave = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const c = cacheClima.get(clave);
  if (c && c.hasta > Date.now()) return c.datos;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(zona)}&forecast_days=7`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('No pudimos consultar el clima.');
  const d = (await r.json()) as {
    daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[] };
  };
  const datos: Clima[] = d.daily.time.map((fecha, i) => {
    const max = d.daily.temperature_2m_max[i]!;
    const min = d.daily.temperature_2m_min[i]!;
    const codigo = d.daily.weather_code[i]!;
    return {
      fecha,
      temperaturaMaxC: Math.round(max),
      temperaturaMinC: Math.round(min),
      temperaturaC: Math.round((max + min) / 2),
      descripcion: CODIGOS[codigo] ?? 'variable',
      lluvia: (d.daily.precipitation_probability_max[i] ?? 0) >= 50 || codigo >= 51,
    };
  });
  cacheClima.set(clave, { hasta: Date.now() + 60 * 60 * 1000, datos });
  return datos;
}

export function resumenClima(c: Clima): string {
  return `${c.temperaturaMinC}–${c.temperaturaMaxC} °C, ${c.descripcion}${c.lluvia ? ', probable lluvia' : ''}`;
}
