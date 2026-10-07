const crypto = require('crypto');

class WompiService {
  constructor() {
    this.env = process.env.WOMPI_ENV || 'sandbox';
    this.privateKey = process.env.WOMPI_PRIVATE_KEY;
    this.publicKey = process.env.WOMPI_PUBLIC_KEY;
    this.integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    this.eventsSecret = process.env.WOMPI_EVENTS_SECRET;
    this.baseUrl = this.env === 'production' 
      ? 'https://production.wompi.co/v1' 
      : 'https://sandbox.wompi.co/v1';
  }

  // Obtener tokens de aceptación del comercio (contrato + datos personales)
  async getAcceptanceTokens() {
    const response = await fetch(`${this.baseUrl}/merchants/${this.publicKey}`, {
      headers: { 'Authorization': `Bearer ${this.publicKey}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error obteniendo tokens de aceptación');
    }
    const merchant = data.data || {};
    return {
      acceptance_token: merchant.presigned_acceptance?.acceptance_token || null,
      accept_personal_auth:
        merchant.presigned_personal_data_auth?.acceptance_token || null,
    };
  }

  // Firma de integridad: SHA-256(reference + amount + currency + integritySecret)
  // Wompi usa un hash SHA-256 plano (createHash), NO HMAC.
  generateIntegritySignature({ reference, amountInCents, currency = 'COP' }) {
    const toSign = `${reference}${amountInCents}${currency}${this.integritySecret}`;
    return crypto.createHash('sha256').update(toSign).digest('hex');
  }

  // Crear transacción (payment_method tokenizado + acceptance + firma)
  async createTransaction({ amountInCents, currency = 'COP', reference, customerEmail, paymentMethodType, token, installments = 1, phoneNumber, redirectUrl, acceptance }) {
    const paymentMethod =
      paymentMethodType === 'CARD'
        ? { type: 'CARD', token, installments }
        : { type: paymentMethodType, phone_number: phoneNumber };

    const payload = {
      amount_in_cents: amountInCents,
      currency,
      reference,
      customer_email: customerEmail,
      payment_method: paymentMethod,
      redirect_url: redirectUrl,
      signature: this.generateIntegritySignature({ reference, amountInCents, currency }),
      ...(acceptance || {}),
    };

    try {
      const response = await fetch(`${this.baseUrl}/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.privateKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.messages?.signature?.[0] ||
          data.error?.message || 'Error creando transacción');
      }

      return data.data;
    } catch (error) {
      console.error('Wompi createTransaction error:', error.message);
      throw error;
    }
  }

  // Obtener estado de transacción
  async getTransactionByReference(reference) {
    try {
      const response = await fetch(`${this.baseUrl}/transactions?reference=${encodeURIComponent(reference)}`, {
        headers: { 'Authorization': `Bearer ${this.privateKey}` },
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Error consultando transacciones por referencia');
      }
      const list = data.data || [];
      return list.length > 0 ? list[0] : null;
    } catch (error) {
      console.error('Wompi getTransactionByReference error:', error.message);
      throw error;
    }
  }

  async getTransaction(transactionId) {
    try {
      const response = await fetch(`${this.baseUrl}/transactions/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${this.privateKey}`,
        },
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Error consultando transacción');
      }

      return data.data;
    } catch (error) {
      console.error('Wompi getTransaction error:', error);
      throw error;
    }
  }

  // Verificar checksum de webhook de eventos (SHA-256 plano)
  // checksum = SHA256(v1 + v2 + ... + timestamp + eventsSecret)
  // según la doc oficial de Wompi (Eventos / Webhooks).
  verifyWebhookSignature(payload, signature) {
    const sig = payload?.signature;
    const props = sig?.properties;
    const timestamp = sig?.timestamp;
    if (!props || !Array.isArray(props) || timestamp == null || !this.eventsSecret) {
      return false;
    }

    const getValue = (obj, path) =>
      path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);

    const values = props.map((path) => {
      const v = getValue(payload.data, path);
      return v == null ? '' : String(v);
    });

    const toSign = values.join('') + timestamp + this.eventsSecret;
    const expectedSignature = crypto.createHash('sha256').update(toSign).digest('hex');

    if (!signature || !expectedSignature ||
        Buffer.byteLength(signature, 'hex') !== Buffer.byteLength(expectedSignature, 'hex')) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature.toLowerCase(), 'hex'),
      Buffer.from(expectedSignature.toLowerCase(), 'hex')
    );
  }

  // Generar link de pago (checkout Wompi)
  generateCheckoutUrl(transactionId) {
    const base = this.env === 'production' 
      ? 'https://checkout.wompi.co' 
      : 'https://sandbox.checkout.wompi.co';
    return `${base}/p/${transactionId}`;
  }

  // Checkout web Wompi (form GET a /p/) con firma de integridad
  generateCheckoutLink({ reference, amountInCents, currency = 'COP', redirectUrl }) {
    const signature = this.generateIntegritySignature({ reference, amountInCents, currency });
    const params = new URLSearchParams({
      'public-key': this.publicKey,
      currency,
      'amount-in-cents': String(amountInCents),
      reference,
      'signature:integrity': signature,
    });
    if (redirectUrl) {
      params.set('redirect-url', redirectUrl);
    }
    return `https://checkout.wompi.co/p/?${params.toString()}`;
  }

  // Crear fuente de pago (tarjeta tokenizada)
  async createPaymentSource({ type, token, customerEmail, acceptanceToken }) {
    const payload = {
      type,
      token,
      customer_email: customerEmail,
      acceptance_token: acceptanceToken,
    };

    try {
      const response = await fetch(`${this.baseUrl}/payment_sources`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.privateKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Error creando fuente de pago');
      }

      return data.data;
    } catch (error) {
      console.error('Wompi createPaymentSource error:', error);
      throw error;
    }
  }

  // Obtener métodos de pago disponibles
  async getPaymentMethods() {
    try {
      const response = await fetch(`${this.baseUrl}/payment_methods`, {
        headers: {
          'Authorization': `Bearer ${this.privateKey}`,
        },
      });

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Wompi getPaymentMethods error:', error);
      throw error;
    }
  }

  // Reembolso
  async createRefund(transactionId, amountInCents) {
    try {
      const response = await fetch(`${this.baseUrl}/transactions/${transactionId}/refunds`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.privateKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount_in_cents: amountInCents }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Error creando reembolso');
      }

      return data.data;
    } catch (error) {
      console.error('Wompi createRefund error:', error);
      throw error;
    }
  }
}

module.exports = new WompiService();