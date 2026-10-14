/** Términos y condiciones de SASTRA (borrador para revisión legal). */
import { PROVEEDOR } from '@/lib/legal';
import { PaginaLegal, Seccion } from './PaginaLegal';

export function Terminos() {
  return (
    <PaginaLegal titulo="Términos y condiciones">
      <Seccion titulo="1. Quién presta el servicio">
        <p className="m-0">
          {PROVEEDOR.marca} es un servicio de {PROVEEDOR.nombre}, RUC {PROVEEDOR.ruc}, con domicilio en {PROVEEDOR.domicilio}. Atención:{' '}
          <a href={`mailto:${PROVEEDOR.correo}`} className="border-b border-current">
            {PROVEEDOR.correo}
          </a>
          .
        </p>
      </Seccion>
      <Seccion titulo="2. Qué es SASTRA">
        <p className="m-0">
          Un asistente de moda con inteligencia artificial que organiza tu armario, propone qué ponerte según tu agenda y el clima, cuida tus
          prendas y te ayuda a decidir antes de comprar. Sus sugerencias son orientativas: la IA puede equivocarse en colores, tallas, precios o
          disponibilidad. La decisión de usar o comprar una prenda es siempre tuya.
        </p>
      </Seccion>
      <Seccion titulo="3. Planes y precios">
        <p className="m-0">
          El plan Gratis tiene límites de uso que se muestran en la página Plan. El plan Premium cuesta S/ 19.90 al mes o S/ 179 al año, con IGV
          incluido, y puede empezar con 7 días de prueba gratis una sola vez por persona. Los precios vigentes son los que se muestran en la página
          Plan al momento de suscribirte.
        </p>
      </Seccion>
      <Seccion titulo="4. Cobro y renovación">
        <p className="m-0">
          Los pagos los procesa Mercado Pago; SASTRA no ve ni guarda los datos de tu tarjeta. La suscripción se renueva automáticamente cada mes o
          cada año hasta que la canceles. Si tienes prueba gratis, el primer cobro se hace al terminar la prueba.
        </p>
      </Seccion>
      <Seccion titulo="5. Cancelación y reembolsos">
        <p className="m-0">
          Puedes cancelar cuando quieras desde la página Plan, sin penalidad. Al cancelar no habrá más cobros y conservas Premium hasta el final del
          periodo ya pagado o de tu prueba. No se hacen reembolsos de periodos parciales, salvo lo que disponga la ley. Si crees que hubo un cobro
          indebido, escríbenos o usa el Libro de Reclamaciones.
        </p>
      </Seccion>
      <Seccion titulo="6. Uso aceptable">
        <p className="m-0">
          Usa SASTRA para tu propio armario. No subas contenido ilegal, de terceros sin su permiso, ni intentes vulnerar el servicio o sus límites.
          Podemos suspender cuentas que lo hagan.
        </p>
      </Seccion>
      <Seccion titulo="7. Tu contenido">
        <p className="m-0">
          Las fotos y datos que subes son tuyos. Nos das permiso para procesarlos solo para prestarte el servicio (por ejemplo, recortar el fondo de
          una foto o analizarla con IA). Más detalle en la política de privacidad.
        </p>
      </Seccion>
      <Seccion titulo="8. Cambios">
        <p className="m-0">
          Si cambiamos estos términos o los precios, te avisaremos en la app con al menos 15 días de anticipación. Un cambio de precio no afecta el
          periodo que ya pagaste.
        </p>
      </Seccion>
      <Seccion titulo="9. Ley aplicable">
        <p className="m-0">
          Se rigen por las leyes del Perú, incluido el Código de Protección y Defensa del Consumidor (Ley 29571). Puedes registrar un reclamo en
          nuestro Libro de Reclamaciones o acudir a INDECOPI.
        </p>
      </Seccion>
    </PaginaLegal>
  );
}
