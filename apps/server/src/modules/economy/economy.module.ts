import { Module } from '@nestjs/common';
import { EconomyService } from './economy.service';
import { DatabaseModule } from '../../infrastructure/database/database.module';

@Module({ imports: [DatabaseModule], providers: [EconomyService], exports: [EconomyService] })
export class EconomyModule {}
