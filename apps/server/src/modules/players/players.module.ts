import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { PlayersController } from './players.controller';
import { PlayersRepository } from './players.repository';
import { PlayersService } from './players.service';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({ imports: [AuthModule, DatabaseModule, OnboardingModule], controllers: [PlayersController], providers: [PlayersRepository, PlayersService] })
export class PlayersModule {}
