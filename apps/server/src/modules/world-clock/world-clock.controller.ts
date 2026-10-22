import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WorldClockService } from './world-clock.service';

@Controller('world-clock')
@UseGuards(AuthGuard)
export class WorldClockController {
  constructor(private readonly worldClock: WorldClockService) {}
  @Get() get(@CurrentUser() userId: string) { return this.worldClock.snapshot(userId); }
}
