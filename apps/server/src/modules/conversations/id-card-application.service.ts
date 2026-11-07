import { ConflictException, Injectable } from '@nestjs/common';
import { isIdCardConfirmation, normalizeDialogue, type IdCardApplicationField, type IdCardApplicationSummary, type TurnMetadata } from '@life-abroad/shared';
import type { PoolClient } from 'pg';
import type { ArrivalState } from '@life-abroad/shared';
import { IdCardApplicationContentService } from './id-card-application-content.service';
import { parseIdCardBirthDate } from './id-card-birth-date';

export interface IdCardApplicationRow {
  current_field: IdCardApplicationField;
  name: string | null;
  date_of_birth: string | Date | null;
  address: string | null;
  gender: 'male' | 'female' | null;
  origin: string | null;
}

type EditableApplicationField = Exclude<IdCardApplicationField, 'gender' | 'photo' | 'review' | 'correction'>;
type CorrectionField = EditableApplicationField | 'photo';
type NextApplicationField = 'dateOfBirth' | 'address' | 'origin' | 'photo';

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
  .replace(/[^a-z0-9]+/g, ' ').trim();

const matchesPhrase = (input: string, phrases: readonly string[]): boolean => {
  const value = normalized(input);
  return phrases.some(phrase => value === normalized(phrase));
};

