import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ShopsService } from './shops.service';

@Module({ imports: [DatabaseModule], providers: [ShopsService], exports: [ShopsService] })
export class ShopsModule {}
