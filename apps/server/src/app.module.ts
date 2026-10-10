import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { APP_FILTER } from '@nestjs/core';
import { ApiErrorFilter } from './common/filters/api-error.filter';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PlayersModule } from './modules/players/players.module';
import { DialogueModule } from './modules/dialogue/dialogue.module';

// Register your business modules here as you implement them.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.supabase.local', '.env', '../../.env'] }), HealthModule, AuthModule, DatabaseModule, OnboardingModule, PlayersModule, DialogueModule],
  providers: [{ provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule {}
