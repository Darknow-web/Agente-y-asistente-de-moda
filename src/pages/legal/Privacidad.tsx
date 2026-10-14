/** Política de privacidad de SASTRA (Ley 29733; borrador para revisión legal). */
import { PROVEEDOR } from '@/lib/legal';
import { PaginaLegal, Seccion } from './PaginaLegal';

export function Privacidad() {
  return (
    <PaginaLegal titulo="Política de privacidad">
      <Seccion titulo="Responsable">
        <p className="m-0">
          {PROVEEDOR.nombre}, RUC {PROVEEDOR.ruc}, {PROVEEDOR.domicilio}. Contacto para privacidad:{' '}
          <a href={`mailto:${PROVEEDOR.correo}`} className="border-b border-current">
            {PROVEEDOR.correo}
          </a>
          .
        </p>
      </Seccion>
      <Seccion titulo="Qué datos tratamos">
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
          <li>De tu cuenta de Google: nombre, correo y foto.</li>
          <li>Lo que cargas: fotos y datos de tus prendas, tu perfil (ciudad, rutina, tallas, estilo) y tus conversaciones con Sastra.</li>
          <li>Uso del servicio: qué prendas usas, avisos y consumo, para aplicar los límites de tu plan.</li>
          <li>Suscripción: estado, fechas y el correo de tu cuenta de Mercado Pago. No guardamos datos de tarjetas.</li>
        </ul>
      </Seccion>
      <Seccion titulo="Para qué">
        <p className="m-0">
          Solo para prestarte SASTRA: catalogar tu armario, proponerte looks, recordarte el cuidado de tus prendas, cobrar la suscripción y
          atender tus consultas. No vendemos tus datos ni los usamos para publicidad de terceros.
        </p>
      </Seccion>
      <Seccion titulo="Con quién se comparten">
        <p className="m-0">
          Con proveedores que procesan datos por encargo nuestro: Google (Firebase y Gemini, para almacenamiento y análisis con IA), Anthropic
          (Claude, para las conversaciones), Cloudflare (alojamiento) y Mercado Pago (cobros). Algunos están fuera del Perú, por lo que hay
          transferencia internacional de datos con fines de prestación del servicio.
        </p>
      </Seccion>
      <Seccion titulo="Cuánto tiempo">
        <p className="m-0">
          Mientras tengas cuenta. Si pides borrarla, eliminamos tus datos y fotos en un plazo de 30 días, salvo lo que debamos conservar por ley
          (por ejemplo, registros de cobro).
        </p>
      </Seccion>
      <Seccion titulo="Tus derechos">
        <p className="m-0">
          Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos (derechos ARCO) escribiendo a {PROVEEDOR.correo}. Si no
          quedas conforme, puedes acudir a la Autoridad Nacional de Protección de Datos Personales.
        </p>
      </Seccion>
    </PaginaLegal>
  );
}
