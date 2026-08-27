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
      // Las columnas DATE deben volver como medianoche UTC; sin esto el driver
      // las interpretaría en la zona del contenedor y el día podría desplazarse.
      useUTC: true,
      // La imagen de SQL Server usa un certificado autofirmado. En producción
      // real esto sería false y se montaría el certificado de la organización.
      trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE,
      enableArithAbort: true,
    },
  };
}

/**
 * La base de datos de la aplicación no existe en una instancia recién creada:
 * la imagen de SQL Server solo trae las bases del sistema. Se crea conectando
 * primero a `master`.
 *
 * `CREATE DATABASE` no admite parámetros, por eso `DB_NAME` está restringido en
 * el esquema de configuración a `[A-Za-z0-9_]`.
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

/**
 * El healthcheck de Compose ya espera a que SQL Server acepte conexiones, pero
 * el reintento cubre el arranque fuera de Docker y el instante entre que el
 * motor responde y termina de recuperar la base.
 */
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

/**
 * Sonda usada por /health. El timeout es imprescindible: una base colgada
 * (a diferencia de una caída) dejaría la petición esperando indefinidamente y
 * el healthcheck nunca daría un veredicto.
 */
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
