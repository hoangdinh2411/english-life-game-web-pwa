import { BadRequestException, Injectable } from '@nestjs/common';
import type { CreateCharacterRequest, PlayerLocation, PlayerResponse, PlayerState } from '@life-abroad/shared';
import { OnboardingService } from '../onboarding/onboarding.service';
import { PlayersRepository } from './players.repository';

@Injectable()
export class PlayersService {
  constructor(private readonly players: PlayersRepository, private readonly onboarding: OnboardingService) {}

  getPlayer(userId: string): Promise<PlayerResponse> { return this.players.getPlayer(userId); }

  saveLocation(userId: string, location: PlayerLocation): Promise<PlayerLocation> {
    return this.players.saveLocation(userId, location);
  }

  async createCharacter(userId: string, request: CreateCharacterRequest): Promise<PlayerState> {
    const options = await this.onboarding.getOptions();
    const city = options.cities.find(item => item.id === request.cityId);
    const avatar = options.avatars.find(item => item.id === request.avatarId);
    if (!city || !avatar) throw new BadRequestException('Unknown city or avatar');
    return this.players.createCharacter(userId, request, city);
  }
}
