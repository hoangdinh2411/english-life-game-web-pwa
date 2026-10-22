import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { EconomyModule } from '../economy/economy.module';
import { ShopsModule } from '../shops/shops.module';
import { LifeController } from './life.controller';
import { LifeRepository } from './life.repository';
import { LifeService } from './life.service';
import { WorldClockModule } from '../world-clock/world-clock.module';

@Module({ imports: [DatabaseModule, AuthModule, EconomyModule, ShopsModule, WorldClockModule], controllers: [LifeController],
  providers: [LifeRepository, LifeService], exports: [LifeService] })
export class LifeModule {}
