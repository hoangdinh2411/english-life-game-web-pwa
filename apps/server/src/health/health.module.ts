import { Controller, Get, Module } from '@nestjs/common';
import type { HealthResponse } from '@life-abroad/shared';

@Controller('health')
class HealthController {
  @Get()
  getHealth(): HealthResponse { return { status: 'ok' }; }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
