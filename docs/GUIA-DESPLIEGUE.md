# Guía de despliegue (paso a paso, sin tecnicismos)

Esta guía te lleva desde cero hasta tener SASTRA funcionando en internet para tus primeras 3 o 4 personas.
Tiempo estimado: 45 minutos la primera vez.

## Antes de empezar: qué vas a necesitar

1. Una cuenta de Google (la misma de AI Studio).
2. Una tarjeta para activar facturación en Google Cloud. **No se cobra nada si te mantienes en el nivel
   gratuito de Cloud Run y en el uso previsto de Gemini** (2 a 7 dólares al mes con 4 personas activas).
3. Este repositorio en GitHub.

## Paso 1 · Crear la llave de Gemini (tu motor de IA)

1. Entra en [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Pulsa **Create API key** y elige (o crea) un proyecto de Google Cloud. Anota el **ID del proyecto**.
3. Copia la llave. Empieza por `AIza…`. Guárdala en un lugar seguro: es la variable `GEMINI_API_KEY`.
4. Activa facturación en ese proyecto: [console.cloud.google.com/billing](https://console.cloud.google.com/billing)
   › vincular cuenta de facturación al proyecto. Con esto tus datos dejan de usarse para entrenar modelos y
   desaparecen los topes diarios del nivel gratuito.
5. Crea una **alerta de presupuesto**: Facturación › Presupuestos y alertas › Crear presupuesto › 10 USD al
   mes › avisos al 50 %, 90 % y 100 %. Te llegará un correo si algo se dispara.

## Paso 2 · Abrir el proyecto en Google AI Studio

1. Entra en [aistudio.google.com](https://aistudio.google.com) › **Build**.
2. Importa este repositorio desde GitHub (si tu versión de AI Studio no muestra la opción de importar, salta al
   **Camino B** más abajo).
3. En **Settings › Environment variables** añade:
   - `GEMINI_API_KEY` = tu llave.
   - `ADMIN_EMAILS` = tu correo de Google (para entrar siempre y administrar invitados).
   - `JOBS_SECRET` = un texto largo y aleatorio (por ejemplo, 40 letras y números). Sirve para las tareas
     automáticas.
   - `MOTOR_MODO` = `real`.

## Paso 3 · Vincular Firestore y el acceso con Google

Sigue [VINCULAR-FIRESTORE.md](VINCULAR-FIRESTORE.md). En resumen: pega el mensaje al agente de AI Studio (o
usa Settings › Integrations › Firebase), activa **Google** como método de acceso en la consola de Firebase y
comprueba en **Diagnóstico** que Firestore y Storage estén en "ok".

## Paso 4 · Publicar

1. En AI Studio pulsa **Deploy**. Elige el mismo proyecto de Google Cloud del paso 1.
2. Espera a que termine: te dará una dirección tipo `https://sastra-xxxx.run.app` (o una `*.ai.studio`).
3. Añade esa dirección en la consola de Firebase › Authentication › Settings › **Authorized domains**.
4. Abre la dirección, entra con tu Google y ve a **Perfil › Diagnóstico**. Todo en verde.

## Paso 5 · Invitar a tus primeras personas

En la app, **Invitados** (solo lo ves tú como administrador): escribe el correo de Google de cada persona y
listo. Solo quien esté en la lista puede usar SASTRA. Cada persona tiene su armario privado.

## Paso 6 · Activar la autonomía (avisos automáticos)

Para que Sastra proponga el look cada mañana, planifique la semana el domingo y avise cuándo lavar:

1. Entra en [console.cloud.google.com/cloudscheduler](https://console.cloud.google.com/cloudscheduler) y
   pulsa **Crear trabajo** tres veces con estos datos (cambia la dirección por la tuya y el secreto por tu
   `JOBS_SECRET`):

| Nombre | Frecuencia | Zona horaria | URL (método POST) | Cabecera |
|---|---|---|---|---|
| sastra-look-del-dia | `30 6 * * *` | America/Lima | `https://TU-APP.run.app/api/jobs/look-del-dia` | `x-jobs-secret: TU_SECRETO` |
| sastra-plan-semanal | `0 20 * * 0` | America/Lima | `https://TU-APP.run.app/api/jobs/plan-semanal` | `x-jobs-secret: TU_SECRETO` |
| sastra-lavado | `0 19 * * *` | America/Lima | `https://TU-APP.run.app/api/jobs/recordatorios-lavado` | `x-jobs-secret: TU_SECRETO` |

2. Los avisos aparecen en la app, en **Avisos**. Mientras no configures esto, la app calcula el look del día
   cuando alguien la abre, sin costo extra.

## Camino B · Publicar directo en Cloud Run desde GitHub

Si AI Studio no deja importar el repositorio:

1. [console.cloud.google.com/run](https://console.cloud.google.com/run) › **Crear servicio** ›
   "Implementar continuamente desde un repositorio" › conecta GitHub y elige este repositorio y la rama.
2. Tipo de compilación: **Dockerfile** (está en la raíz).
3. Región: `southamerica-west1` (Santiago) o `us-central1`. Permitir invocaciones no autenticadas: **sí**
   (la app tiene su propio acceso con Google).
4. En **Variables y secretos** añade las mismas del Paso 2 más `FIREBASE_PROJECT_ID` y
   `FIREBASE_STORAGE_BUCKET`, y las `VITE_FIREBASE_*` (ver VINCULAR-FIRESTORE.md).
5. En **Seguridad › Cuenta de servicio**, dale a la cuenta los roles **Cloud Datastore User** y
   **Storage Object Admin** (IAM).
6. Crear. Cada vez que se suba un cambio a la rama, Cloud Run vuelve a publicar solo.

## Si algo falla

- **"Falta configurar la llave del motor"**: revisa `GEMINI_API_KEY` en las variables del servicio.
- **"Tu correo aún no está en la lista de invitados"**: pon tu correo en `ADMIN_EMAILS` o pide que te
  agreguen en Invitados.
- **Firestore "sin-configurar" o "error"**: sigue VINCULAR-FIRESTORE.md, sección 5.
- **El botón de Google no abre o da error de dominio**: añade el dominio de la app en Authorized domains.
- **Se agotó el límite de mensajes**: son 60 por persona al día; se cambia en
  `server/src/config/limites.json`.
