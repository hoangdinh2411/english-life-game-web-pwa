import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { EconomyModule } from '../economy/economy.module';
import { AuthModule } from '../auth/auth.module';
import { QuestsController } from './quests.controller';
import { QuestsRepository } from './quests.repository';
import { QuestsService } from './quests.service';

@Module({ imports: [DatabaseModule, EconomyModule, AuthModule], controllers: [QuestsController],
  providers: [QuestsRepository, QuestsService], exports: [QuestsService] })
export class QuestsModule {}
