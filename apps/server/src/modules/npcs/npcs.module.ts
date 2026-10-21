import { Module } from '@nestjs/common';
import { NpcMoodService } from './npc-mood.service';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { NpcsController } from './npcs.controller';
import { NpcPresenceService } from './npc-presence.service';

@Module({ imports: [DatabaseModule, AuthModule], controllers: [NpcsController],
  providers: [NpcMoodService, NpcPresenceService], exports: [NpcMoodService, NpcPresenceService] })
export class NpcsModule {}
