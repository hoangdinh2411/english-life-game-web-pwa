import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { WorldClockController } from './world-clock.controller';
import { SERVER_CLOCK, WorldClockService } from './world-clock.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [WorldClockController],
  providers: [WorldClockService, { provide: SERVER_CLOCK, useValue: { now: (): Date => new Date() } }],
  exports: [WorldClockService],
})
export class WorldClockModule {}
