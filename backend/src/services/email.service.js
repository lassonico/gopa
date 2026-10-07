const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.smtp.host || !config.smtp.user) {
    console.log('Email: SMTP no configurado (modo log)');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });
  return transporter;
}

async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[Email Log] To: ${to} | Subject: ${subject}`);
    return { success: true, mode: 'log' };
  }
  try {
    const info = await t.sendMail({
      from: `"GoPalermo" <${config.smtp.user}>`,
      to,
      subject,
      html
    });
    console.log(`Email enviado a ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error enviando email:', error.message);
    return { success: false, error: error.message };
  }
}

async function sendPasswordReset(email, resetLink) {
  return sendMail({
    to: email,
    subject: 'Recuperación de contraseña - GoPalermo',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #5E244E; margin: 0;">GoPalermo</h1>
        </div>
        <div style="background: #f9f9f9; border-radius: 12px; padding: 32px;">
          <h2 style="color: #333; margin-top: 0;">Recupera tu contraseña</h2>
          <p style="color: #666; line-height: 1.6;">
            Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
            Haz clic en el botón de abajo para crear una nueva contraseña.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}"
               style="background: #5E244E; color: white; text-decoration: none;
                      padding: 14px 32px; border-radius: 8px; display: inline-block;
                      font-weight: bold;">
              Restablecer contraseña
            </a>
          </div>
          <p style="color: #999; font-size: 13px; line-height: 1.5;">
            Si no solicitaste este cambio, ignora este mensaje.
            El enlace expira en 24 horas.
          </p>
        </div>
        <p style="color: #bbb; font-size: 12px; text-align: center; margin-top: 24px;">
          GoPalermo &copy; ${new Date().getFullYear()}
        </p>
      </div>
    `
  });
}

async function sendWelcome(email, nombre) {
  const logoUrl = `${config.clientUrl || 'http://localhost:5173'}/logoapp.png`;
  return sendMail({
    to: email,
    subject: '¡Bienvenido a GoPalermo!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="${logoUrl}" alt="GoPalermo" style="max-width: 200px; height: auto;" />
        </div>
        <div style="background: #f9f9f9; border-radius: 12px; padding: 32px;">
          <h2 style="color: #333; margin-top: 0;">¡Bienvenido, ${nombre}!</h2>
          <p style="color: #666; line-height: 1.6;">
            Te has registrado exitosamente en GoPalermo.
            Ya puedes explorar comercios, hacer pedidos y disfrutar de
            las mejores promociones desde la comodidad de tu hogar.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${config.clientUrl || 'http://localhost:5173'}/comercios"
               style="background: #5E244E; color: white; text-decoration: none;
                      padding: 14px 32px; border-radius: 8px; display: inline-block;
                      font-weight: bold;">
              Explorar comercios
            </a>
          </div>
        </div>
        <p style="color: #bbb; font-size: 12px; text-align: center; margin-top: 24px;">
          GoPalermo &copy; ${new Date().getFullYear()}
        </p>
      </div>
    `
  });
}

async function sendWelcomeComercio(email, nombre) {
  const logoUrl = `${config.clientUrl || 'http://localhost:5173'}/logoapp.png`;
  const panelUrl = config.comercioUrl || 'http://localhost:5174';
  return sendMail({
    to: email,
    subject: '¡Tu comercio fue aprobado! Bienvenido a GoPalermo',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="${logoUrl}" alt="GoPalermo" style="max-width: 200px; height: auto;" />
        </div>
        <div style="background: #f9f9f9; border-radius: 12px; padding: 32px;">
          <h2 style="color: #333; margin-top: 0;">¡Bienvenido, ${nombre}!</h2>
          <p style="color: #666; line-height: 1.6;">
            ¡Excelente noticia! Tu solicitud de registro fue <strong>aprobada</strong>.
            Ya puedes entrar a tu panel de comercio para administrar tu negocio,
            gestionar tus productos y recibir pedidos.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${panelUrl}"
               style="background: #5E244E; color: white; text-decoration: none;
                      padding: 14px 32px; border-radius: 8px; display: inline-block;
                      font-weight: bold;">
              Ir a mi panel de comercio
            </a>
          </div>
          <p style="color: #999; font-size: 13px; line-height: 1.5;">
            Inicia sesión con el correo y la contraseña que creaste en tu solicitud de registro.
          </p>
        </div>
        <p style="color: #bbb; font-size: 12px; text-align: center; margin-top: 24px;">
          GoPalermo &copy; ${new Date().getFullYear()}
        </p>
      </div>
    `
  });
}

async function sendPromotion(email, { titulo, descripcion, codigo, descuento, vencimiento, link }) {
  return sendMail({
    to: email,
    subject: `🎉 ${titulo} - GoPalermo`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #5E244E; margin: 0;">GoPalermo</h1>
        </div>
        <div style="background: #f9f9f9; border-radius: 12px; padding: 32px;">
          <h2 style="color: #333; margin-top: 0;">${titulo}</h2>
          <p style="color: #666; line-height: 1.6;">${descripcion || 'Aprovecha esta oferta especial'}</p>
          ${codigo ? `
            <div style="background: #FFE8B4; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
              <p style="color: #5E244E; font-size: 12px; margin: 0 0 4px;">Código promocional</p>
              <p style="color: #AA1C41; font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 4px;">${codigo}</p>
            </div>
          ` : ''}
          ${descuento ? `<p style="color: #E68457; font-size: 18px; font-weight: bold; text-align: center;">${descuento}</p>` : ''}
          ${vencimiento ? `<p style="color: #999; font-size: 13px; text-align: center;">Válido hasta: ${new Date(vencimiento).toLocaleDateString('es-CO')}</p>` : ''}
          ${link ? `
            <div style="text-align: center; margin-top: 24px;">
              <a href="${link}"
                 style="background: #5E244E; color: white; text-decoration: none;
                        padding: 14px 32px; border-radius: 8px; display: inline-block;
                        font-weight: bold;">
                Ver oferta
              </a>
            </div>
          ` : ''}
        </div>
        <p style="color: #bbb; font-size: 12px; text-align: center; margin-top: 24px;">
          GoPalermo &copy; ${new Date().getFullYear()}
        </p>
      </div>
    `
  });
}

