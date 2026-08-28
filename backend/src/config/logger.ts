import pino from 'pino';

/** Redacta credenciales: el stdout del contenedor suele ir a un agregador. */
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
