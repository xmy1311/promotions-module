import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type sql from 'mssql';
import type { Logger } from '../../config/logger';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * Scripts .sql numerados, aplicados una vez y registrados en schema_migrations.
 * Corre antes de abrir el puerto: /health no puede dar 200 sin esquema.
 */
export async function runMigrations(pool: sql.ConnectionPool, logger: Logger): Promise<void> {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'schema_migrations')
    BEGIN
        CREATE TABLE dbo.schema_migrations (
            filename    NVARCHAR(255) NOT NULL CONSTRAINT PK_schema_migrations PRIMARY KEY,
            applied_at  DATETIME2(3)  NOT NULL CONSTRAINT DF_schema_migrations_applied_at DEFAULT (SYSUTCDATETIME())
        );
    END
  `);

  const applied = new Set(
    (await pool.request().query<{ filename: string }>('SELECT filename FROM dbo.schema_migrations'))
      .recordset.map((row) => row.filename),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const script = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      await transaction.request().batch(script);
      await transaction
        .request()
        .input('filename', file)
        .query('INSERT INTO dbo.schema_migrations (filename) VALUES (@filename)');
      await transaction.commit();
      logger.info({ migration: file }, 'Migración aplicada');
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Falló la migración ${file}: ${String(error)}`);
    }
  }

  logger.info({ total: files.length }, 'Esquema actualizado');
}
