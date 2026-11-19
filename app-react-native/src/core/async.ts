// Utilitaires asynchrones.

export class TimeoutError extends Error {
  constructor(message: string = 'Délai dépassé') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof Error && error.name === 'TimeoutError';
}

// Rejette avec TimeoutError si la promesse n'aboutit pas dans le délai
// (.timeout(Duration(seconds: 45)) côté Flutter). La promesse d'origine n'est
// pas annulée : comme sur Flutter, l'opération peut encore se terminer.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Délai d'enregistrement d'une annonce (publish / edit Flutter : 45 s).
export const SAVE_TIMEOUT_MS = 45000;
