/**
 * GET /api/salud — diagnóstico público (sin datos sensibles): qué está conectado y qué falta.
 */
import { Router as ExpressRouter } from 'express';
import type { RespuestaSalud } from '@shared/types.js';
import { probarFirestore, probarStorage, proyectoId } from '../auth/admin.js';
import { router as motores, validarModelos } from '../ai/router.js';
import { env } from '../util/env.js';
import { asincrono } from '../util/errores.js';

export const rutasSalud = ExpressRouter();

let cacheModelos: { hasta: number; modelos: RespuestaSalud['modelos'] } | null = null;

rutasSalud.get(
  '/salud',
  asincrono(async (_req, res) => {
    const modo = env('MOTOR_MODO', 'real') === 'simulado' ? 'simulado' : 'real';
    const detalles: string[] = [];
    const [firestore, storage] = await Promise.all([probarFirestore(), probarStorage()]);
    if (firestore !== 'ok') detalles.push(`Firestore: ${firestore === 'sin-configurar' ? 'falta vincular el proyecto de Firebase' : 'configurado pero no responde'}${proyectoId() ? ` (proyecto ${proyectoId()})` : ''}.`);
    if (storage !== 'ok') detalles.push('Storage: las fotos no se podrán guardar hasta vincular el bucket.');

    const gemini: RespuestaSalud['gemini'] = env('GEMINI_API_KEY') ? 'ok' : 'sin-llave';
    const claude: RespuestaSalud['claude'] = env('ANTHROPIC_API_KEY') ? 'ok' : 'sin-llave';
    if (gemini === 'sin-llave' && modo === 'real') detalles.push('Falta GEMINI_API_KEY: el asistente no puede pensar todavía.');
    if (claude === 'sin-llave') detalles.push('Sin llave de Claude: todos los agentes usan Gemini (esto es normal).');

    let modelos: RespuestaSalud['modelos'] = [];
    if (!cacheModelos || cacheModelos.hasta < Date.now()) {
      try {
        modelos = (await validarModelos(motores)).map((m) => ({ agente: m.agente, proveedor: m.proveedor, modelo: m.modelo, valido: m.valido }));
        cacheModelos = { hasta: Date.now() + 10 * 60 * 1000, modelos };
      } catch (e) {
        detalles.push(`No se pudieron validar los modelos: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      modelos = cacheModelos.modelos;
    }
    for (const m of modelos) if (!m.valido) detalles.push(`El modelo "${m.modelo}" del agente ${m.agente} no existe en ${m.proveedor}. Revisa server/src/config/modelos.json.`);

    const respuesta: RespuestaSalud = {
      ok: firestore === 'ok' && (gemini === 'ok' || modo === 'simulado') && modelos.every((m) => m.valido),
      firestore,
      storage,
      gemini,
      claude,
      modelos,
      modo,
      detalles,
    };
    res.json(respuesta);
  }),
);
