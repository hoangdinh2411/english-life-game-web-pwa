import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { customizeSchema, lifeActionSchema, purchaseSchema, type CustomizeRequest, type PurchaseRequest } from '@life-abroad/shared';
import { SchemaValidationPipe } from '../../common/pipes/schema-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LifeService } from './life.service';

@Controller('life')
@UseGuards(AuthGuard)
export class LifeController {
  constructor(private readonly life: LifeService) {}
  @Get() get(@CurrentUser() userId: string) { return this.life.get(userId); }
  @Get('catalog') catalog() { return this.life.catalog(); }
  @Post('sleep') sleep(@CurrentUser() userId: string,
    @Body(new SchemaValidationPipe(lifeActionSchema)) body: { key: string }) { return this.life.sleep(userId, body.key); }
  @Post('purchase') purchase(@CurrentUser() userId: string,
    @Body(new SchemaValidationPipe(purchaseSchema)) body: PurchaseRequest) { return this.life.purchase(userId, body); }
  @Post('appearance') customize(@CurrentUser() userId: string,
    @Body(new SchemaValidationPipe(customizeSchema)) body: CustomizeRequest) { return this.life.customize(userId, body); }
}
