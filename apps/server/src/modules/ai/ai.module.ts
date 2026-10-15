import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DialogueModule } from '../dialogue/dialogue.module';
import { AI_PROVIDER, AiProvider } from './ai-provider';
import { AiService } from './ai.service';
import { MockProvider } from './mock.provider';

@Module({
  imports: [ConfigModule, DialogueModule],
  providers: [
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AiProvider => {
        const provider = config.get<string>('AI_PROVIDER')?.trim() || 'mock';
        // Live providers will consume AI_API_KEY / AI_MODEL in their adapter.
        if (provider !== 'mock') throw new Error('Unsupported AI_PROVIDER; use mock.');
        return new MockProvider();
      },
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
