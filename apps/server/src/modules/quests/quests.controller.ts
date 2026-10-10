import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ArrivalState, enterTownStreetSchema } from '@life-abroad/shared';
import { SchemaValidationPipe } from '../../common/pipes/schema-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { QuestsService } from './quests.service';

@Controller('quests/arrival')
@UseGuards(AuthGuard)
export class QuestsController {
  constructor(private readonly quests: QuestsService) {}

  @Get()
  getArrival(@CurrentUser() userId: string): Promise<ArrivalState> { return this.quests.getArrival(userId); }

  @Post('enter-town-street')
  enterTownStreet(@CurrentUser() userId: string,
    @Body(new SchemaValidationPipe(enterTownStreetSchema)) request: Record<string, never>): Promise<ArrivalState> {
    void request; // Validation rejects client-supplied state; identity comes from Auth.
    return this.quests.enterTownStreet(userId);
  }
}
