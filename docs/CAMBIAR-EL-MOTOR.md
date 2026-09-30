# Cambiar el motor de IA (Gemini, Claude o ambos)

SASTRA está construida con un **motor intercambiable**: los agentes no saben si hablan con Gemini o con
Claude. Cambiar uno, todos, o mezclarlos, es editar un archivo de texto o una variable. No hay que tocar código.

## El archivo: `server/src/config/modelos.json`

```json
"agentes": {
  "director":      { "proveedor": "gemini", "nivel": "flash" },
  "guardarropa":   { "proveedor": "gemini", "nivel": "flash" },
  "estilismo":     { "proveedor": "gemini", "nivel": "flash" },
  "planificacion": { "proveedor": "gemini", "nivel": "pro", "nivelDiario": "lite" },
  "cuidado":       { "proveedor": "gemini", "nivel": "lite" },
  "compras":       { "proveedor": "gemini", "nivel": "pro", "nivelBusqueda": "flash" },
  "probador":      { "proveedor": "gemini", "nivel": "flash" },
  "calidad":       { "proveedor": "gemini", "nivel": "flash", "encendido": true }
}
```

- `proveedor`: `gemini` o `claude`.
- `nivel`: `lite` (barato y rápido), `flash` (equilibrado), `pro` (máxima calidad, más caro).
- `nivelDiario` (solo Planificación): modelo para el ajuste del día.
- `nivelBusqueda` (solo Compras): modelo para la búsqueda en internet.
- `encendido` (solo Calidad): `true` revisa las respuestas importantes antes de enviarlas.

Los niveles se traducen a modelos reales en la parte de arriba del mismo archivo:

```json
"gemini": { "lite": "gemini-3.1-flash-lite", "flash": "gemini-3.1-flash-lite", "pro": "gemini-3.8-flash" },
"claude": { "lite": "claude-haiku-4-5", "flash": "claude-sonnet-5-5", "pro": "claude-opus-5-5" }
```

Cuando Google o Anthropic publiquen versiones nuevas, se cambia el nombre ahí. `npm run smoke` y la pantalla
**Diagnóstico** avisan si un nombre no existe.

## Ejemplos

**Que Estilismo use Claude y el resto Gemini** (mezcla):

```json
"estilismo": { "proveedor": "claude", "nivel": "flash" }
```

Necesitas la variable `ANTHROPIC_API_KEY` en el servidor (llave de [console.anthropic.com](https://console.anthropic.com)).
Si falta, SASTRA lo detecta y usa Gemini para ese agente avisando en los registros.

**Cambiar sin tocar el archivo** (por ejemplo, para probar): variable de entorno

```
MOTOR_ESTILISMO=claude:claude-sonnet-5-5
MOTOR_CALIDAD=gemini:pro
```

Formato `proveedor:modelo`, donde `modelo` puede ser un nivel (`lite`, `flash`, `pro`) o el nombre exacto.

**Trabajar sin gastar** (desarrollo, demostraciones): `MOTOR_MODO=simulado`. La app responde con textos de
prueba y no llama a ningún motor.

## Qué pasa con fotos y video

Claude analiza fotos pero no video. Si un agente configurado con Claude recibe un video, SASTRA lo manda a
Gemini al mismo nivel automáticamente y lo anota en los registros. La búsqueda en internet funciona con ambos.

## Cómo viene configurado (desde el 30/09/2026)

- **Conversación en Claude Haiku** (`director`, `estilismo`, `cuidado`, `probador`, nivel `lite`): responde
  en 1 o 2 segundos, es estable y maneja bien las herramientas. Cuesta unos $2 a $5 al mes por persona activa.
- **Gemini** para lo que Claude no hace o no hace falta pagar: `guardarropa` (fotos), `planificacion` y
  `compras` (textos largos en segundo plano) y `calidad` (revisión).
- **Dos empresas detrás**: si Gemini se satura, SASTRA cae a Claude al mismo nivel (salvo con video); si
  Claude falla o no hay llave, cae a Gemini. Sin `ANTHROPIC_API_KEY`, todo funciona en Gemini.

Para volver a todo Gemini basta con poner `"proveedor": "gemini"` en esos cuatro agentes. Los costos por
agente se ven en `/api/uso/resumen`.
