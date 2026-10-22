import { Injectable } from '@nestjs/common';
import type {
  CreateCharacterRequest,
  PlayerLocation,
  PlayerPreferences,
  PlayerPreferencesInitialize,
  PlayerPreferencesRead,
  PlayerPreferencesUpdate,
  PlayerResponse,
  PlayerState,
} from '@life-abroad/shared';
import { PlayersRepository } from './players.repository';

@Injectable()
export class PlayersService {
  constructor(private readonly players: PlayersRepository) {}

  getPlayer(userId: string): Promise<PlayerResponse> { return this.players.getPlayer(userId); }

  saveLocation(userId: string, location: PlayerLocation): Promise<PlayerLocation> {
    return this.players.saveLocation(userId, location);
  }

  getPreferences(userId: string): Promise<PlayerPreferencesRead> {
    return this.players.getPreferences(userId);
  }

  initializePreferences(userId: string, preferences: PlayerPreferencesInitialize): Promise<PlayerPreferences> {
    return this.players.initializePreferences(userId, preferences);
  }

  updatePreferences(userId: string, preferences: PlayerPreferencesUpdate): Promise<PlayerPreferences> {
    return this.players.updatePreferences(userId, preferences);
  }

  createCharacter(userId: string, request: CreateCharacterRequest): Promise<PlayerState> {
    return this.players.createCharacter(userId, request);
  }
}
