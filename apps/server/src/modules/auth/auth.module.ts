import { Module } from '@nestjs/common';
import { SupabaseTokenVerifier } from '../../infrastructure/auth/supabase-token-verifier';
import { AuthGuard } from './auth.guard';

@Module({ providers: [SupabaseTokenVerifier, AuthGuard], exports: [SupabaseTokenVerifier, AuthGuard] })
export class AuthModule {}
