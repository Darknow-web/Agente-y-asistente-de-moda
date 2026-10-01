# Costos: cuánto cuesta SASTRA y cómo se mantiene bajo

## En una frase

Con 4 personas usando la app unas 8 veces al día, SASTRA cuesta **entre 2 y 7 dólares al mes**. Con más
uso, sube en proporción. No hay mensualidad fija: solo se paga lo que se usa.

## De dónde sale el costo

1. **Motor de IA (Gemini)**. Se cobra por "tokens" (trozos de texto). Un mensaje con su respuesta son
   unos 3.500 tokens; una foto, unos 1.000; un video de 30 segundos, unos 8.000.
2. **Búsqueda en internet** (Personal Shopper). Incluida hasta 5.000 búsquedas al mes en los modelos
   Gemini 3.x (o 1.500 al día en 2.5); después, se cobra por búsqueda.
3. **Cloud Run** (donde vive la app). Nivel gratuito generoso: con 4 personas, 0 dólares.
4. **Firestore y Storage** (datos y fotos). Nivel gratuito: 1 GB de datos y 5 GB de fotos. Con 4 personas,
   0 dólares.

## Precios de referencia (por millón de tokens, verificados el 30/09/2026)

| Modelo | Entrada | Salida | Para qué lo usa SASTRA |
|---|---|---|---|
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 | Cuidado, ajuste diario, resúmenes |
| Gemini 2.5 Flash | $0.30 | $2.50 | Dirección, Guardarropa (fotos), Estilismo, Probador (video), Calidad |
| Gemini 2.5 Pro | $1.25 | $10.00 | Plan semanal completo, análisis de compras |
| Claude Haiku 4.5 | $1.00 | $5.00 | Opcional |
| Claude Sonnet 5.5 | $2.00 | $10.00 | Opcional (mejor conversación) |
| Claude Opus 5.5 | $4.00 | $20.00 | Opcional (máxima calidad) |

Los precios se actualizan en `server/src/ai/costos.ts`; `npm run smoke` los usa para estimar el costo de una
llamada real. Fuente: [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) y
[anthropic.com/pricing](https://www.anthropic.com/pricing).

## Escenarios

| Personas activas | Mensajes por persona y día | Costo mensual estimado |
|---|---|---|
| 4 | 8 | $2 a $7 |
| 10 | 8 | $6 a $18 |
| 50 | 6 | $25 a $70 |
| 100 | 6 | $50 a $140 |

Como negocio: entre $0.50 y $1.50 por persona activa al mes. Con un plan de $5 al mes queda margen sano.

## Cómo SASTRA mantiene el costo bajo

- **Modelo según la tarea**: lo simple va al modelo ligero; solo el plan semanal y el análisis de compras usan
  Pro.
- **Contexto compacto**: el armario viaja como una tabla de texto (id, nombre, colores, estado), nunca como
  fotos, salvo la foto que el cliente acaba de mandar.
- **Historial resumido**: cada 16 mensajes se resume lo anterior; se envían solo los últimos 12.
- **Límite diario**: 60 mensajes por persona al día (`server/src/config/limites.json`).
- **Calidad con criterio**: el revisor solo actúa sobre respuestas importantes, no sobre cada mensaje corto.
- **Registro de consumo**: cada llamada guarda tokens y costo estimado. Como administrador puedes ver
  `/api/uso/resumen?mes=2026-10`.

## Alerta de presupuesto

Configura una alerta de 10 dólares en Google Cloud (Facturación › Presupuestos). Si llega un correo, mira el
resumen de uso y ajusta límites o modelos. Nada se apaga solo: la alerta avisa, no corta.

## Si quieres bajar aún más

- Pon `planificacion` y `compras` en nivel `flash` en `modelos.json` (baja la calidad del plan semanal un
  poco, baja el costo bastante).
- Baja `mensajesPorUsuarioPorDia` a 30.
- Apaga Calidad para el chat (mantén `revisa` solo con `plan-semanal` y `lista-compras`).
