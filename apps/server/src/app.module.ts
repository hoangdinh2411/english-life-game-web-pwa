import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { ApiErrorFilter } from './common/filters/api-error.filter';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PlayersModule } from './modules/players/players.module';
import { DialogueModule } from './modules/dialogue/dialogue.module';
import { QuestsModule } from './modules/quests/quests.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { ContentModule } from './modules/content/content.module';
import { LifeModule } from './modules/life/life.module';
import { ShopsModule } from './modules/shops/shops.module';
import { AiModule } from './modules/ai/ai.module';
import { NpcsModule } from './modules/npcs/npcs.module';
import { WorldClockModule } from './modules/world-clock/world-clock.module';

// Register your business modules here as you implement them.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.supabase.local', '.env', '../../.env'] }), HealthModule, AuthModule, DatabaseModule, OnboardingModule, PlayersModule, DialogueModule, QuestsModule, ConversationsModule, ContentModule, ShopsModule, LifeModule, AiModule, NpcsModule, WorldClockModule],
  providers: [{ provide: APP_FILTER, useClass: ApiErrorFilter }, { provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule {}