const matchesIntentPhrase = (input: string, phrases: readonly string[]): boolean => {
  const value = normalized(input);
  const rejectsRegistration = /(?:don't|do not|dont|not) (?:want|need|wish|plan) to (?:register|apply|get)/.test(value);
  return !rejectsRegistration && phrases.some(phrase => {
    const intent = normalized(phrase);
    return value === intent || value.includes(` ${intent} `) || value.startsWith(`${intent} `) || value.endsWith(` ${intent}`);
  });
};

const containsPhrase = (input: string, phrases: readonly string[]): boolean => {
  const value = normalized(input);
  return phrases.some(phrase => {
    const target = normalized(phrase);
    return value === target || value.includes(` ${target} `) || value.startsWith(`${target} `) || value.endsWith(` ${target}`);
  });
};

const addressUnavailable = (input: string, phrases: readonly string[]): boolean => {
  if (containsPhrase(input, phrases)) return true;
  const value = normalized(input);
  const mentionsAddress = /\b(?:address|permanent address|place to live|accommodation)\b/.test(value);
  const unavailable = /\b(?:dont|do not) (?:currently |still )?have\b|\bhave no\b|\bdont know\b|\bno permanent address\b/.test(value);
  return mentionsAddress && unavailable;
};

@Injectable()
export class IdCardApplicationService {
  constructor(private readonly content: IdCardApplicationContentService) {}

  async opening(client: PoolClient, userId: string): Promise<string | null> {
    const application = await this.load(client, userId);
    if (!application) return null;
    if (application.current_field === 'gender') {
      await this.syncCharacterGender(client, userId, 'origin');
      return (await this.content.get()).prompts.origin;
    }
    return (await this.content.get()).prompts[application.current_field];
  }

  async summary(client: PoolClient, userId: string): Promise<IdCardApplicationSummary | undefined> {
    const application = await this.load(client, userId);
    if (!application || !['photo', 'review'].includes(application.current_field) || !application.name ||
      !application.date_of_birth || !application.gender || !application.origin) return undefined;
    const dateOfBirth = application.date_of_birth instanceof Date
      ? `${application.date_of_birth.getFullYear()}-${String(application.date_of_birth.getMonth() + 1).padStart(2, '0')}-${String(application.date_of_birth.getDate()).padStart(2, '0')}`
      : application.date_of_birth;
    return { step: application.current_field as 'photo' | 'review', mode: await this.hasCard(client, userId) ? 'edit' : 'create', name: application.name, dateOfBirth,
      address: application.address, gender: application.gender, origin: application.origin };
  }

  async reply(client: PoolClient, userId: string, input: string, arrival: ArrivalState): Promise<ApplicationReply | null> {
    const content = await this.content.get();
    let application = await this.load(client, userId);
    if (!application) {
      if (await this.hasCard(client, userId)) {
        const field = this.correctionField(input);
        if (field) {
          await this.startEdit(client, userId, field);
          return this.result(field, content.correctionPrompts[field], arrival, 'select_id_card_correction');
        }
        if (matchesIntentPhrase(input, content.registrationPhrases)) {
          return this.result('existing', content.prompts.alreadyIssued, arrival, 'id_card_already_issued');
        }
        if (/\b(?:edit|update|change)\b/.test(normalized(input))) {
          await this.startEdit(client, userId, 'correction');
          return this.result('correction', content.prompts.existing, arrival, 'edit_existing_id_card');
        }
        return null;
      }
      if (!matchesIntentPhrase(input, content.registrationPhrases)) return null;
      application = await this.start(client, userId);
      return this.result(application.current_field, content.prompts.name, arrival, 'register_id_card');
    }
    if (matchesPhrase(input, content.cancellationPhrases)) {
      await this.clear(client, userId);
      return this.result('cancelled', content.cancelled, arrival, 'cancel_id_card_application');
    }

    if (application.current_field === 'gender') {
      await this.syncCharacterGender(client, userId, 'origin');
      return this.result('origin', content.prompts.origin, arrival, 'use_character_gender');
    }
    const current = application.current_field;
    if (current === 'photo') {
      const photo = matchesPhrase(input, ['use my character picture']) ? 'character picture'
        : matchesPhrase(input, ['use this photo']) ? 'uploaded photo' : null;
      if (photo && await this.hasCard(client, userId)) {
        const reply = this.result(current, content.prompts.updating, arrival, 'confirm_id_card_application');
        return { ...reply, metadata: { ...reply.metadata, idCardSubmit: true } };
      }
      if (photo) return this.review(client, userId, photo, arrival);
      return this.result(current, content.prompts.photo, arrival, 'await_id_card_photo');
    }
    if (current === 'review') {
      if (isIdCardConfirmation(input)) {
        const reply = this.result(current, 'Thank you. I will issue your ID card now.', arrival, 'confirm_id_card_application');
        return { ...reply, metadata: { ...reply.metadata, idCardSubmit: true } };
      }
      const field = this.correctionField(input);
      if (field) {
        await this.update(client, userId, field, null, null);
        return this.result(field, content.correctionPrompts[field], arrival, 'select_id_card_correction');
      }
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
      return this.result(field, content.correctionPrompts[field], arrival, 'select_id_card_correction');
    }

    const answerField = current as EditableApplicationField;
    const hasNoAddress = answerField === 'address' && addressUnavailable(input, content.addressNullPhrases);
    const parsed = answerField === 'name' ? plainText(input, 60)
      : answerField === 'dateOfBirth' ? parseIdCardBirthDate(input)
        : answerField === 'address' ? (hasNoAddress ? null : plainText(input, 120))
          : plainText(input, 60);
    const validNullAddress = answerField === 'address' && hasNoAddress;
    if (answerField === 'address' && normalized(input) === 'skip') {
      return this.result(answerField, content.retries.address, arrival, null);
    }
    if (parsed === null && !validNullAddress) return this.result(answerField, content.retries[answerField], arrival, null);

    if (await this.hasCard(client, userId)) {
      await this.applyEdit(client, userId, answerField, parsed);
      const reply = this.result('updated', content.prompts.updated, arrival, `update_id_card_${answerField}`);
      return { ...reply, metadata: { ...reply.metadata, idCardApplicationCleared: true } };
    }
    if (application.origin !== null) {
      await this.update(client, userId, 'review', answerField, parsed);
      return this.review(client, userId, 'selected photo', arrival);
    }
    const next = this.next(answerField);
    await this.update(client, userId, next, answerField, parsed);
    const responseText = validNullAddress ? content.prompts.addressNotProvided : content.prompts[next];
    return this.result(next, responseText, arrival, `save_id_card_${answerField}`);
  }

  async review(client: PoolClient, userId: string, photo: 'uploaded photo' | 'character picture' | 'selected photo',
    arrival: ArrivalState): Promise<ApplicationReply> {
    const application = await this.load(client, userId);
    if (!application || !['photo', 'review'].includes(application.current_field) || !application.name || !application.date_of_birth ||
      !application.gender || !application.origin) {
      throw new ConflictException('Complete the ID card questions before reviewing the application');
    }
    const dateOfBirth = application.date_of_birth instanceof Date
      ? `${application.date_of_birth.getFullYear()}-${String(application.date_of_birth.getMonth() + 1).padStart(2, '0')}-${String(application.date_of_birth.getDate()).padStart(2, '0')}`
      : application.date_of_birth;
    const content = await this.content.get();
    if (application.address && addressUnavailable(application.address, content.addressNullPhrases)) {
      await client.query('UPDATE public.id_card_applications SET address=NULL,updated_at=now() WHERE user_id=$1', [userId]);
      application.address = null;
    }
    const values = { name: application.name, dateOfBirth, address: application.address ?? 'Not provided',
      gender: application.gender, origin: application.origin, photo };
    const responseText = content.reviewTemplate.replace(/\{(name|dateOfBirth|address|gender|origin|photo)\}/g,
      (_, key: keyof typeof values) => values[key]);
    await this.update(client, userId, 'review', null, null);
    const result = this.result('review', responseText, arrival, 'review_id_card_application');
    return { ...result, metadata: { ...result.metadata, speechText: content.prompts.review } };
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
    const result = await client.query<IdCardApplicationRow>(`INSERT INTO public.id_card_applications (user_id,current_field,gender)
      SELECT $1,'name',gender FROM public.characters WHERE user_id=$1
      ON CONFLICT (user_id) DO UPDATE SET gender=excluded.gender,updated_at=now()
      RETURNING current_field,name,date_of_birth,address,gender,origin`, [userId]);
    if (!result.rows[0]) throw new ConflictException('Complete character creation before applying for an ID card');
    return result.rows[0]!;
  }

  private async hasCard(client: PoolClient, userId: string): Promise<boolean> {
    const result = await client.query('SELECT 1 FROM public.player_id_card WHERE user_id=$1', [userId]);
    return result.rows.length > 0;
  }

  private async startEdit(client: PoolClient, userId: string, field: CorrectionField | 'correction'): Promise<void> {
    const result = await client.query(`INSERT INTO public.id_card_applications
      (user_id,current_field,name,date_of_birth,address,gender,origin)
      SELECT user_id,$2,full_name,birth_date,address,gender,origin
      FROM public.player_id_card WHERE user_id=$1
      ON CONFLICT (user_id) DO UPDATE SET current_field=excluded.current_field,name=excluded.name,
        date_of_birth=excluded.date_of_birth,address=excluded.address,gender=excluded.gender,
        origin=excluded.origin,updated_at=now()`, [userId, field]);
    if (result.rowCount !== 1) throw new ConflictException('ID card is unavailable');
  }

  private async applyEdit(client: PoolClient, userId: string, field: EditableApplicationField,
    value: string | null): Promise<void> {
    const columns: Record<EditableApplicationField, string> = {
      name: 'full_name', dateOfBirth: 'birth_date', address: 'address', origin: 'origin',
    };
    await client.query(`UPDATE public.player_id_card SET ${columns[field]}=$2,updated_at=now() WHERE user_id=$1`, [userId, value]);
    await this.clear(client, userId);
  }

  private async update(client: PoolClient, userId: string, next: IdCardApplicationField,
    field: EditableApplicationField | null, value: string | null): Promise<void> {
    const columns: Record<EditableApplicationField, string> = {
      name: 'name', dateOfBirth: 'date_of_birth', address: 'address', origin: 'origin',
    };
    if (!field) {
      await client.query('UPDATE public.id_card_applications SET current_field=$2,updated_at=now() WHERE user_id=$1', [userId, next]);
      return;
    }
    await client.query(`UPDATE public.id_card_applications SET current_field=$2,${columns[field]}=$3,updated_at=now() WHERE user_id=$1`,
      [userId, next, value]);
  }

  private next(field: EditableApplicationField): NextApplicationField {
    return ({ name: 'dateOfBirth', dateOfBirth: 'address', address: 'origin', origin: 'photo' } as const)[field];
  }

  private correctionField(input: string): CorrectionField | null {
    const value = normalized(input);
    if (value.includes('photo') || value.includes('picture') || value.includes('image')) return 'photo';
    if (value.includes('date of birth') || value === 'birth date' || value.includes('birthday')) return 'dateOfBirth';
    if (value.includes('where') && value.includes('come from') || value === 'origin' || value.includes('country')) return 'origin';
    for (const field of ['name', 'address'] as const) if (value.includes(field)) return field;
    return null;
  }

  private async syncCharacterGender(client: PoolClient, userId: string, next: IdCardApplicationField): Promise<void> {
    const result = await client.query(`UPDATE public.id_card_applications application
      SET gender=character.gender,current_field=$2,updated_at=now()
      FROM public.characters character
      WHERE application.user_id=$1 AND character.user_id=application.user_id`, [userId, next]);
    if (result.rowCount !== 1) throw new ConflictException('Complete character creation before applying for an ID card');
  }

  private result(nodeId: string, responseText: string, arrival: ArrivalState, intent: string | null): ApplicationReply {
    return { nodeId: `tax_office_application_${nodeId}`, responseText,
      metadata: { arrival, intent, misunderstood: false } };
  }
}