async function sendAdminNotification(subject, texto) {
  const to = process.env.ADMIN_EMAIL || config.smtp.user;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
      <h2 style="color: #5E244E; margin-top: 0;">GoPalermo</h2>
      <p style="color: #374151; font-size: 14px;">${texto}</p>
      <hr style="border: none; border-top: 1px solid #eee;" />
      <p style="color: #9ca3af; font-size: 12px;">Notificación automática del panel de administración.</p>
    </div>`;
  return sendMail({ to, subject, html });
}

async function sendProblemReport({ nombre, email, problema, userId, rol }) {  const adminEmail = process.env.ADMIN_EMAIL || config.smtp.user;
  return sendMail({
    to: adminEmail,
    subject: `🚨 Reporte de problema - GoPalermo`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #5E244E; margin: 0;">GoPalermo</h1>
          <span style="background: #FEE2E2; color: #991B1B; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">REPORTE DE PROBLEMA</span>
        </div>
        <div style="background: #f9f9f9; border-radius: 12px; padding: 32px;">
          <h2 style="color: #333; margin-top: 0;">Nuevo reporte de usuario</h2>
          
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 12px; color: #666;"><strong>Usuario:</strong> ${nombre} (${email})</p>
            <p style="margin: 0 0 12px; color: #666;"><strong>ID Usuario:</strong> ${userId}</p>
            <p style="margin: 0 0 12px; color: #666;"><strong>Rol:</strong> ${rol}</p>
            <p style="margin: 0 0 12px; color: #666;"><strong>Fecha:</strong> ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
          </div>
          
          <div style="background: #FFF8E1; border-left: 4px solid #FFC107; padding: 16px; border-radius: 4px;">
            <p style="margin: 0 0 8px; color: #333; font-weight: bold;">Descripción del problema:</p>
            <p style="margin: 0; color: #555; white-space: pre-wrap; line-height: 1.6;">${problema}</p>
          </div>
          
          <div style="text-align: center; margin-top: 24px;">
            <a href="${config.clientUrl || 'http://localhost:5173'}/admin/usuarios/${userId}"
               style="background: #5E244E; color: white; text-decoration: none;
                      padding: 14px 32px; border-radius: 8px; display: inline-block;
                      font-weight: bold;">
              Ver usuario en admin
            </a>
          </div>
        </div>
        <p style="color: #bbb; font-size: 12px; text-align: center; margin-top: 24px;">
          GoPalermo &copy; ${new Date().getFullYear()}
        </p>
      </div>
    `
  });
}

async function sendWelcomeDomiciliario(email, nombre, usuario) {
  const logoUrl = `${config.clientUrl || 'http://localhost:5173'}/logoapp.png`;
  const panelUrl = config.domiciliarioUrl || 'http://localhost:5176';
  return sendMail({
    to: email,
    subject: '¡Fuiste aprobado! Bienvenido al equipo GoPalermo 🛵',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="${logoUrl}" alt="GoPalermo" style="max-width: 200px; height: auto;" />
        </div>
        <div style="background: #f9f9f9; border-radius: 12px; padding: 32px;">
          <h2 style="color: #333; margin-top: 0;">¡Bienvenido al equipo, ${nombre}!</h2>
          <p style="color: #666; line-height: 1.6;">
            ¡Excelente noticia! Tu solicitud de domiciliario fue <strong>aprobada</strong>.
            Ya puedes entrar a la app de domiciliarios para recibir y entregar pedidos.
          </p>
          <p style="color: #666; line-height: 1.6;">
            Tu usuario de acceso es: <strong>${usuario}</strong> (usa la contraseña asignada por el administrador).
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${panelUrl}"
               style="background: #5E244E; color: white; text-decoration: none;
                      padding: 14px 32px; border-radius: 8px; display: inline-block;
                      font-weight: bold;">
              Ir a la app de domiciliarios
            </a>
          </div>
        </div>
        <p style="color: #bbb; font-size: 12px; text-align: center; margin-top: 24px;">
          GoPalermo &copy; ${new Date().getFullYear()}
        </p>
      </div>
    `
  });
}

module.exports = { sendMail, sendPasswordReset, sendWelcome, sendWelcomeComercio, sendWelcomeDomiciliario, sendPromotion, sendProblemReport, sendAdminNotification };