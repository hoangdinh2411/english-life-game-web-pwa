import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { SupabaseTokenVerifier } from '../../infrastructure/auth/supabase-token-verifier';

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  userId?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly verifier: SupabaseTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = request.headers.authorization?.match(/^Bearer ([^\s,]+)$/i);
    const token = match?.[1];
    if (!token) throw new UnauthorizedException();
    request.userId = await this.verifier.verify(token);
    return true;
  }
}
