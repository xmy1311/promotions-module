export interface FieldIssue {
  field: string;
  message: string;
}

/** Error de negocio devuelto por la API, con los campos ya señalados. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldIssue[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: FieldIssue[] };
}

// Ruta relativa: Nginx hace de proxy y la URL del backend no entra en el bundle.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No fue posible contactar al servidor');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const { error } = body as ApiErrorBody;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'Ocurrió un error inesperado',
      error?.details ?? [],
    );
  }

  return body as T;
}
