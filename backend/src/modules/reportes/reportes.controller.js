const { sendProblemReport } = require('../../services/email.service');
const config = require('../../config');

exports.reportProblem = async (req, res, next) => {
  try {
    const { nombre, email, problema } = req.body;
    
    if (!nombre || !email || !problema) {
      return res.status(400).json({ error: 'Nombre, email y descripción del problema son requeridos' });
    }
    
    if (problema.length < 10) {
      return res.status(400).json({ error: 'La descripción del problema debe tener al menos 10 caracteres' });
    }
    
    // Usar datos del usuario autenticado si están disponibles
    const userData = {
      nombre: nombre || req.user?.nombre || 'Usuario anónimo',
      email: email || req.user?.email || 'no-email@provided.com',
      userId: req.user?.id || 'anónimo',
      rol: req.user?.rol || 'cliente'
    };
    
    // Enviar email al admin
    await sendProblemReport({
      nombre: userData.nombre,
      email: userData.email,
      problema,
      userId: userData.userId,
      rol: userData.rol
    });
    
    res.json({ 
      success: true, 
      message: 'Reporte enviado exitosamente. Gracias por tu reporte.'
    });
  } catch (error) {
    console.error('Error en reporte de problema:', error);
    res.status(500).json({ error: 'Error enviando reporte. Intenta nuevamente.' });
  }
};