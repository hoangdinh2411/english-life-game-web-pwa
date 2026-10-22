import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  createCharacterSchema,
  playerLocationSchema,
  playerPreferencesInitializeSchema,
  playerPreferencesUpdateSchema,
  type CreateCharacterRequest,
  type PlayerLocation,
  type PlayerPreferences,
  type PlayerPreferencesInitialize,
  type PlayerPreferencesRead,
  type PlayerPreferencesUpdate,
  type PlayerResponse,
  type PlayerState,
} from '@life-abroad/shared';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlayersService } from './players.service';
import { SchemaValidationPipe } from '../../common/pipes/schema-validation.pipe';

@Controller()
@UseGuards(AuthGuard)
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Get('me')
  getPlayer(@CurrentUser() userId: string): Promise<PlayerResponse> { return this.players.getPlayer(userId); }

  @Post('characters')
  createCharacter(@CurrentUser() userId: string,
    @Body(new SchemaValidationPipe(createCharacterSchema)) request: CreateCharacterRequest): Promise<PlayerState> {
    return this.players.createCharacter(userId, request);
  }

  @Post('players/location')
  saveLocation(@CurrentUser() userId: string,
    @Body(new SchemaValidationPipe(playerLocationSchema)) location: PlayerLocation): Promise<PlayerLocation> {
    return this.players.saveLocation(userId, location);
  }

  @Get('players/preferences')
  getPreferences(@CurrentUser() userId: string): Promise<PlayerPreferencesRead> {
    return this.players.getPreferences(userId);
  }

  @Post('players/preferences/initialize')
  initializePreferences(@CurrentUser() userId: string,
    @Body(new SchemaValidationPipe(playerPreferencesInitializeSchema)) preferences: PlayerPreferencesInitialize): Promise<PlayerPreferences> {
    return this.players.initializePreferences(userId, preferences);
  }

  @Post('players/preferences')
  updatePreferences(@CurrentUser() userId: string,
    @Body(new SchemaValidationPipe(playerPreferencesUpdateSchema)) preferences: PlayerPreferencesUpdate): Promise<PlayerPreferences> {
    return this.players.updatePreferences(userId, preferences);
  }
}
