import sql from 'mssql';
import type { Env } from '../../config/env';
import type { Logger } from '../../config/logger';
import type { DatabaseProbe } from '../../application/ports';

function baseConfig(env: Env): sql.config {
  return {
    server: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    pool: { max: env.DB_POOL_MAX, min: 0, idleTimeoutMillis: 30_000 },
    options: {
      encrypt: env.DB_ENCRYPT,
      // Sin esto el driver leería las columnas DATE en la zona del contenedor.
      useUTC: true,
      // Certificado autofirmado de la imagen; en producción iría en false.
      trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE,
      enableArithAbort: true,
    },
  };
}

/**
 * La imagen solo trae las bases del sistema. `CREATE DATABASE` no admite
 * parámetros: por eso DB_NAME está acotado en el esquema de configuración.
 */
export async function ensureDatabaseExists(env: Env, logger: Logger): Promise<void> {
  const masterPool = new sql.ConnectionPool({ ...baseConfig(env), database: 'master' });
  try {
    await masterPool.connect();
    await masterPool
      .request()
      .query(`IF DB_ID('${env.DB_NAME}') IS NULL CREATE DATABASE [${env.DB_NAME}];`);
    logger.info({ database: env.DB_NAME }, 'Base de datos verificada');
  } finally {
    await masterPool.close();
  }
}

/** Reintenta: cubre el arranque fuera de Docker y la recuperación de la base. */
export async function createPool(
  env: Env,
  logger: Logger,
  attempts = 20,
  delayMs = 3_000,
): Promise<sql.ConnectionPool> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const pool = new sql.ConnectionPool({ ...baseConfig(env), database: env.DB_NAME });
      await pool.connect();
      logger.info({ attempt }, 'Conexión a la base de datos establecida');
      return pool;
    } catch (error) {
      lastError = error;
      logger.warn(
        { attempt, attempts },
        'La base de datos aún no acepta conexiones; reintentando',
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `No fue posible conectar a la base de datos tras ${attempts} intentos: ${String(lastError)}`,
  );
}

/** El timeout distingue una base colgada de una caída. */
export function createDatabaseProbe(pool: sql.ConnectionPool): DatabaseProbe {
  return {
    async ping(timeoutMs: number): Promise<void> {
      let timer: NodeJS.Timeout | undefined;

      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`La base de datos no respondió en ${timeoutMs} ms`)),
          timeoutMs,
        );
      });

      try {
        await Promise.race([pool.request().query('SELECT 1 AS ok;'), timeout]);
      } finally {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
      }
    },
  };
}
