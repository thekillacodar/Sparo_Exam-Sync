// Environment configuration
export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 5000,
  DB_PATH: process.env.DB_PATH || './data/exam-sync.db',
  JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
};

// Validate critical configuration
export function validateConfig() {
  const required = ['JWT_SECRET'];

  for (const key of required) {
    if (!config[key] || config[key] === 'default-secret-change-in-production') {
      throw new Error(`Critical configuration missing: ${key}`);
    }
  }

  // Warn about default configurations in production
  if (config.NODE_ENV === 'production') {
    if (config.JWT_SECRET === 'default-secret-change-in-production') {
      throw new Error('JWT_SECRET must be set in production environment');
    }
  }

  console.log('✅ Environment configuration validated');
}
