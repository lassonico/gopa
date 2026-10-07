const config = require('../../config');
const repository = require('../../repositories');
const { generateId } = require('../../utils/helpers');
const wompi = require('../../services/wompi.service');

const SHEET = 'Pagos';
const PEDIDOS = 'Pedidos';

exports.getAll = async (req, res, next) => {
  try {
    const pagos = await repository.findAll(SHEET);
    res.json(pagos);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const pago = await repository.findById(SHEET, req.params.id);
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });
    res.json(pago);
  } catch (error) {
    next(error);
  }
};

exports.crearTransaccion = async (req, res, next) => {
  try {
    const { pedidoId, metodo = 'CARD', token, cuotas = 1, telefono, redirectUrl } = req.body;
    if (!pedidoId) {
      return res.status(400).json({ error: 'pedidoId requerido' });
    }
    if (metodo === 'CARD' && !token) {
      return res.status(400).json({ error: 'Se requiere el token de la tarjeta para pagar' });
    }

    // Verificar que el pedido existe y pertenece al usuario
    const pedidos = await repository.findAll(PEDIDOS);
    const pedido = pedidos.find(p => p.id === pedidoId);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    if (pedido.clienteId !== req.user.id && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const referencia = generateId().slice(0, 8).toUpperCase();
    // El monto SIEMPRE sale del pedido en BD, nunca del cliente
    const monto = parseFloat(pedido.total || 0);
    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'El pedido no tiene un total válido' });
    }
    const amountInCents = Math.round(monto * 100); // Wompi usa centavos

    // Tokens de aceptación y firma de integridad
    const acceptance = await wompi.getAcceptanceTokens();

    const transaction = await wompi.createTransaction({
      amountInCents,
      currency: 'COP',
      reference: referencia,
      customerEmail: req.user.email,
      paymentMethodType: metodo,
      token,
      phoneNumber: telefono,
      installments: cuotas,
      redirectUrl: redirectUrl || `${config.clientUrl}/pago-exitoso?ref=${referencia}`,
      acceptance,
    });

    const pago = {
      id: generateId(),
      pedidoId,
      valor: monto,
      clienteId: req.user.id,
      estado: 'pendiente',
      referencia,
      metodo: 'wompi',
      wompiTransactionId: transaction.id,
      fechaCreacion: new Date().toISOString()
    };
    await repository.create(SHEET, pago);

    const checkoutUrl = wompi.generateCheckoutUrl(transaction.id);

    res.json({ 
      checkoutUrl, 
      referencia: pago.referencia, 
      id: pago.id,
      wompiId: transaction.id
    });
  } catch (error) {
    next(error);
  }
};

