import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { createCharacterSchema, playerLocationSchema, type CreateCharacterRequest, type PlayerLocation, type PlayerResponse, type PlayerState } from '@life-abroad/shared';
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
}
