import { HttpException, HttpStatus, Injectable, type CanActivate, type ExecutionContext, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface Bucket { count: number; expiresAt: number }
interface RateLimitRequest { socket: { remoteAddress?: string } }
interface RateLimitResponse { setHeader(name: string, value: string): void }

/** Process-local fixed windows, keyed by the connection peer, never by untrusted headers. */
@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly buckets = new Map<string, Bucket>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly cleanup?: ReturnType<typeof setInterval>;

  constructor(config: ConfigService) {
    const limit = config.get<string>('API_RATE_LIMIT_MAX');
    const windowMs = config.get<string>('API_RATE_LIMIT_WINDOW_MS');
    if (limit === undefined && windowMs === undefined) {
      this.limit = 0;
      this.windowMs = 0;
      return;
    }
    this.limit = Number(limit);
    this.windowMs = Number(windowMs);
    if (!Number.isSafeInteger(this.limit) || this.limit <= 0 ||
        !Number.isSafeInteger(this.windowMs) || this.windowMs <= 0 || this.windowMs > 2_147_483_647) {
      throw new Error('API_RATE_LIMIT_MAX and API_RATE_LIMIT_WINDOW_MS must both be positive integers; window must fit a Node timer.');
    }
    this.cleanup = setInterval(() => this.removeExpired(Date.now()), this.windowMs);
    this.cleanup.unref();
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.limit) return true;
    const http = context.switchToHttp();
    const address = http.getRequest<RateLimitRequest>().socket.remoteAddress;
    // Missing connection identity shares a bucket instead of bypassing protection.
    const retryAfter = this.consume(address ?? 'unknown', Date.now());
    if (retryAfter === 0) return true;
    http.getResponse<RateLimitResponse>().setHeader('Retry-After', String(retryAfter));
    throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }

  consume(address: string, now: number): number {
    if (!this.limit) return 0;
    let bucket = this.buckets.get(address);
    if (!bucket || bucket.expiresAt <= now) {
      bucket = { count: 0, expiresAt: now + this.windowMs };
      this.buckets.set(address, bucket);
    }
    if (bucket.count >= this.limit) return Math.ceil((bucket.expiresAt - now) / 1000);
    bucket.count += 1;
    return 0;
  }

  private removeExpired(now: number): void {
    for (const [address, bucket] of this.buckets) {
      if (bucket.expiresAt <= now) this.buckets.delete(address);
    }
  }

  onModuleDestroy(): void {
    if (this.cleanup) clearInterval(this.cleanup);
    this.buckets.clear();
  }
}
