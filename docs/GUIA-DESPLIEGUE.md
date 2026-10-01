# Guía de despliegue (paso a paso, sin tecnicismos)

Esta guía te lleva desde cero hasta tener SASTRA funcionando en internet para tus primeras personas,
con el departamento trabajando solo (look del día, plan semanal, lavado, estrenos, deseos) y avisos en el
móvil. Tiempo estimado: 45 minutos la primera vez.

Hay dos caminos y los dos usan el mismo código:

- **Camino A · Google AI Studio** (el que usamos hasta ahora): importas el repositorio, pulsas Publish y
  AI Studio lo despliega en Cloud Run. Ventaja: todo desde una pantalla. Desventaja: AI Studio no trae los
  cambios nuevos de GitHub por sí solo; cada arreglo se pega como parche o se vuelve a importar.
- **Camino B · Cloud Run directo desde GitHub**: cada cambio que llega a la rama se publica solo en uno o
  dos minutos. Es el camino cuando ya tengas usuarios de verdad.

## Antes de empezar

1. Una cuenta de Google (la misma de AI Studio) con un proyecto de Google Cloud con **facturación activa**
   y saldo cargado para la API de Gemini (es prepago). Hoy: `gen-lang-client-0884703707`.
2. Una llave de Anthropic (console.anthropic.com) con unos dólares de saldo: la conversación va en Claude.
   Sin ella, todo funciona en Gemini.
3. Este repositorio en GitHub, rama `claude/fashion-ai-assistant-agent-bbfduf` (o la que uses).

## Camino A · Google AI Studio

### Paso 1 · Importar

