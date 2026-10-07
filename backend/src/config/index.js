const isProduction = process.env.NODE_ENV === 'production';

const requiredEnvVars = [
  'JWT_SECRET',
  'DB_PASSWORD',
  'CORS_ORIGIN'
];

if (isProduction) {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Variable de entorno requerida en producción: ${envVar}`);
    }
  }
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  comercioUrl: process.env.COMERCIO_URL || 'http://localhost:5174',
  domiciliarioUrl: process.env.DOMICILIARIO_URL || 'http://localhost:5176',
  nodeEnv: process.env.NODE_ENV || 'development',
  turnstile: {
    secretKey: process.env.TURNSTILE_SECRET_KEY || '',
    siteKey: process.env.TURNSTILE_SITE_KEY || '',
    allowedHostnames: new Set(
      (process.env.TURNSTILE_HOSTNAMES || 'localhost')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean)
    ),
    excludedOrigins: new Set(
      (process.env.TURNSTILE_EXCLUDED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim().toLowerCase())
        .filter(Boolean)
    )
  },
  jwt: {
    secret: process.env.JWT_SECRET || (isProduction ? undefined : 'dev_secret_change_me_min_32_chars_!!'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  google: {
    oauthClientId: process.env.GOOGLE_CLIENT_ID
  },
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || (isProduction ? undefined : ''),
    database: process.env.DB_NAME || 'domicilios_palermo',
    port: parseInt(process.env.DB_PORT || '3306', 10)
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY
  },
  aiProviders: {
    primary: process.env.AI_PRIMARY_PROVIDER || 'openai',
    fallbackOrder: (process.env.AI_FALLBACK_ORDER || 'openai,gemini,deepseek').split(',').map(s => s.trim()).filter(Boolean)
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || (isProduction ? [] : ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:5176'])
  },
  payment: {
    baseUrl: process.env.PAYMENT_LINK_BASE_URL || 'https://checkout.example.com'
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  },
  contabilidad: {
    ivaRate: parseFloat(process.env.IVA_RATE || '0.19'),
    comisionDefault: parseFloat(process.env.COMISION_DEFAULT || '10')
  }
};