exports.consultarTransaccion = async (req, res, next) => {
  try {
    const { referencia } = req.params;
    const txParam = req.query.tx;
    const pagos = await repository.findAll(SHEET);
    const pago = pagos.find(p => p.referencia === referencia);

    if (!pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    if (pago.clienteId !== req.user.id && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Resolver ID de transacción: query param > guardado > búsqueda por referencia en Wompi
    let txId = (typeof txParam === 'string' && txParam.startsWith('transaccion_')) ? txParam : pago.wompiTransactionId;
    if (!txId) {
      try {
        const encontrada = await wompi.getTransactionByReference(referencia);
        if (encontrada?.id) {
          txId = encontrada.id;
          await repository.update(SHEET, pago.id, { wompiTransactionId: txId });
        }
      } catch (e) { console.warn('[Pagos] búsqueda por referencia falló:', e.message); }
    }

    // Consultar estado en Wompi si hay ID de transacción
    if (txId) {
      const wompiTransaction = await wompi.getTransaction(txId);

      // Actualizar estado local si cambió
      const estadoMap = {
        'APPROVED': 'completado',
        'DECLINED': 'fallido',
        'VOIDED': 'anulado',
        'PENDING': 'pendiente'
      };

      const nuevoEstado = estadoMap[wompiTransaction.status] || pago.estado;
      if (nuevoEstado !== pago.estado || !pago.wompiTransactionId) {
        await repository.update(SHEET, pago.id, {
          estado: nuevoEstado,
          wompiStatus: wompiTransaction.status,
          wompiTransactionId: txId,
          fechaPago: nuevoEstado === 'completado' ? new Date().toISOString() : undefined
        });

        if (nuevoEstado === 'completado') {
          await repository.update(PEDIDOS, pago.pedidoId, {
            pagoEstado: 'completado',
            estado: 'confirmado'
          });
        }

        pago.estado = nuevoEstado;
      }
    }

    res.json(pago);
  } catch (error) {
    next(error);
  }
};

exports.webhook = async (req, res, next) => {
  try {
    // Verificar checksum del webhook de eventos
    const signature = req.headers['x-event-checksum'] || req.body?.signature?.checksum;
    if (!wompi.verifyWebhookSignature(req.body, signature)) {
      return res.status(400).json({ error: 'Firma inválida' });
    }

    const { data } = req.body;
    const transaction = data?.transaction || data || {};
    const { id: transactionId, status, reference } = transaction;

    const pagos = await repository.findAll(SHEET);
    const pago = pagos.find(p => p.referencia === reference || p.wompiTransactionId === transactionId);
    
    if (!pago) {
      console.warn('Webhook Wompi: pago no encontrado', { reference, transactionId });
      return res.json({ message: 'Pago no encontrado localmente' });
    }

    const estadoMap = {
      'APPROVED': 'completado',
      'DECLINED': 'fallido',
      'VOIDED': 'anulado',
      'PENDING': 'pendiente'
    };

    const nuevoEstado = estadoMap[status] || 'pendiente';
    
    await repository.update(SHEET, pago.id, {
      estado: nuevoEstado,
      wompiStatus: status,
      wompiTransactionId: transactionId || pago.wompiTransactionId,
      fechaPago: nuevoEstado === 'completado' ? new Date().toISOString() : undefined
    });

    if (nuevoEstado === 'completado') {
      await repository.update(PEDIDOS, pago.pedidoId, { 
        pagoEstado: 'completado',
        estado: 'confirmado'
      });
    }

    res.json({ message: 'Webhook procesado', estado: nuevoEstado });
  } catch (error) {
    next(error);
  }
};

// Mantener compatibilidad con método anterior
exports.generarEnlace = async (req, res, next) => {
  try {
    const { pedidoId } = req.body;
    if (!pedidoId) {
      return res.status(400).json({ error: 'pedidoId requerido' });
    }
    const pedido = await repository.findById(PEDIDOS, pedidoId);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (pedido.clienteId !== req.user.id && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    // El valor SIEMPRE sale del pedido en BD
    const valor = parseFloat(pedido.total || 0);
    if (!valor || valor <= 0) {
      return res.status(400).json({ error: 'El pedido no tiene un total válido' });
    }
    const referencia = generateId().slice(0, 8).toUpperCase();
    const amountInCents = Math.round(valor * 100);
    // Wompi rechaza redirect-url con localhost/http en dev; solo se envía con HTTPS real (prod).
    const clientUrl = config.clientUrl;
    const esHttpsReal = /^https:\/\//.test(clientUrl) && !clientUrl.includes('localhost');
    const redirectUrl = esHttpsReal ? `${clientUrl}/pago-exitoso?ref=${referencia}` : undefined;
    const enlace = wompi.generateCheckoutLink({
      reference: referencia,
      amountInCents,
      currency: 'COP',
      redirectUrl,
    });

    const pago = {
      id: generateId(),
      pedidoId,
      valor,
      clienteId: req.user.id,
      estado: 'pendiente',
      referencia,
      metodo: 'enlace',
      fechaCreacion: new Date().toISOString()
    };
    await repository.create(SHEET, pago);
    res.json({ enlace, referencia: pago.referencia, id: pago.id });
  } catch (error) {
    next(error);
  }
};
