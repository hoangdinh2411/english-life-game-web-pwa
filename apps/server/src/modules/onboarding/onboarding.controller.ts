import { Controller, Get, UseGuards } from '@nestjs/common';
import type { OnboardingOptions } from '@life-abroad/shared';
import { AuthGuard } from '../auth/auth.guard';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(AuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('options')
  getOptions(): Promise<OnboardingOptions> {
    return this.onboarding.getOptions();
  }
}
