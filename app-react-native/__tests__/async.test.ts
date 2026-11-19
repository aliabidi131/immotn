import {
  isTimeoutError,
  TimeoutError,
  withTimeout,
} from '../src/core/async';

describe('withTimeout', () => {
  it('renvoie la valeur si la promesse aboutit à temps', async () => {
    await expect(withTimeout(Promise.resolve(42), 200)).resolves.toBe(42);
  });

  it('propage l’erreur d’origine', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('boom')), 200),
    ).rejects.toThrow('boom');
  });

  it('rejette avec TimeoutError si le délai est dépassé', async () => {
    const never = new Promise<number>(() => {});
    const error = await withTimeout(never, 20).catch(e => e);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(isTimeoutError(error)).toBe(true);
  });

  it('isTimeoutError ignore les autres erreurs', () => {
    expect(isTimeoutError(new Error('x'))).toBe(false);
    expect(isTimeoutError('x')).toBe(false);
  });
});
