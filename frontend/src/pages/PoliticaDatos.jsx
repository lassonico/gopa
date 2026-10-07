export default function PoliticaDatos() {
  return (
    <div style={{ padding: 24, paddingBottom: 110, maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ color: '#5E244E', fontSize: 22, marginBottom: 16 }}>Política de Privacidad y Tratamiento de Datos Personales</h1>
      <p style={{ color: '#e68457', fontSize: 14, marginBottom: 24 }}>Última actualización: Septiembre 2026</p>

      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
        <h3 style={{ color: '#5E244E', marginTop: 20 }}>1. Responsable del Tratamiento</h3>
        <p>GoPalermo, en adelante "la Plataforma", es responsable del tratamiento de los datos personales de sus usuarios, clientes, comercios y domiciliarios, de conformidad con la Ley 1581 de 2012 y sus decretos reglamentarios en Colombia.</p>

        <h3 style={{ color: '#5E244E', marginTop: 20 }}>2. Datos que Recopilamos</h3>
        <p>Recopilamos la siguiente información personal:</p>
        <ul>
          <li>Nombre completo</li>
          <li>Correo electrónico</li>
          <li>Número de teléfono</li>
          <li>Dirección de domicilio</li>
          <li>Información de pedidos, preferencias y notas de los productos</li>
          <li>Ubicación geográfica aproximada para procesos de entrega y registro</li>
          <li>Información de inicio de sesión (incluyendo datos de Google si usa inicio con Google)</li>
          <li>Token de notificaciones push (Firebase Cloud Messaging)</li>
        </ul>
        <p>Cuando realiza pagos en línea a través de Wompi, los datos de su tarjeta de crédito o débito NO son almacenados por GoPalermo. Wompi procesa y almacena dicha información bajo sus propios estándares de seguridad.</p>

        <h3 style={{ color: '#5E244E', marginTop: 20 }}>3. Finalidad del Tratamiento</h3>
        <p>Los datos personales serán utilizados para:</p>
        <ul>
          <li>Gestionar su registro, autenticación y cuenta en la plataforma</li>
          <li>Procesar, entregar y notificar el estado de sus pedidos</li>
          <li>Enviar notificaciones push y correos relacionados con sus pedidos y promociones</li>
          <li>Mejorar nuestros servicios y experiencia de usuario</li>
          <li>Facilitar la comunicación entre clientes, comercios y domiciliarios</li>
          <li>Cumplir con obligaciones legales, regulatorias y contables</li>
          <li>Prevenir fraudes y garantizar la seguridad de la plataforma</li>
        </ul>

        <h3 style={{ color: '#5E244E', marginTop: 20 }}>4. No Compartimos su Información</h3>
        <p>GoPalermo NO comparte, vende, alquila ni transfiere información personal de sus usuarios a terceros no autorizados. La información es utilizada exclusivamente para los fines descritos en esta política. El intercambio de datos con comercios y domiciliarios ocurre únicamente en el alcance necesario para cumplir su pedido (por ejemplo: nombre, dirección y teléfono de entrega).</p>

        <h3 style={{ color: '#5E244E', marginTop: 20 }}>5. Derechos del Usuario</h3>
        <p>De acuerdo con la Ley 1581 de 2012, usted tiene derecho a:</p>
        <ul>
          <li>Conocer, actualizar y rectificar sus datos personales</li>
          <li>Solicitar la eliminación de su cuenta y datos asociados</li>
          <li>Solicitar prueba de la autorización otorgada</li>
          <li>Revocar la autorización de tratamiento de sus datos</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC)</li>
        </ul>

        <h3 style={{ color: '#5E244E', marginTop: 20 }}>6. Seguridad de la Información</h3>
        <p>Implementamos medidas de seguridad técnicas, administrativas y físicas para proteger su información personal contra acceso no autorizado, pérdida, alteración o divulgación. Su contraseña se almacena de forma cifrada (hash) y las sesiones se protegen mediante tokens seguros.</p>

        <h3 style={{ color: '#5E244E', marginTop: 20 }}>7. Cookies y Tecnologías de Rastreo</h3>
        <p>La plataforma utiliza cookies y almacenamiento local del navegador para:</p>
        <ul>
          <li>Mantener su sesión iniciada de forma segura</li>
          <li>Recordar el contenido de su carrito de compras</li>
          <li>Recordar sus preferencias como usuario</li>
        </ul>
        <p>Verificamos interacciones automatizadas mediante Cloudflare Turnstile para proteger la plataforma del fraude. Usted puede configurar su navegador para rechazar cookies, aunque algunas funciones de la plataforma podrían no funcionar correctamente.</p>

        <h3 style={{ color: '#5E244E', marginTop: 20 }}>8. Servicios de Terceros</h3>
        <p>La plataforma integra servicios de terceros que procesan información bajo sus propias políticas de privacidad:</p>
        <ul>
          <li><strong>Wompi:</strong> procesamiento de pagos en línea (PSE y tarjetas)</li>
          <li><strong>Google:</strong> inicio de sesión con cuenta de Google</li>
          <li><strong>Firebase (Google):</strong> notificaciones push y verificación por SMS</li>
          <li><strong>Cloudflare Turnstile:</strong> verificación anti-bot</li>
        </ul>
        <p>Le recomendamos revisar las políticas de privacidad de estos proveedores antes de utilizar sus servicios.</p>

        <h3 style={{ color: '#5E244E', marginTop: 20 }}>9. Retención de Datos</h3>
        <p>Conservamos su información mientras su cuenta esté activa y durante los plazos legales exigidos para cumplir obligaciones tributarias y contables. Al solicitar la eliminación de su cuenta, eliminaremos o anonimizaremos sus datos personales, excepto aquello que deba conservarse por ley.</p>

        <h3 style={{ color: '#5E244E', marginTop: 20 }}>10. Menores de Edad</h3>
        <p>La plataforma está dirigida a personas mayores de 18 años. No recopilamos intencionalmente información de menores de edad. Los menores solo podrán usar la plataforma con autorización y supervisión de sus padres o representantes legales.</p>

        <h3 style={{ color: '#5E244E', marginTop: 20 }}>11. Modificaciones a esta Política</h3>
        <p>Nos reservamos el derecho de actualizar esta política de privacidad. Los cambios serán publicados en esta página con su fecha de actualización. El uso continuado de la plataforma después de los cambios constituye la aceptación de la política vigente.</p>

        <h3 style={{ color: '#5E244E', marginTop: 20 }}>12. Contacto</h3>
        <p>Para ejercer sus derechos o cualquier consulta sobre esta política, contáctenos a través de los canales oficiales de GoPalermo o escribiéndole al correo: <strong>sionvmx@gmail.com</strong>.</p>
      </div>
    </div>
  );
}