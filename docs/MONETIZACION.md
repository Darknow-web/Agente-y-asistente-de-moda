# Monetización de SASTRA

## El modelo

**Freemium + suscripción.** Cualquiera entra con Google en plan **Gratis**, con límites que dejan probar el
valor de verdad. **Premium** quita los límites. Se cobra con **Mercado Pago** (tarjeta o Yape, en soles).

| | Gratis | Premium |
|---|---|---|
| Conversar con Sastra | 10 mensajes al día | 60 al día |
| Prendas en el armario | 30 | sin límite |
| Look del día, recorte de fondo, avisos, diario | sí | sí |
| Plan de la semana | una vez por semana, sin rehacer | automático cada domingo y rehacer cuando quieras |
| Mejorar fotos con IA (alisar arrugas) | no | 10 al día |
| Probador antes de comprar | 3 al mes | sin límite |
| Compras con precios reales | 3 consultas al mes | sin límite |

Precio: **S/ 19.90 al mes** o **S/ 179 al año** (25 % menos), con **7 días de prueba** gratis una sola vez.

## Dónde se cambia cada cosa

- **Precios, prueba y límites**: `server/src/config/planes.json`. Se cambia el número y se publica; no hay que
  tocar código. `null` significa sin límite. Los suscriptores existentes conservan el precio con el que entraron
  (Mercado Pago guarda el monto de cada suscripción).
- **Acceso abierto o por invitación**: `accesoAbierto` en el mismo archivo. Con `false` vuelve el modo por
  invitación (solo administradores y cortesías).
- **Cortesías** (Premium sin pagar para equipo, familia o testers): Perfil › Cortesías (solo administración).
- **Textos legales y datos del titular**: `src/lib/legal.ts` y `src/pages/legal/`.

## Cómo funciona por dentro

1. `requiereSesion` (servidor) calcula el plan en cada petición: administrador o cortesía = Premium; si no, la
   suscripción guardada en `users/{uid}/suscripcion/actual`.
2. Cada acción con costo comprueba su cupo **antes** de llamar a la IA. Si no alcanza, responde 402 con
   `codigo: 'requiere-premium'` y la app muestra una franja con "Ver Premium".
3. **Pagar**: la página Plan pide a `/api/suscripcion/checkout` el enlace de Mercado Pago. La persona autoriza el
   cobro allí y vuelve a `/plan`, que confirma el estado consultando a Mercado Pago.
4. **Webhook** `/api/pagos/mercadopago/webhook`: valida la firma `x-signature`, vuelve a leer la suscripción en
   Mercado Pago (nunca confía en el cuerpo) y actualiza el estado: prueba, activa, pausada o cancelada.
5. **Cancelar**: desde la página Plan. No hay más cobros y Premium sigue hasta el final de lo pagado.
6. **Seguridad**: el cliente no puede escribir en Firestore (`firestore.rules`), así que nadie puede darse Premium
   ni resetear sus contadores; todo pasa por el servidor.

## Libro de Reclamaciones

`/libro-de-reclamaciones` es público (exigido por INDECOPI a quien vende a consumidores). Los registros se guardan
en la colección `reclamaciones` y se listan en `/api/reclamaciones` (solo administración). Hay que responder en un
plazo máximo de 15 días hábiles al correo de la persona.

## Antes de cobrar de verdad

1. Completar nombre, RUC y domicilio en `src/lib/legal.ts` y revisar Términos y Privacidad con un abogado.
2. Probar el flujo completo con las credenciales y usuarios de prueba de Mercado Pago.
3. Cambiar a credenciales de producción (ver docs/GUIA-DESPLIEGUE.md › Cobros con Mercado Pago).
