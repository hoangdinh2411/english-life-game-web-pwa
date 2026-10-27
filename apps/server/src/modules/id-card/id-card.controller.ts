import { Body, Controller, Delete, HttpCode, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { issueIdCardBodySchema, type IdCardIssueResponse, type IssueIdCardBody } from '@life-abroad/shared';
import { SchemaValidationPipe } from '../../common/pipes/schema-validation.pipe';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { IdCardService } from './id-card.service';

interface PhotoFile { buffer: Buffer; size: number }

@Controller('me/id-card')
@UseGuards(AuthGuard)
export class IdCardController {
  constructor(private readonly idCards: IdCardService) {}

  @Delete('application')
  @HttpCode(204)
  resetApplication(@CurrentUser() userId: string): Promise<void> {
    return this.idCards.resetApplication(userId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, parts: 3 } }))
  issue(@CurrentUser() userId: string,
    @Body(new SchemaValidationPipe(issueIdCardBodySchema)) body: IssueIdCardBody,
    @UploadedFile() photo: PhotoFile | undefined): Promise<IdCardIssueResponse> {
    return this.idCards.issue(userId, body, photo);
  }
}

