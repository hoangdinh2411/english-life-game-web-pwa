import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';
import type { IdCardIssueResponse, IssueIdCardBody } from '@life-abroad/shared';
import { IdCardImageService } from './id-card-image.service';
import { SupabaseIdCardPhotoStorage } from './id-card-photo.storage';

interface ApplicationRow {
  current_field: string; name: string | null; date_of_birth: Date | null; address: string | null;
  gender: 'male' | 'female' | null; origin: string | null;
}

@Injectable()
export class IdCardService {
  constructor(private readonly database: DatabaseService, private readonly images: IdCardImageService,
    private readonly storage: SupabaseIdCardPhotoStorage) {}

  async issue(userId: string, body: IssueIdCardBody, file: { buffer: Buffer; size: number } | undefined): Promise<IdCardIssueResponse> {
    const image = await this.images.process(file);
    const photoHash = createHash('sha256').update(image ?? Buffer.from('character-picture')).digest('hex');
    const photoPath = image ? `${userId}/id-photo` : null;
    let uploaded = false;
    try {
      const result = await this.database.transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`id-card:${userId}`]);
        const existing = await client.query<{ photo_path: string | null }>('SELECT photo_path FROM public.player_id_card WHERE user_id=$1', [userId]);
        if (existing.rows[0]) return existing.rows[0].photo_path;
        const replay = await client.query<{ conversation_id: string; photo_hash: string }>(
          'SELECT conversation_id,photo_hash FROM public.id_card_issue_requests WHERE user_id=$1 AND idempotency_key=$2',
          [userId, body.idempotencyKey]);
        if (replay.rows[0] && (replay.rows[0].conversation_id !== body.conversationId || replay.rows[0].photo_hash !== photoHash)) {
          throw new ConflictException('Idempotency key was already used for a different request');
        }
        const application = await this.application(client, userId, body.conversationId);
        if (image && photoPath) { await this.storage.upload(photoPath, image); uploaded = true; }
        await client.query(`INSERT INTO public.player_id_card
          (user_id,full_name,birth_date,address,gender,origin,photo_path)
          VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [userId, application.name, application.date_of_birth, application.address, application.gender, application.origin, photoPath]);
        await client.query(`INSERT INTO public.id_card_issue_requests
          (user_id,idempotency_key,conversation_id,photo_hash) VALUES ($1,$2,$3,$4)`,
        [userId, body.idempotencyKey, body.conversationId, photoHash]);
        await client.query('DELETE FROM public.id_card_applications WHERE user_id=$1', [userId]);
        return photoPath;
      });
      return { issued: true, photoUrl: result ? await this.storage.signedUrl(result) : null };
    } catch (error) {
      if (uploaded && photoPath) await this.storage.remove(photoPath).catch(() => undefined);
      throw error;
    }
  }

  private async application(client: PoolClient, userId: string, conversationId: string): Promise<ApplicationRow> {
    const conversation = await client.query<{ confirmed: boolean }>(`SELECT EXISTS (
      SELECT 1 FROM public.messages m WHERE m.conversation_id=c.id AND m.sender='npc'
        AND m.metadata->>'intent'='confirm_id_card_application') AS confirmed
      FROM public.conversations c WHERE c.id=$1 AND c.user_id=$2
        AND c.npc_id IN ('npc_tax_clerk_marcus','npc_tax_clerk_nadia') FOR UPDATE`, [conversationId, userId]);
    if (!conversation.rows[0]) throw new NotFoundException('Conversation not found');
    if (!conversation.rows[0].confirmed) throw new ConflictException('Confirm the ID card application with the staff member first');
    const result = await client.query<ApplicationRow>(`SELECT current_field,name,date_of_birth,address,gender,origin
      FROM public.id_card_applications WHERE user_id=$1 FOR UPDATE`, [userId]);
    const row = result.rows[0];
    if (!row || !['photo', 'review'].includes(row.current_field) || !row.name || !row.date_of_birth || !row.gender || !row.origin) {
      throw new ConflictException('Complete the ID card application first');
    }
    return row;
  }
}

