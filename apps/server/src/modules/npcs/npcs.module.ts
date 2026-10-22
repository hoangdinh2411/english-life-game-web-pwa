import { Module } from '@nestjs/common';
import { NpcMoodService } from './npc-mood.service';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { NpcsController } from './npcs.controller';
import { NpcPresenceService } from './npc-presence.service';
import { NpcRelationshipService } from './npc-relationship.service';
import { WorldClockModule } from '../world-clock/world-clock.module';

@Module({ imports: [DatabaseModule, AuthModule, WorldClockModule], controllers: [NpcsController],
  providers: [NpcMoodService, NpcPresenceService, NpcRelationshipService],
  exports: [NpcMoodService, NpcPresenceService, NpcRelationshipService] })
export class NpcsModule {}
