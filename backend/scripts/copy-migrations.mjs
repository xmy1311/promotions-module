// tsc solo emite JavaScript: los .sql de las migraciones deben copiarse al
// bundle a mano para que la imagen de producción los encuentre en runtime.
import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(backendRoot, 'src/infrastructure/db/migrations');
const to = resolve(backendRoot, 'dist/infrastructure/db/migrations');

if (!existsSync(from)) {
  console.error(`No se encontró el directorio de migraciones: ${from}`);
  process.exit(1);
}

cpSync(from, to, { recursive: true });
process.stdout.write(`Migraciones copiadas a ${to}\n`);
