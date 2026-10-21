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
    const country = await this.onboarding.getCountry(request.countryId);
    const avatar = options.avatars.find(item => item.id === request.avatarId);
    if (!country || !avatar) throw new BadRequestException('Unknown country or avatar');
    return this.players.createCharacter(userId, request, country);
  }
}
