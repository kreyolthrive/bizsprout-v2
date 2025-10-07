// Minimal promise-based circuit breaker
export type CircuitState = 'closed' | 'open' | 'half-open';

export type CircuitOptions = {
  failureThreshold: number; // consecutive failures to open
  halfOpenAfterMs: number; // cooldown before probing
  resetAfterMs: number; // reset counters after success in half-open
};

export function createCircuitBreaker(opts: CircuitOptions) {
  let state: CircuitState = 'closed';
  let failures = 0;
  let lastOpenedAt = 0;

  async function exec<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (state === 'open') {
      if (now - lastOpenedAt < opts.halfOpenAfterMs) {
        throw new Error('circuit-open');
      }
      state = 'half-open';
    }

    try {
      const res = await fn();
      if (state === 'half-open') {
        // success closes and resets
        state = 'closed';
        failures = 0;
      } else {
        failures = 0;
      }
      return res;
    } catch (err) {
      failures += 1;
      if (state === 'half-open') {
        // re-open immediately
        state = 'open';
        lastOpenedAt = now;
      } else if (failures >= opts.failureThreshold) {
        state = 'open';
        lastOpenedAt = now;
      }
      throw err;
    }
  }

  function getState(): CircuitState {
    // auto-transition from open to half-open after cooldown
    if (state === 'open' && Date.now() - lastOpenedAt >= opts.halfOpenAfterMs) {
      state = 'half-open';
    }
    return state;
  }

  return { exec, state: getState };
}
