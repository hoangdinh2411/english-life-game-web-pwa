import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AzureFixedSpeechGenerator } from './azure-fixed-speech.generator';
import { AzureSpeechProvider } from './azure-speech.provider';
import { FixedSpeechService, SPEECH_AUDIO_STORAGE, SPEECH_CACHE_REPOSITORY, SPEECH_GENERATOR } from './fixed-speech.service';
import { SupabaseSpeechAudioStorage } from './speech-audio.storage';
import { PostgresSpeechCacheRepository } from './speech-cache.repository';
import { AiSpeechService, AI_SPEECH_REPOSITORY } from './ai-speech.service';
import { PostgresAiSpeechRepository } from './ai-speech.repository';
import { ConversationSpeechService } from './conversation-speech.service';
import { SpeechProfileService } from './speech-profile.service';
import { AuthModule } from '../auth/auth.module';
import { TutorialSpeechController } from './tutorial-speech.controller';
import { TutorialSpeechService } from './tutorial-speech.service';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule],
  controllers: [TutorialSpeechController],
  providers: [
    { provide: AzureSpeechProvider, inject: [ConfigService],
      useFactory: (config: ConfigService) => new AzureSpeechProvider(config) },
    AzureFixedSpeechGenerator,
    PostgresSpeechCacheRepository,
    SupabaseSpeechAudioStorage,
    PostgresAiSpeechRepository,
    { provide: SPEECH_GENERATOR, useExisting: AzureFixedSpeechGenerator },
    { provide: SPEECH_CACHE_REPOSITORY, useExisting: PostgresSpeechCacheRepository },
    { provide: SPEECH_AUDIO_STORAGE, useExisting: SupabaseSpeechAudioStorage },
    { provide: AI_SPEECH_REPOSITORY, useExisting: PostgresAiSpeechRepository },
    FixedSpeechService,
    AiSpeechService,
    SpeechProfileService,
    ConversationSpeechService,
    TutorialSpeechService,
  ],
  exports: [FixedSpeechService, AiSpeechService, ConversationSpeechService],
})
export class SpeechModule {}
