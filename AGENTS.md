# Instrucciones para agentes de código (Google AI Studio, Claude Code, otros)

Este repositorio es **SASTRA**, una app full-stack (React + Vite en `src/`, Express en `server/`)
que se despliega en Cloud Run desde Google AI Studio.

## Firebase: dónde va cada cosa

- La configuración pública del cliente vive en **`src/lib/firebase.ts`** y se lee de variables
  `VITE_FIREBASE_*` (archivo `.env`) con respaldo en **`src/lib/firebase-config.json`**, que **sí está
  versionado** (son valores públicos por diseño). Si vas a conectar este proyecto a Firebase Firestore y
  Authentication, **escribe los valores en ese archivo JSON** (claves `apiKey`, `authDomain`, `projectId`,
  `storageBucket`, `messagingSenderId`, `appId`) para que sobrevivan a cualquier sincronización con GitHub;
  no crees otro archivo de inicialización ni lo añadas a `.gitignore`.
- Las reglas de seguridad ya existen y son la fuente de verdad: **`firestore.rules`** y **`storage.rules`**
  en la raíz. No las sobrescribas. Si necesitas cambiarlas, edítalas ahí y explica el cambio.
- El servidor usa `firebase-admin` con las credenciales por defecto de Cloud Run (no requiere archivo de llave).
- Estructura de datos: `users/{uid}/perfil`, `users/{uid}/prendas`, `users/{uid}/usos`, `users/{uid}/planes`,
  `users/{uid}/deseos`, `users/{uid}/conversaciones`, `users/{uid}/avisos`, `users/{uid}/uso`,
  `allowlist/{email}`. Los tipos están en `shared/types.ts`.

## Llaves y secretos

- `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `JOBS_SECRET`, `ADMIN_EMAILS` son variables **del servidor**.
  Nunca las expongas al cliente ni las escribas en el código.
- El cliente solo recibe las `VITE_FIREBASE_*`, que son públicas por diseño.

## Cómo arrancar

```bash
npm install
cp .env.example .env   # completa GEMINI_API_KEY y las VITE_FIREBASE_*
npm run dev            # web en :5173, API en :8080
npm run build && npm start   # producción (sirve dist/ y /api en el mismo puerto)
```

## Reglas de trabajo

- Idioma de interfaz, prompts y documentación: español.
- El diseño sigue `docs/DISEÑO.md` (paleta, tipografías, retícula). No introducir otros colores ni fuentes.
- Los agentes de IA viven en `server/src/agents/<nombre>/` (prompt.md + conocimiento.md + tools.ts + index.ts).
  Qué motor usa cada uno se define en `server/src/config/modelos.json`; no fijar modelos en el código.
- El propósito de la empresa está en `server/src/config/empresa.md` y se inyecta a todos los agentes.
