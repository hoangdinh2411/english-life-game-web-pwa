import { Controller, Get, UseGuards } from '@nestjs/common';
import type { LearningReview } from '@life-abroad/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LearningService } from './learning.service';

@Controller('learning')
@UseGuards(AuthGuard)
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get('review')
  review(@CurrentUser() userId: string): Promise<LearningReview> {
    return this.learning.review(userId);
  }
}
