import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { npcPresenceQuerySchema, type NpcPresenceResponse } from '@life-abroad/shared';
import { SchemaValidationPipe } from '../../common/pipes/schema-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NpcPresenceService } from './npc-presence.service';

@Controller('npcs')
@UseGuards(AuthGuard)
export class NpcsController {
  constructor(private readonly presence: NpcPresenceService) {}

  @Get('presence')
  getPresence(@CurrentUser() userId: string,
    @Query(new SchemaValidationPipe(npcPresenceQuerySchema)) query: { mapId: string }): Promise<NpcPresenceResponse> {
    return this.presence.forMap(userId, query.mapId);
  }
}
