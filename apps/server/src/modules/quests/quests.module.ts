import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { EconomyModule } from '../economy/economy.module';
import { AuthModule } from '../auth/auth.module';
import { QuestsController } from './quests.controller';
import { QuestsRepository } from './quests.repository';
import { QuestsService } from './quests.service';
import { CoffeeQuestService } from './coffee-quest.service';
import { CoffeeQuestController } from './coffee-quest.controller';

@Module({ imports: [DatabaseModule, EconomyModule, AuthModule], controllers: [QuestsController, CoffeeQuestController],
  providers: [QuestsRepository, QuestsService, CoffeeQuestService], exports: [QuestsService, CoffeeQuestService] })
export class QuestsModule {}
