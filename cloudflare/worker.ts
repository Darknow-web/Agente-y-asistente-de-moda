/**
 * SASTRA en Cloudflare: un Worker pequeño delante de un contenedor (Cloudflare Containers) que corre la misma
 * imagen del Dockerfile (Express + cliente). Todo el tráfico va a una única instancia con nombre "principal";
 * se duerme tras 15 minutos sin uso y despierta con la siguiente petición.
 *
 * Los secretos del Worker (Settings › Variables and Secrets) se pasan al contenedor como variables de entorno.
 * Las tareas programadas (Cron Triggers de wrangler.jsonc) reemplazan a Cloud Scheduler: el Worker llama a
 * /api/jobs/<tarea> con la cabecera x-jobs-secret.
 */
import { Container, getContainer } from '@cloudflare/containers';

interface Env {
  SASTRA: DurableObjectNamespace<Sastra>;
  JOBS_SECRET?: string;
  [variable: string]: unknown;
}

/** Solo las variables de texto (secretos y vars); los enlaces como SASTRA no viajan al contenedor. */
function variablesDeTexto(env: Env): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(env)) {
    if (typeof valor === 'string' && valor !== '') salida[clave] = valor;
  }
  return salida;
}

export class Sastra extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = '15m';

  constructor(ctx: ConstructorParameters<typeof Container<Env>>[0], env: Env) {
    super(ctx, env);
    this.envVars = { ...variablesDeTexto(env), NODE_ENV: 'production', PORT: '8080' };
  }

  override onError(error: unknown) {
    console.error('[sastra] el contenedor falló:', error);
    throw error;
  }
}

/** Cron (UTC; Lima es UTC−5) → tarea de server/src/routes/jobs.ts. Debe coincidir con triggers.crons. */
export const TAREAS: Record<string, string> = {
  '30 11 * * *': 'look-del-dia', // 06:30 en Lima
  '0 13 * * *': 'diario', // 08:00 en Lima
  '0 0 * * *': 'recordatorios-lavado', // 19:00 en Lima
  '0 1 * * 1': 'plan-semanal', // domingo 20:00 en Lima
};

function contenedor(env: Env) {
  return getContainer(env.SASTRA, 'principal');
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return contenedor(env).fetch(request);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const tarea = TAREAS[controller.cron];
    if (!tarea) {
      console.warn(`[cron] sin tarea para "${controller.cron}"`);
      return;
    }
    ctx.waitUntil(
      (async () => {
        const r = await contenedor(env).fetch(
          new Request(`http://sastra/api/jobs/${tarea}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-jobs-secret': env.JOBS_SECRET ?? '' },
            body: '{}',
          }),
        );
        console.log(`[cron] ${tarea}: ${r.status} ${(await r.text()).slice(0, 500)}`);
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
