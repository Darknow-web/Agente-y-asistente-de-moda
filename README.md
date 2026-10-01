<p align="center"><img src="src/brand/lockup.svg" alt="SASTRA" width="320"></p>

<p align="center"><em>Tu departamento de moda.</em></p>

SASTRA es una casa de moda convertida en departamento personal de estilo. Conoce tu armario, te viste
cada mañana según tu día y tu clima, cuida tu ropa, planifica tu semana y te acompaña cuando sales a comprar.
Detrás hay un equipo de agentes de IA especializados (Dirección Creativa, Guardarropa, Estilismo,
Planificación, Cuidado, Personal Shopper, Probador y Control de Calidad) que trabajan como una empresa y
hablan con una sola voz.

## Para quien no programa

- **Qué es**: una app web (funciona en el celular como una app) donde chateas con Sastra, subes fotos de tu
  ropa y recibes looks, planes semanales, consejos de cuidado y de compras.
- **Para qué sirve de verdad**: que no compres ropa que nunca te pondrás y que uses la que ya tienes.
  Por eso, además del chat: bienvenida de cinco preguntas, una pregunta al día para conocerte, tres formas
  de ponerte cada prenda, estreno guiado, ropa dormida con su valor, costo por uso, memoria de cómo te queda
  la ropa y tallas por marca, índice de compra antes de pagar, lista de deseos con una semana de espera,
  avisos en el móvil y un diario de lo que el departamento hace solo.
- **Qué cuesta**: la conversación va en Claude Haiku y el resto en Gemini, con tus propias llaves. Unos 2
  dólares al mes por persona activa. Ver [docs/COSTOS.md](docs/COSTOS.md).
- **Cómo se publica**: desde Google AI Studio a Cloud Run. Paso a paso en
  [docs/GUIA-DESPLIEGUE.md](docs/GUIA-DESPLIEGUE.md) y, para la base de datos,
  [docs/VINCULAR-FIRESTORE.md](docs/VINCULAR-FIRESTORE.md).
- **Cómo cambiar el motor** (Gemini, Claude o ambos): [docs/CAMBIAR-EL-MOTOR.md](docs/CAMBIAR-EL-MOTOR.md).
- **Quién es quién en el departamento** y cómo editar su conocimiento:
  [docs/EL-DEPARTAMENTO.md](docs/EL-DEPARTAMENTO.md).
- **Marca y diseño**: [docs/DISEÑO.md](docs/DISEÑO.md) y el manual en
  [docs/marca/SASTRA-manual-de-marca.pdf](docs/marca/SASTRA-manual-de-marca.pdf).

## Para quien programa

```bash
npm install
cp .env.example .env      # completa GEMINI_API_KEY, ADMIN_EMAILS y las VITE_FIREBASE_*
npm run dev               # web en http://localhost:5173, API en :8080
npm test                  # pruebas unitarias (sin red)
npm run smoke             # una llamada real a cada motor con llave, valida modelos y estima costo
npm run build && npm start
```

Sin llaves puedes probar toda la interfaz con `MOTOR_MODO=simulado` en el `.env`.

### Estructura

```
src/            cliente React (Vite + Tailwind)  · src/lib/firebase.ts es la ruta que AI Studio espera
server/src/     API Express
  ai/           motor intercambiable: provider.ts (contrato), gemini.ts, claude.ts, simulado.ts, router.ts
  agents/       el departamento: <agente>/prompt.md + conocimiento.md + index.ts
  config/       modelos.json (qué motor usa cada agente) · empresa.md (propósito) · limites.json
  routes/       chat (SSE), armario (prendas, resumen, formas, ajustes), planes, cuenta (perfil, pregunta
                del día, push, avisos), probador (índice de compra), salud, jobs (tareas programadas)
  tools/        armario (function calling), clima (Open-Meteo), busqueda (web)
  data/         repos (Firestore), resumen-armario (ropa dormida), avisar (aviso + push + diario)
  util/         push (Web Push), env, errores, ids
shared/         tipos y contrato de API compartidos
docs/           guías en español
```

### Decisiones de diseño técnico

- **Un solo despliegue**: cliente y servidor viajan en la misma imagen (Dockerfile) y el mismo puerto.
- **Motor intercambiable**: los agentes solo conocen la interfaz `LLMProvider`. Cambiar Gemini por Claude,
  o mezclarlos, es editar `server/src/config/modelos.json` o una variable `MOTOR_<AGENTE>`.
- **Costo bajo**: modelos ligeros para lo simple, el armario viaja como tabla compacta (nunca fotos salvo que
  hagan falta), historial resumido, límite diario por persona y registro de tokens por llamada.
- **Datos privados**: cada persona solo accede a `users/{uid}`; las llaves de IA nunca llegan al navegador.
- **Autonomía**: `/api/jobs/*` (look del día, plan semanal, recordatorios de lavado) para Cloud Scheduler.

## Licencia

Código y marca propiedad de la casa SASTRA. Las fotografías de las maquetas son de Unsplash (licencia libre).