1. Entra en [aistudio.google.com](https://aistudio.google.com) › **Build** › importar desde GitHub › elige
   este repositorio y la rama.
2. AI Studio hace una "migración" automática (ajusta el arranque para su vista previa). Déjala terminar.
   Si pregunta por conflictos, mira la sección **Resolve conflicts** al final.

### Paso 2 · Secrets (variables del servidor)

En la pestaña **Secrets** rellena solo esto; el resto déjalo vacío:

| Variable | Valor |
|---|---|
| `ADMIN_EMAILS` | tu correo de Google (entras siempre y administras invitados) |
| `JOBS_SECRET` | un texto largo y aleatorio; lo usarán las tareas programadas |
| `ANTHROPIC_API_KEY` | tu llave de Anthropic (opcional; sin ella, todo en Gemini) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | para avisos en el móvil; se generan con `npm run push:claves` (ver Paso 6). Opcionales |
| `MOTOR_MODO` | `real` |

La llave de Gemini la pone AI Studio por su cuenta (selector de API key). **No rellenes** las variables
`FIREBASE_*` ni `VITE_FIREBASE_*`: las escribe la vinculación de Firebase en `firebase-applet-config.json`
y, si las rellenas con valores viejos, mandan sobre el archivo.

### Paso 3 · Vincular Firestore y el acceso con Google

**Settings › Integrations › Firebase Firestore & Auth** › "Select existing project" › elige tu proyecto.
La integración escribe `firebase-applet-config.json` en la raíz (versionado a propósito) y la app lo lee.
Luego, en la consola de Firebase: **Authentication › Sign-in method › Google › Habilitar**. Detalles y
problemas frecuentes en [VINCULAR-FIRESTORE.md](VINCULAR-FIRESTORE.md).

Las reglas de seguridad (`firestore.rules`, `storage.rules`) y los índices (`firestore.indexes.json`)
están en el repositorio. Si la integración no los despliega, hazlo una vez con la CLI de Firebase:
`firebase deploy --only firestore:rules,firestore:indexes,storage`.

### Paso 4 · Publicar

1. Pulsa **Publish**. Elige el mismo proyecto de Google Cloud.
2. Copia la dirección que te da (`https://…run.app` o `…ai.studio`).
3. En Firebase › Authentication › Settings › **Authorized domains**, añade ese dominio (y el de la vista
   previa si quieres probar desde AI Studio). Sin esto, "Entrar con Google" da `auth/unauthorized-domain` y la
   app te dice exactamente qué dominio falta.
4. Abre la app, entra con tu Google, pasa la bienvenida de cinco preguntas y ve a **Perfil › Diagnóstico**:
   Firestore, Storage y los motores en verde.

### Paso 5 · Invitar

En **Invitados** (solo lo ves tú): escribe el correo de Google de cada persona. Solo quien esté en la lista
puede usar SASTRA; cada persona tiene su armario privado.

### Paso 6 · Avisos en el móvil (notificaciones)

1. En tu computadora, dentro del repositorio: `npm run push:claves`. Imprime tres líneas
   (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Pégalas en Secrets, con tu correo en
   `VAPID_SUBJECT` (formato `mailto:tu-correo`). Vuelve a publicar.
2. Cada persona activa los avisos desde **Perfil › Avisos en este dispositivo**. En iPhone hace falta
   añadir la app a la pantalla de inicio primero (Compartir › Añadir a pantalla de inicio).
3. Mientras no haya claves, los avisos solo se ven dentro de la app, en **Avisos**.

### Paso 7 · El departamento trabajando solo (tareas programadas)

Para que Sastra proponga el look cada mañana, planifique la semana el domingo, avise qué lavar, empuje los
estrenos pendientes, señale la ropa dormida y vuelva a preguntar por los deseos a la semana:

1. Entra en [console.cloud.google.com/cloudscheduler](https://console.cloud.google.com/cloudscheduler) y
   crea **cuatro** trabajos (método POST, cabecera `x-jobs-secret` con tu `JOBS_SECRET`, zona
   `America/Lima`, cambia la dirección por la tuya):

| Nombre | Frecuencia | URL |
|---|---|---|
| sastra-look-del-dia | `30 6 * * *` | `https://TU-APP/api/jobs/look-del-dia` |
| sastra-diario | `0 8 * * *` | `https://TU-APP/api/jobs/diario` |
| sastra-lavado | `0 19 * * *` | `https://TU-APP/api/jobs/recordatorios-lavado` |
| sastra-plan-semanal | `0 20 * * 0` | `https://TU-APP/api/jobs/plan-semanal` |

2. Lo que el equipo hace solo queda anotado en **Avisos › Diario del departamento**.
3. Mientras no configures esto, la app calcula el look del día cuando alguien la abre, sin costo extra, y
   el resto (estrenos, ropa dormida, pregunta del día) se ve igual en Hoy.

### Cómo aplicar arreglos después

AI Studio no trae los cambios nuevos de GitHub por sí solo. Dos opciones:

- **Parche**: pega en el chat de AI Studio las instrucciones exactas del cambio (así lo hemos hecho).
- **Reimportar**: crea una app nueva desde GitHub, repite Secrets (Paso 2) y la vinculación de Firebase
  (Paso 3). Como `firebase-applet-config.json` ya viaja con el código, la app arranca conectada al mismo
  proyecto; solo hay que volver a elegirlo en Integrations para que AI Studio lo reconozca.

## Camino B · Cloud Run directo desde GitHub

1. [console.cloud.google.com/run](https://console.cloud.google.com/run) › **Crear servicio** ›
   "Implementar continuamente desde un repositorio" › conecta GitHub y elige este repositorio y la rama.
2. Tipo de compilación: **Dockerfile** (está en la raíz). Puerto 8080. **Memoria: 2 GiB** (el recorte de fotos
   carga un modelo de 176 MB y trabaja en memoria; con 1 GiB el servicio se reinicia a mitad de foto).
3. Región: `southamerica-west1` (Santiago) o `us-central1`. Permitir invocaciones no autenticadas: **sí**
   (la app tiene su propio acceso con Google).
4. **Variables y secretos**: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `ADMIN_EMAILS`, `JOBS_SECRET`,
   `MOTOR_MODO=real` y, si quieres avisos, las tres `VAPID_*`. Firebase se lee de
   `firebase-applet-config.json`; si el servicio corre en otro proyecto, añade `FIREBASE_PROJECT_ID`,
   `FIREBASE_STORAGE_BUCKET` y `FIRESTORE_DATABASE_ID`.
5. **Seguridad › Cuenta de servicio**: roles **Cloud Datastore User** y **Storage Object Admin** (IAM).
6. Crear. Cada vez que se suba un cambio a la rama, Cloud Run vuelve a publicar solo. Los Pasos 4 a 7 del
   Camino A aplican igual (dominio autorizado, invitados, notificaciones, tareas programadas).

## Fotos: recorte de fondo y alisado

- **Recorte de fondo y luz nivelada**: gratis y automático. Al guardar una prenda, el servidor quita el fondo con
  un modelo abierto (U2Net, dentro de la imagen de Docker) y centra la prenda sobre el lino en 4:5. Si el modelo
  no detecta la prenda (foto sin márgenes, prenda amontonada), la foto se queda como se subió. El original
  nunca se borra: desde la prenda, "Ver original" lo restaura.
- **Alisado de arrugas**: usa el modelo de imagen de Gemini (`modelos.json › imagen`), unos 4 centavos por foto.
  Solo se aplica cuando Guardarropa marcó la foto como arrugada o cuando el cliente pulsa **Mejorar foto**, y
  hasta `retoquesPorUsuarioPorDia` veces al día (limites.json, 10 por defecto). Después, Guardarropa compara
  original y resultado y descarta el retoque si la prenda cambió.
- **Memoria del servicio**: 2 GiB. En AI Studio el servicio de Cloud Run se crea con la memoria por defecto;
  si las fotos no se recortan y el registro dice "memory limit exceeded", entra en
  [console.cloud.google.com/run](https://console.cloud.google.com/run) › el servicio › **Editar e implementar
  nueva revisión** › Memoria **2 GiB** › Implementar.
- **Modelo ausente**: el Dockerfile lo descarga al construir (`server/scripts/descargar-modelo.mjs`). Si la
  construcción no tuvo red, el registro dice "no está el modelo de recorte" y las fotos se guardan sin recortar;
  basta volver a publicar.

## Si algo falla

- **"Falta configurar la llave del motor"**: revisa la llave de Gemini (en AI Studio, el selector de API
  key; en Cloud Run, `GEMINI_API_KEY`).
- **"El motor de IA tiene mucha demanda"**: Google saturado. La app reintenta, cambia de modelo y cae a
  Claude si hay llave. Si pasa seguido, revisa `server/src/config/modelos.json` (ver CAMBIAR-EL-MOTOR.md).
- **"Tu correo aún no está en la lista de invitados"**: pon tu correo en `ADMIN_EMAILS` o pide que te
  agreguen en Invitados.
- **Firestore "sin-configurar" o "error"**: sigue VINCULAR-FIRESTORE.md, sección 5.
- **Las fotos no se recortan**: revisa la memoria del servicio (2 GiB) y que el registro diga "modelo de recorte
  cargado" al arrancar. Ver la sección *Fotos* más arriba.
- **"Firebase no reconoce esta dirección"**: añade el dominio que indica el aviso en Authorized domains.
- **La conversación no aparece al volver** o **una prenda no se guarda**: Diagnóstico › Firestore debe
  estar en "ok"; si está en "error", la cuenta de servicio no tiene permisos (Camino B, punto 5).
- **Los avisos del móvil no llegan**: faltan las claves VAPID en Secrets, o la persona no los activó en
  Perfil, o el navegador los bloqueó (en Perfil aparece "Bloqueados en el navegador").
- **Se agotó el límite de mensajes**: son 60 por persona al día; se cambia en
  `server/src/config/limites.json`.
- **AI Studio muestra "Resolve conflicts"**: su copia y la de GitHub difieren. Si solo aparecen archivos
  generados o de documentación, **Accept**. Si aparecen `firebase-applet-config.json`, `package-lock.json`,
  `firestore.rules`, `storage.rules` o algo de `src/` o `server/` que no cambiaste tú, **Cancel** y revisa:
  el repositorio es la fuente de verdad.
- **Al refrescar AI Studio te vuelve a pedir vincular Firestore**: VINCULAR-FIRESTORE.md, sección 6.
