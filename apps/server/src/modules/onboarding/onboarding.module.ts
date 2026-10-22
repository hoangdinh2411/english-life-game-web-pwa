import { Module } from '@nestjs/common';
import { resolve } from 'node:path';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { OnboardingController } from './onboarding.controller';
import { ONBOARDING_SEED_DIRECTORY, OnboardingService } from './onboarding.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, {
    provide: ONBOARDING_SEED_DIRECTORY,
    useValue: resolve(__dirname, '../../../../../content/seed'),
  }],
  exports: [OnboardingService],
})
export class OnboardingModule {}
