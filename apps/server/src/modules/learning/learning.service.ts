import { Injectable } from '@nestjs/common';
import { reviewSchema, type LearningReview } from '@life-abroad/shared';
import { ConversationsService } from '../conversations/conversations.service';
import { buildReview } from './review-history';

@Injectable()
export class LearningService {
  constructor(private readonly conversations: ConversationsService) {}

  async review(userId: string): Promise<LearningReview> {
    return reviewSchema.parse(buildReview(await this.conversations.learningHistory(userId)));
  }
}
