/**
 * Genera el par de claves VAPID para las notificaciones push: `npm run push:claves`.
 * Copia las dos líneas a las variables del servidor (pestaña Secrets en AI Studio o Cloud Run).
 */
import webpush from 'web-push';

const claves = webpush.generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY=' + claves.publicKey);
console.log('VAPID_PRIVATE_KEY=' + claves.privateKey);
console.log('VAPID_SUBJECT=mailto:tu-correo@ejemplo.com');
