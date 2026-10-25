import { Injectable } from '@nestjs/common';
import {
  movementTutorialNarration,
  type MovementTutorialPageId,
  type TutorialSpeechResponse,
} from '@life-abroad/shared';
import { FixedSpeechService } from './fixed-speech.service';
import { SpeechProfileService } from './speech-profile.service';
import { withinSpeechReplyBudget } from './conversation-speech.service';

@Injectable()
export class TutorialSpeechService {
  constructor(
    private readonly fixed: FixedSpeechService,
    private readonly profiles: SpeechProfileService,
  ) {}

  async get(pageId: MovementTutorialPageId): Promise<TutorialSpeechResponse> {
    const identity = await this.profiles.tutorialIdentity();
    const generated = await withinSpeechReplyBudget(this.fixed.get({
      ...identity,
      text: movementTutorialNarration(pageId),
    }));
    return { url: generated.url };
  }
}
