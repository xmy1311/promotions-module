import pino from 'pino';

/**
 * Log estructurado con redacción explícita: una contraseña o un token nunca
 * deben terminar en el stdout del contenedor, que suele ir a un agregador.
 */
export function createLogger(level: string): pino.Logger {
  return pino({
    level,
    redact: {
      paths: [
        'password',
        'DB_PASSWORD',
        'MSSQL_SA_PASSWORD',
        'req.headers.authorization',
        'req.headers.cookie',
        'config.password',
      ],
      censor: '[REDACTADO]',
    },
  });
}

export type Logger = pino.Logger;
