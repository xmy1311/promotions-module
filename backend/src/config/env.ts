import { z } from 'zod';
import { isValidTimeZone } from '../domain/dates';

/**
 * Un booleano de entorno llega como cadena. `z.coerce.boolean()` no sirve:
 * convertiría "false" en `true` porque toda cadena no vacía es verdadera.
 */
const booleanFromString = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

/**
 * El nombre de la base se interpola en `CREATE DATABASE`, que no admite
 * parámetros. Restringir el juego de caracteres cierra esa vía de inyección.
 */
const databaseName = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_]+$/, 'Solo se permiten letras, números y guion bajo');

const timeZone = z
  .string()
  .min(1)
  .refine(isValidTimeZone, 'No es una zona horaria IANA válida');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  APP_TIMEZONE: timeZone,
  CORS_ORIGINS: z.string().default(''),
  HEALTH_DB_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_NAME: databaseName,
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_ENCRYPT: booleanFromString.default('true'),
  DB_TRUST_SERVER_CERTIFICATE: booleanFromString.default('true'),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema> & { corsOrigins: string[] };

/**
 * Falla al arrancar, no en la primera petición, y reporta *todas* las variables
 * problemáticas de una vez en lugar de la primera.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Configuración inválida. Revisa tu archivo .env (parte de .env.example):\n${details}`,
    );
  }

  const corsOrigins = result.data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return { ...result.data, corsOrigins };
}
