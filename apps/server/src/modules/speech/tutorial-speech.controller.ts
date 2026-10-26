import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  movementTutorialPageIdSchema,
  type MovementTutorialPageId,
  type TutorialSpeechResponse,
} from '@life-abroad/shared';
import { SchemaValidationPipe } from '../../common/pipes/schema-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { TutorialSpeechService } from './tutorial-speech.service';

@Controller('tutorial/speech')
@UseGuards(AuthGuard)
export class TutorialSpeechController {
  constructor(private readonly tutorialSpeech: TutorialSpeechService) {}

  @Get(':pageId')
  get(
    @Param('pageId', new SchemaValidationPipe(movementTutorialPageIdSchema)) pageId: MovementTutorialPageId,
  ): Promise<TutorialSpeechResponse> {
    return this.tutorialSpeech.get(pageId);
  }
}
