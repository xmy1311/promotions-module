import type { DatabaseProbe } from './ports';

export interface HealthReport {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  checks: {
    database: {
      status: 'ok' | 'down';
      latencyMs: number;
    };
  };
}

/**
 * /health comprueba la dependencia de verdad: ejecuta una consulta contra la
 * base de datos. Nunca devuelve el mensaje del driver, el host ni el usuario:
 * ese detalle va al log, no a la respuesta.
 */
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly database: DatabaseProbe,
    private readonly databaseTimeoutMs: number,
    private readonly onProbeFailure: (error: unknown) => void = () => {},
  ) {}

  async check(): Promise<HealthReport> {
    const startedAt = Date.now();
    let databaseStatus: 'ok' | 'down' = 'ok';

    try {
      await this.database.ping(this.databaseTimeoutMs);
    } catch (error) {
      databaseStatus = 'down';
      this.onProbeFailure(error);
    }

    const latencyMs = Date.now() - startedAt;

    return {
      status: databaseStatus === 'ok' ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks: {
        database: { status: databaseStatus, latencyMs },
      },
    };
  }
}
