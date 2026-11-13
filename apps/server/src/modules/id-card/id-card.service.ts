import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { formatCalendarDate, generateIdCardNumber } from './id-card-number';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { formatIdCardNumber, type IdCardIssueResponse, type IdCardResponse, type IssueIdCardBody } from '@life-abroad/shared';
import { IdCardImageService } from './id-card-image.service';
import { SupabaseIdCardPhotoStorage } from './id-card-photo.storage';
import { IdCardApplicationContentService } from '../conversations/id-card-application-content.service';
import { ConversationSpeechService } from '../speech/conversation-speech.service';
import { conversationNpcSchema } from '@life-abroad/shared';

interface ApplicationRow {
  current_field: string; name: string | null; date_of_birth: Date | null; address: string | null;
  gender: 'male' | 'female' | null; origin: string | null;
}

interface IssuedMessageRow { id: string; sender: 'npc'; text: string; created_at: Date }
interface CardRow {
  number: string;
  full_name: string;
  birth_date: Date;
  address: string | null;
  gender: 'male' | 'female';
  origin: string;
  photo_path: string | null;
  issued_at: Date;
  updated_at: Date;
}

function normalizeAddress(address: string | null): string | null {
  if (address === null) return null;
  const value = address.trim();
  return /^(?:i\s+)?(?:don['’]?t|do\s+not)\s+have(?:\s+any)?\s+(?:an?\s+)?(?:permanent\s+)?address(?:\s+(?:right\s+now|yet))?$/i.test(value)
    ? null
    : value;
}

@Injectable()
export class IdCardService {
  constructor(private readonly database: DatabaseService, private readonly images: IdCardImageService,
    private readonly storage: SupabaseIdCardPhotoStorage, private readonly content: IdCardApplicationContentService,
    private readonly speech: ConversationSpeechService) {}

  resetApplication(userId: string): Promise<void> {
    return this.database.query('DELETE FROM public.id_card_applications WHERE user_id=$1', [userId])
      .then(() => undefined);
  }

  async get(userId: string): Promise<IdCardResponse> {
    const result = await this.database.query<CardRow>(`SELECT number,full_name,birth_date,address,gender,origin,
      photo_path,issued_at,updated_at FROM public.player_id_card WHERE user_id=$1`, [userId]);
    const card = result.rows[0];
    if (!card) throw new NotFoundException('ID card not found');
    return {
      number: formatIdCardNumber(card.number),
      fullName: card.full_name,
      birthDate: this.dateOnly(card.birth_date),
      address: normalizeAddress(card.address),
      gender: card.gender,
      origin: card.origin,
      photoUrl: card.photo_path ? await this.storage.signedUrl(card.photo_path) : null,
      issuedAt: card.issued_at.toISOString(),
      updatedAt: card.updated_at.toISOString(),
    };
  }

  async hasIdCard(userId: string): Promise<boolean> {
    const result = await this.database.query('SELECT 1 FROM public.player_id_card WHERE user_id=$1', [userId]);
    return (result.rowCount ?? 0) > 0;
  }

  async hasAddress(userId: string): Promise<boolean> {
    const result = await this.database.query(
      'SELECT 1 FROM public.player_id_card WHERE user_id=$1 AND address IS NOT NULL', [userId]);
    return (result.rowCount ?? 0) > 0;
  }

  async setIdCardAddress(userId: string, address: string | null): Promise<void> {
    if (address !== null) {
      const trimmed = address.trim();
      const hasControlCharacter = Array.from(trimmed).some(character => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127;
      });
      if (!trimmed || trimmed.length > 120 || hasControlCharacter) {
        throw new ConflictException('Address must be plain text up to 120 characters.');
      }
      address = trimmed;
    }
    const result = await this.database.query(
      'UPDATE public.player_id_card SET address=$2,updated_at=now() WHERE user_id=$1', [userId, address]);
    if (result.rowCount !== 1) throw new NotFoundException('ID card not found');
  }

  async issue(userId: string, body: IssueIdCardBody, file: { buffer: Buffer; size: number } | undefined): Promise<IdCardIssueResponse> {
    const image = await this.images.process(file);
    const photoHash = createHash('sha256').update(image ?? Buffer.from('character-picture')).digest('hex');
    const photoPath = image ? `${userId}/id-photo` : null;
    const prompts = (await this.content.get()).prompts;
    let uploaded = false;
    try {
      const result = await this.database.transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`id-card:${userId}`]);
        const conversation = await client.query<{ npc_id: string }>(
          'SELECT npc_id FROM public.conversations WHERE id=$1 AND user_id=$2', [body.conversationId, userId]);
        const npcId = conversationNpcSchema.parse(conversation.rows[0]?.npc_id);
        const replay = await client.query<{ conversation_id: string; photo_hash: string }>(
          'SELECT conversation_id,photo_hash FROM public.id_card_issue_requests WHERE user_id=$1 AND idempotency_key=$2',
          [userId, body.idempotencyKey]);
        if (replay.rows[0] && (replay.rows[0].conversation_id !== body.conversationId || replay.rows[0].photo_hash !== photoHash)) {
          throw new ConflictException('Idempotency key was already used for a different request');
        }
        const existing = await client.query<{ photo_path: string | null; number: string }>('SELECT photo_path,number FROM public.player_id_card WHERE user_id=$1', [userId]);
        if (existing.rows[0]) {
          if (replay.rows[0]) {
            const message = await this.issuedMessage(client, replay.rows[0].conversation_id, body.idempotencyKey);
            return { photoPath: existing.rows[0].photo_path, message, npcId };
          }
          const pending = await client.query('SELECT 1 FROM public.id_card_applications WHERE user_id=$1', [userId]);
          if (!pending.rows[0]) {
            await client.query(`INSERT INTO public.id_card_issue_requests
              (user_id,idempotency_key,conversation_id,photo_hash) VALUES ($1,$2,$3,$4)`,
            [userId, body.idempotencyKey, body.conversationId, photoHash]);
            const message = (await client.query<IssuedMessageRow>(`INSERT INTO public.messages
              (conversation_id,sender,text,client_message_id) VALUES ($1,'npc',$2,$3)
              RETURNING id,sender,text,created_at`, [body.conversationId, prompts.issued, body.idempotencyKey])).rows[0]!;
            return { photoPath: existing.rows[0].photo_path, message, npcId };
          }
          const application = await this.application(client, userId, body.conversationId);
          if (!application.date_of_birth || !application.gender) throw new ConflictException('Complete the ID card application first');
          if (image && photoPath) { await this.storage.upload(photoPath, image); uploaded = true; }
          await client.query(`UPDATE public.player_id_card SET full_name=$2,birth_date=$3,address=$4,
            gender=$5,origin=$6,photo_path=COALESCE($7,photo_path),updated_at=now() WHERE user_id=$1`,
          [userId, application.name, this.dateOnly(application.date_of_birth), normalizeAddress(application.address), application.gender, application.origin, photoPath]);
          await client.query(`INSERT INTO public.id_card_issue_requests
            (user_id,idempotency_key,conversation_id,photo_hash) VALUES ($1,$2,$3,$4)`,
          [userId, body.idempotencyKey, body.conversationId, photoHash]);
          const message = (await client.query<IssuedMessageRow>(`INSERT INTO public.messages
            (conversation_id,sender,text,client_message_id) VALUES ($1,'npc',$2,$3)
            RETURNING id,sender,text,created_at`, [body.conversationId, prompts.updated, body.idempotencyKey])).rows[0]!;
          await client.query('DELETE FROM public.id_card_applications WHERE user_id=$1', [userId]);
          return { photoPath: photoPath ?? existing.rows[0].photo_path, message, npcId };
        }
        const application = await this.application(client, userId, body.conversationId);
        if (image && photoPath) { await this.storage.upload(photoPath, image); uploaded = true; }
        if (!application.date_of_birth || !application.gender) throw new ConflictException('Complete the ID card application first');
        const birthDate = this.dateOnly(application.date_of_birth);
        const number = await this.uniqueNumber(client, birthDate, application.gender);
        await client.query(`INSERT INTO public.player_id_card
          (user_id,number,full_name,birth_date,address,gender,origin,photo_path)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [userId, number, application.name, birthDate, normalizeAddress(application.address), application.gender, application.origin, photoPath]);
        await client.query(`INSERT INTO public.id_card_issue_requests
          (user_id,idempotency_key,conversation_id,photo_hash) VALUES ($1,$2,$3,$4)`,
        [userId, body.idempotencyKey, body.conversationId, photoHash]);
        const message = (await client.query<IssuedMessageRow>(`INSERT INTO public.messages
          (conversation_id,sender,text,client_message_id) VALUES ($1,'npc',$2,$3)
          RETURNING id,sender,text,created_at`, [body.conversationId, prompts.issued, body.idempotencyKey])).rows[0]!;
        await client.query('DELETE FROM public.id_card_applications WHERE user_id=$1', [userId]);
        return { photoPath, message, npcId };
      });
      const spokenMessage = await this.speech.message(userId, result.npcId, this.message(result.message));
      const npcMessage = { ...spokenMessage, sender: 'npc' as const };
      return { issued: true, photoUrl: result.photoPath ? await this.storage.signedUrl(result.photoPath) : null,
        npcMessage };
    } catch (error) {
      if (uploaded && photoPath) await this.storage.remove(photoPath).catch(() => undefined);
      throw error;
    }
  }

  private dateOnly(value: Date | string): string {
    return formatCalendarDate(value);
  }

  private async uniqueNumber(client: PoolClient, birthDate: Date | string, gender: 'male' | 'female'): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const number = generateIdCardNumber(birthDate, gender);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`id-card-number:${number}`]);
      const result = await client.query('SELECT 1 FROM public.player_id_card WHERE number=$1', [number]);
      if (!result.rows[0]) return number;
    }
    throw new ConflictException('Please try again later.');
  }

  private async issuedMessage(client: PoolClient, conversationId: string, idempotencyKey: string | null): Promise<IssuedMessageRow> {
    const result = await client.query<IssuedMessageRow>(`SELECT id,sender,text,created_at FROM public.messages
      WHERE conversation_id=$1 AND sender='npc' AND ($2::uuid IS NULL OR client_message_id=$2)
      ORDER BY sequence DESC LIMIT 1`, [conversationId, idempotencyKey]);
    if (!result.rows[0]) throw new ConflictException('ID card issuance message is unavailable');
    return result.rows[0];
  }

  private message(row: IssuedMessageRow): IdCardIssueResponse['npcMessage'] {
    return { id: row.id, sender: 'npc', text: row.text, createdAt: row.created_at.toISOString() };
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
