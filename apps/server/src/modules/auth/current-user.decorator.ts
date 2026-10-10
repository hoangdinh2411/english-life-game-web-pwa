import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard';

// Only expose the verified Supabase identity; profile data belongs to later tasks.
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.userId) throw new UnauthorizedException();
  return request.userId;
});
