# Vincular Firestore y Authentication en Google AI Studio

SASTRA guarda los datos de cada persona (armario, perfil, planes, conversaciones) en **Cloud Firestore** y
las fotos en **Firebase Storage**. El acceso es con **Google (Firebase Authentication)**. Todo eso vive en
un proyecto de Firebase que tiene que quedar **vinculado** a la app en AI Studio.

A veces la vinculación no se activa sola. Esta guía te deja el mensaje exacto para que el agente de AI Studio
lo haga, y cómo comprobar que quedó bien.

## 1. El mensaje que pegas en AI Studio

Lo más seguro es hacerlo desde el menú: **Settings › Integrations › Firebase Firestore & Auth** ›
"Select existing project" › elige el proyecto y, si pregunta por la base de datos, la existente (no una nueva).
La región no se puede cambiar después.

Si prefieres el chat del agente, pega esto (cambia los dos identificadores por los tuyos; los de SASTRA
están en `firebase-applet-config.json`, campos `projectId` y `firestoreDatabaseId`):

```
Conecta esta app a Firebase Firestore y Authentication usando el proyecto existente <ID DEL PROYECTO>
y la base de datos Firestore existente <ID DE LA BASE DE DATOS>; no crees un proyecto ni una base nueva.
Escribe o actualiza únicamente firebase-applet-config.json en la raíz (projectId, appId, apiKey, authDomain,
storageBucket, messagingSenderId, firestoreDatabaseId). Ese archivo ya existe y está versionado a propósito.
No crees otro archivo de inicialización, no lo añadas a .gitignore, no cambies src/lib/firebase.ts,
no rellenes variables VITE_FIREBASE_* ni FIREBASE_* en Secrets, y no modifiques firestore.rules,
storage.rules ni firestore.indexes.json: ya existen en la raíz y son la fuente de verdad.
```

## 2. Qué debe quedar rellenado

La integración escribe la configuración pública en **`firebase-applet-config.json`** (raíz del repositorio).
Comprueba que tenga estos campos:

```
projectId, appId, apiKey, authDomain, storageBucket, messagingSenderId, firestoreDatabaseId
```

El cliente y el servidor leen ese archivo. Las variables `VITE_FIREBASE_*` y `FIREBASE_*` de Secrets deben
quedar **vacías**: si se rellenan, mandan sobre el archivo y pueden apuntar a una base equivocada.
Estos valores son públicos por diseño (las llaves de Firebase del cliente no son secretas). Lo que sí es
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

La solución ya está aplicada: la integración de AI Studio escribe **`firebase-applet-config.json`** en la
raíz del proyecto, ese archivo **está versionado en GitHub** y tanto el cliente como el servidor lo leen
como respaldo (proyecto, llaves públicas, bucket y nombre de la base de datos). Comprueba que exista en el
repositorio con contenido parecido a este:

```json
{
  "projectId": "<ID>",
  "appId": "1:…:web:…",
  "apiKey": "AIza…",
  "authDomain": "<ID>.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-…",
  "storageBucket": "<ID>.firebasestorage.app",
  "messagingSenderId": "…"
}
```

Si al sincronizar aparece un "Resolve conflicts" que quiere **borrar** ese archivo, pulsa Cancel.

Para **volver a vincular desde cero** (otro proyecto u otra app de AI Studio): borra ese archivo del
repositorio, vacía en la pestaña Secrets las variables `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`,
`FIRESTORE_DATABASE_ID` y todas las `VITE_FIREBASE_*` (si quedan con valores viejos, mandan sobre el archivo
nuevo), y vuelve a usar Settings › Integrations › Firebase. La integración escribe el archivo otra vez.
Estos valores son públicos por diseño; lo que nunca va al repositorio es `GEMINI_API_KEY`.

## 7. Primer acceso

La app solo deja entrar a los correos de la lista de invitados. Tu propio correo va en la variable
`ADMIN_EMAILS` del servidor: con eso entras siempre y puedes agregar a los demás desde **Invitados**.
