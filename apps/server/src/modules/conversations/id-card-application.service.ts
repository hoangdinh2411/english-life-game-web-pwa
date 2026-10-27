import { ConflictException, Injectable } from '@nestjs/common';
import { normalizeDialogue, type IdCardApplicationField, type IdCardApplicationSummary, type TurnMetadata } from '@life-abroad/shared';
import type { PoolClient } from 'pg';
import type { ArrivalState } from '@life-abroad/shared';
import { IdCardApplicationContentService } from './id-card-application-content.service';

export interface IdCardApplicationRow {
  current_field: IdCardApplicationField;
  name: string | null;
  date_of_birth: string | Date | null;
  address: string | null;
  gender: 'male' | 'female' | null;
  origin: string | null;
}

interface ApplicationReply {
  nodeId: string;
  responseText: string;
  metadata: TurnMetadata;
}

const plainText = (value: string, maximum: number): string | null => {
  const trimmed = value.trim();
  const hasControlCharacter = Array.from(trimmed).some(character => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  return trimmed.length >= 1 && trimmed.length <= maximum && !hasControlCharacter
    ? trimmed
    : null;
};

const normalized = (value: string): string => normalizeDialogue(value).toLowerCase()
  .replace(/[’]/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();

const matchesPhrase = (input: string, phrases: readonly string[]): boolean => {
  const value = normalized(input);
  return phrases.some(phrase => value === normalized(phrase));
};

const birthDate = (input: string, today = new Date()): string | null => {
  const value = input.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return date.getTime() <= todayUtc ? value : null;
};

const gender = (input: string): 'male' | 'female' | null => {
  const words = normalized(input).split(' ');
  if (words.includes('female')) return 'female';
  if (words.includes('male')) return 'male';
  return null;
};

@Injectable()
export class IdCardApplicationService {
  constructor(private readonly content: IdCardApplicationContentService) {}

  async opening(client: PoolClient, userId: string): Promise<string | null> {
    const application = await this.load(client, userId);
    if (!application) return null;
    return (await this.content.get()).prompts[application.current_field];
  }

  async summary(client: PoolClient, userId: string): Promise<IdCardApplicationSummary | undefined> {
    const application = await this.load(client, userId);
    if (!application || !['photo', 'review'].includes(application.current_field) || !application.name ||
      !application.date_of_birth || !application.gender || !application.origin) return undefined;
    const dateOfBirth = application.date_of_birth instanceof Date
      ? `${application.date_of_birth.getFullYear()}-${String(application.date_of_birth.getMonth() + 1).padStart(2, '0')}-${String(application.date_of_birth.getDate()).padStart(2, '0')}`
      : application.date_of_birth;
    return { step: application.current_field as 'photo' | 'review', name: application.name, dateOfBirth,
      address: application.address, gender: application.gender, origin: application.origin };
  }

  async reply(client: PoolClient, userId: string, input: string, arrival: ArrivalState): Promise<ApplicationReply | null> {
    const content = await this.content.get();
    let application = await this.load(client, userId);
    if (!application) {
      if (!matchesPhrase(input, content.registrationPhrases)) return null;
      application = await this.start(client, userId);
      return this.result(application.current_field, content.prompts.name, arrival, 'register_id_card');
    }
    if (matchesPhrase(input, content.cancellationPhrases)) {
      await this.clear(client, userId);
      return this.result('cancelled', content.cancelled, arrival, 'cancel_id_card_application');
    }

    const current = application.current_field;
    if (current === 'photo') {
      if (/^(?:yes|yes please|yes issue my card|correct|that is correct)$/i.test(input.trim())) {
        const reply = this.result(current, 'Thank you. I will issue your ID card now.', arrival, 'confirm_id_card_application');
        return { ...reply, metadata: { ...reply.metadata, idCardSubmit: true } };
      }
      return this.result(current, content.prompts.photo, arrival, 'await_id_card_photo');
    }
    if (current === 'review') {
      if (/^(?:no|nope|not correct|that is wrong)$/i.test(input.trim())) {
        await this.update(client, userId, 'correction', null, null);
        return this.result('correction', content.prompts.correction, arrival, 'correct_id_card_application');
      }
      return this.result(current, content.prompts.review, arrival, 'review_id_card_application');
    }
    if (current === 'correction') {
      const field = this.correctionField(input);
      if (!field) return this.result(current, content.retries.correction, arrival, null);
      await this.update(client, userId, field, null, null);
      return this.result(field, content.prompts[field], arrival, 'select_id_card_correction');
    }

    const parsed = current === 'name' ? plainText(input, 60)
      : current === 'dateOfBirth' ? birthDate(input)
        : current === 'address' ? (matchesPhrase(input, content.addressNullPhrases) ? null : plainText(input, 120))
          : current === 'gender' ? gender(input)
            : plainText(input, 60);
    const validNullAddress = current === 'address' && matchesPhrase(input, content.addressNullPhrases);
    if (parsed === null && !validNullAddress) return this.result(current, content.retries[current], arrival, null);

    const next = this.next(current);
    await this.update(client, userId, next, current, parsed);
    return this.result(next, content.prompts[next], arrival, `save_id_card_${current}`);
  }

  async review(client: PoolClient, userId: string, photo: 'uploaded photo' | 'character picture',
    arrival: ArrivalState): Promise<ApplicationReply> {
    const application = await this.load(client, userId);
    if (!application || application.current_field !== 'photo' || !application.name || !application.date_of_birth ||
      !application.gender || !application.origin) {
      throw new ConflictException('Complete the ID card questions before reviewing the application');
    }
    const dateOfBirth = application.date_of_birth instanceof Date
      ? `${application.date_of_birth.getFullYear()}-${String(application.date_of_birth.getMonth() + 1).padStart(2, '0')}-${String(application.date_of_birth.getDate()).padStart(2, '0')}`
      : application.date_of_birth;
    const values = { name: application.name, dateOfBirth, address: application.address ?? 'Not provided',
      gender: application.gender, origin: application.origin, photo };
    const content = await this.content.get();
    const responseText = content.reviewTemplate.replace(/\{(name|dateOfBirth|address|gender|origin|photo)\}/g,
      (_, key: keyof typeof values) => values[key]);
    await this.update(client, userId, 'review', null, null);
    return this.result('review', responseText, arrival, 'review_id_card_application');
  }

  clear(client: PoolClient, userId: string): Promise<void> {
    return client.query('DELETE FROM public.id_card_applications WHERE user_id=$1', [userId]).then(() => undefined);
  }

  private async load(client: PoolClient, userId: string): Promise<IdCardApplicationRow | null> {
    const result = await client.query<IdCardApplicationRow>(`SELECT current_field,name,date_of_birth,address,gender,origin
      FROM public.id_card_applications WHERE user_id=$1 FOR UPDATE`, [userId]);
    return result.rows[0] ?? null;
  }

  private async start(client: PoolClient, userId: string): Promise<IdCardApplicationRow> {
    const result = await client.query<IdCardApplicationRow>(`INSERT INTO public.id_card_applications (user_id,current_field)
      VALUES ($1,'name') ON CONFLICT (user_id) DO UPDATE SET updated_at=now()
      RETURNING current_field,name,date_of_birth,address,gender,origin`, [userId]);
    return result.rows[0]!;
  }

  private async update(client: PoolClient, userId: string, next: IdCardApplicationField,
    field: Exclude<IdCardApplicationField, 'photo' | 'review' | 'correction'> | null, value: string | null): Promise<void> {
    const columns: Record<Exclude<IdCardApplicationField, 'photo' | 'review' | 'correction'>, string> = {
      name: 'name', dateOfBirth: 'date_of_birth', address: 'address', gender: 'gender', origin: 'origin',
    };
    if (!field) {
      await client.query('UPDATE public.id_card_applications SET current_field=$2,updated_at=now() WHERE user_id=$1', [userId, next]);
      return;
    }
    await client.query(`UPDATE public.id_card_applications SET current_field=$2,${columns[field]}=$3,updated_at=now() WHERE user_id=$1`,
      [userId, next, value]);
  }

  private next(field: Exclude<IdCardApplicationField, 'photo' | 'review' | 'correction'>): IdCardApplicationField {
    return ({ name: 'dateOfBirth', dateOfBirth: 'address', address: 'gender', gender: 'origin', origin: 'photo' } as const)[field];
  }

  private correctionField(input: string): Exclude<IdCardApplicationField, 'photo' | 'review' | 'correction'> | null {
    const value = normalized(input);
    if (value.includes('date of birth') || value === 'birth date') return 'dateOfBirth';
    if (value.includes('where') && value.includes('come from') || value === 'origin') return 'origin';
    for (const field of ['name', 'address', 'gender'] as const) if (value.includes(field)) return field;
    return null;
  }

  private result(nodeId: string, responseText: string, arrival: ArrivalState, intent: string | null): ApplicationReply {
    return { nodeId: `tax_office_application_${nodeId}`, responseText,
      metadata: { arrival, intent, misunderstood: false } };
  }
}

