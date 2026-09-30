# Vincular Firestore y Authentication en Google AI Studio

SASTRA guarda los datos de cada persona (armario, perfil, planes, conversaciones) en **Cloud Firestore** y
las fotos en **Firebase Storage**. El acceso es con **Google (Firebase Authentication)**. Todo eso vive en
un proyecto de Firebase que tiene que quedar **vinculado** a la app en AI Studio.

A veces la vinculación no se activa sola. Esta guía te deja el mensaje exacto para que el agente de AI Studio
lo haga, y cómo comprobar que quedó bien.

## 1. El mensaje que pegas en AI Studio

Copia y pega esto en el chat del agente de AI Studio (cambia `<ID DEL PROYECTO>` por el tuyo si ya tienes uno;
si no, borra esa parte y deja que cree uno nuevo):

```
Conecta esta app a Firebase Firestore y Authentication usando el proyecto existente <ID DEL PROYECTO>.
La configuración va en src/lib/firebase.ts (variables VITE_FIREBASE_*).
No modifiques firestore.rules ni storage.rules; ya existen en la raíz.
```

Si prefieres hacerlo desde el menú: **Settings › Integrations › Firebase Firestore & Auth**, elige
"Select existing project" (o crea uno), escoge la región (no se puede cambiar después) y acepta.

## 2. Qué debe quedar rellenado

La integración escribe la configuración pública del cliente. Comprueba que existan estas variables
(en el `.env` de AI Studio o en el archivo `src/lib/firebase-config.json`):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Y para el servidor:

```
FIREBASE_PROJECT_ID          (el mismo ID del proyecto)
FIREBASE_STORAGE_BUCKET      (normalmente <ID>.firebasestorage.app)
```

Estas variables son públicas por diseño (las llaves de Firebase del cliente no son secretas). Lo que sí es
secreto es `GEMINI_API_KEY`, que solo va en el servidor.

## 3. Activar Google como método de acceso

En la consola de Firebase: **Authentication › Sign-in method › Google › Habilitar**. Sin esto, el botón
"Entrar con Google" da error.

Después, en **Authentication › Settings › Authorized domains**, añade el dominio donde vive la app
(el `*.run.app` de Cloud Run o el `*.ai.studio`).

## 4. Reglas de seguridad

Las reglas ya están en el repositorio y son la fuente de verdad:

- `firestore.rules`: cada persona solo ve sus datos (`users/{su uid}`); la lista de invitados solo la
  modifica el servidor.
- `storage.rules`: fotos privadas por persona; solo el servidor escribe.

Si el agente de AI Studio las sobreescribe, vuelve a pegarlas desde el repositorio o despliégalas con
`firebase deploy --only firestore:rules,storage`.

## 5. Comprobar que todo quedó bien

Abre la app y entra en **Perfil › Diagnóstico de la app** (o visita `/api/salud`). Debe decir:

- Firestore: ok
- Storage: ok
- Gemini: ok

Si Firestore aparece como "sin-configurar", falta el ID del proyecto. Si aparece "error", el proyecto existe
pero el servidor no tiene permiso: en Cloud Run, la cuenta de servicio del servicio necesita los roles
**Cloud Datastore User** y **Storage Object Admin** (IAM › cuenta de servicio del servicio de Cloud Run).

## 6. Si al refrescar AI Studio te vuelve a pedir vincular Firestore

Pasa cuando la configuración que escribió la integración vive solo en archivos que **no están en GitHub**
(`.env`). Cada vez que AI Studio vuelve a sincronizar el proyecto con el repositorio, lo que no está en
GitHub desaparece y la app deja de ver la configuración.

La solución es que la configuración pública viaje con el código:

1. Abre en AI Studio (pestaña Code) el archivo `.env` o `src/lib/firebase-config.json` y copia los seis
   valores `VITE_FIREBASE_*` (o cópialos de la consola de Firebase › Configuración del proyecto › Tus apps).
2. Escríbelos en **`src/lib/firebase-config.json`** del repositorio con este formato y súbelo a GitHub:

```json
{
  "apiKey": "…",
  "authDomain": "<ID>.firebaseapp.com",
  "projectId": "<ID>",
  "storageBucket": "<ID>.firebasestorage.app",
  "messagingSenderId": "…",
  "appId": "…"
}
```

3. En la pestaña **Secrets** de AI Studio deja también `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET` y
   `FIRESTORE_DATABASE_ID` (el nombre de la base que creó la integración): son del servidor y no dependen
   de archivos.

Estos valores son públicos por diseño; lo que nunca va al repositorio es `GEMINI_API_KEY`.

## 7. Primer acceso

La app solo deja entrar a los correos de la lista de invitados. Tu propio correo va en la variable
`ADMIN_EMAILS` del servidor: con eso entras siempre y puedes agregar a los demás desde **Invitados**.
