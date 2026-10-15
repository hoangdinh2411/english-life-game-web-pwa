import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DialogueModule } from '../dialogue/dialogue.module';
import { AI_PROVIDER, AiProvider } from './ai-provider';
import { AiService } from './ai.service';
import { MockProvider } from './mock.provider';
import { GeminiProvider } from './gemini.provider';

@Module({
  imports: [ConfigModule, DialogueModule],
  providers: [
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AiProvider => {
        const provider = config.get<string>('AI_PROVIDER')?.trim() || 'mock';
        if (provider === 'mock') return new MockProvider();
        if (provider === 'gemini') return new GeminiProvider(config);
        throw new Error('Unsupported AI_PROVIDER; use mock or gemini.');
      },
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
