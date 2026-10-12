import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CoffeeQuestService } from './coffee-quest.service';

@Controller('quests/coffee')
@UseGuards(AuthGuard)
export class CoffeeQuestController {
  constructor(private readonly coffee: CoffeeQuestService) {}
  @Get() get(@CurrentUser() userId: string) { return this.coffee.get(userId); }
}
