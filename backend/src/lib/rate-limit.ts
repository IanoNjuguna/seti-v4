/**
 * A tiny in-memory fixed-window rate limiter.
 *
 * Deliberately not a dependency: the one route that needs throttling (a shared
 * receipt link, which can be handed to anyone) wants a modest, per-address cap,
 * and `@fastify/rate-limit` would be a whole plugin and a store choice for that.
 * A fixed window is coarse — it can let up to `2 * limit` through across a window
 * boundary — and that is fine here: the cap exists to bound id-guessing, not to
 * meter a paid API.
 *
 * Process-local, so it resets on restart and is not shared across instances. That
 * is acceptable for a courtesy limit on a read that is already gated by a signed
 * token; it is not a security control on its own.
 */
interface Window {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** True when `key` is within its budget; false when it has spent it. */
  allow(key: string, now: number = Date.now()): boolean {
    const window = this.windows.get(key);

    if (!window || now >= window.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      this.prune(now);
      return true;
    }

    if (window.count >= this.limit) return false;

    window.count += 1;
    return true;
  }

  /** Drop spent windows so the map cannot grow without bound. */
  private prune(now: number): void {
    if (this.windows.size < 1000) return;
    for (const [key, window] of this.windows) {
      if (now >= window.resetAt) this.windows.delete(key);
    }
  }
}
