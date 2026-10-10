import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const supplied = request.headers.authorization?.match(/^Bearer ([^\s,]+)$/i)?.[1];
    if (!key || !supplied || Buffer.byteLength(key) !== Buffer.byteLength(supplied)
      || !timingSafeEqual(Buffer.from(key), Buffer.from(supplied))) throw new UnauthorizedException();
    return true;
  }
}
