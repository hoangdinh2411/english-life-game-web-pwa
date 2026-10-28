import { ConflictException, Injectable } from '@nestjs/common';
import { isIdCardConfirmation, normalizeDialogue, type IdCardApplicationField, type IdCardApplicationSummary, type TurnMetadata } from '@life-abroad/shared';
import type { PoolClient } from 'pg';
import type { ArrivalState } from '@life-abroad/shared';
import { IdCardApplicationContentService } from './id-card-application-content.service';
import { parseIdCardBirthDate } from './id-card-birth-date';

export interface IdCardApplicationRow {
  current_field: IdCardApplicationField;
  confirmation_field: EditableApplicationField | null;
  name: string | null;
  date_of_birth: string | Date | null;
  address: string | null;
  gender: 'male' | 'female' | null;
  origin: string | null;
}

type EditableApplicationField = Exclude<IdCardApplicationField, 'gender' | 'photo' | 'review' | 'correction'>;
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
  .replace(/[’]/g, "'").replace(/[^a-z0-9']+/g, ' ').trim();

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

@Injectable()
export class IdCardApplicationService {
  constructor(private readonly content: IdCardApplicationContentService) {}

  async opening(client: PoolClient, userId: string): Promise<string | null> {
    const application = await this.load(client, userId);
    if (!application) return null;
    const content = await this.content.get();
    if (application.confirmation_field) return this.confirmationText(content.answerConfirmationTemplate, application);
    if (application.current_field === 'gender') {
      await this.syncCharacterGender(client, userId, 'origin');
      return content.prompts.origin;
    }
    return content.prompts[application.current_field];
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
    if (application.confirmation_field) {
      const field = application.confirmation_field;
      if (isIdCardConfirmation(input)) {
        const next = this.next(field);
        await this.finishConfirmation(client, userId, next);
        return this.result(next, content.prompts[next], arrival, `confirm_id_card_${field}`);
      }
      if (/^(?:no|nope|not correct|that is wrong|that's wrong)$/i.test(input.trim())) {
        await this.rejectConfirmation(client, userId, field);
        return this.result(field, content.prompts[field], arrival, `retry_id_card_${field}`);
      }
      return this.result(field, this.confirmationText(content.answerConfirmationRetry, application), arrival, null);
    }
    const current = application.current_field;
    if (current === 'photo') {
      if (isIdCardConfirmation(input)) {
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

    const answerField = current as EditableApplicationField;
    const parsed = answerField === 'name' ? plainText(input, 60)
      : answerField === 'dateOfBirth' ? parseIdCardBirthDate(input)
        : answerField === 'address' ? (containsPhrase(input, content.addressNullPhrases) ? null : plainText(input, 120))
          : plainText(input, 60);
    const validNullAddress = answerField === 'address' && containsPhrase(input, content.addressNullPhrases);
    if (answerField === 'address' && normalized(input) === 'skip') {
      return this.result(answerField, content.retries.address, arrival, null);
    }
    if (parsed === null && !validNullAddress) return this.result(answerField, content.retries[answerField], arrival, null);

    await this.saveForConfirmation(client, userId, answerField, parsed);
    const pending = { ...application, [this.column(answerField)]: parsed, confirmation_field: answerField };
    return this.result(answerField, this.confirmationText(content.answerConfirmationTemplate, pending), arrival,
      `save_id_card_${answerField}`);
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
    const result = await client.query<IdCardApplicationRow>(`SELECT current_field,confirmation_field,name,date_of_birth,address,gender,origin
      FROM public.id_card_applications WHERE user_id=$1 FOR UPDATE`, [userId]);
    return result.rows[0] ?? null;
  }

  private async start(client: PoolClient, userId: string): Promise<IdCardApplicationRow> {
    const result = await client.query<IdCardApplicationRow>(`INSERT INTO public.id_card_applications (user_id,current_field,gender)
      SELECT $1,'name',gender FROM public.characters WHERE user_id=$1
      ON CONFLICT (user_id) DO UPDATE SET gender=excluded.gender,updated_at=now()
      RETURNING current_field,confirmation_field,name,date_of_birth,address,gender,origin`, [userId]);
    if (!result.rows[0]) throw new ConflictException('Complete character creation before applying for an ID card');
    return result.rows[0]!;
  }

  private async update(client: PoolClient, userId: string, next: IdCardApplicationField,
    field: EditableApplicationField | null, value: string | null): Promise<void> {
    const columns: Record<EditableApplicationField, string> = {
      name: 'name', dateOfBirth: 'date_of_birth', address: 'address', origin: 'origin',
    };
    if (!field) {
      await client.query(`UPDATE public.id_card_applications
        SET current_field=$2,confirmation_field=null,updated_at=now() WHERE user_id=$1`, [userId, next]);
      return;
    }
    await client.query(`UPDATE public.id_card_applications
      SET current_field=$2,confirmation_field=null,${columns[field]}=$3,updated_at=now() WHERE user_id=$1`,
      [userId, next, value]);
  }

  private async saveForConfirmation(client: PoolClient, userId: string, field: EditableApplicationField,
    value: string | null): Promise<void> {
    await client.query(`UPDATE public.id_card_applications
      SET ${this.column(field)}=$3,confirmation_field=$2,updated_at=now() WHERE user_id=$1`, [userId, field, value]);
  }

  private async finishConfirmation(client: PoolClient, userId: string, next: NextApplicationField): Promise<void> {
    await client.query(`UPDATE public.id_card_applications
      SET current_field=$2,confirmation_field=null,updated_at=now() WHERE user_id=$1`, [userId, next]);
  }

  private async rejectConfirmation(client: PoolClient, userId: string, field: EditableApplicationField): Promise<void> {
    await client.query(`UPDATE public.id_card_applications
      SET ${this.column(field)}=null,confirmation_field=null,updated_at=now() WHERE user_id=$1`, [userId]);
  }

  private column(field: EditableApplicationField): 'name' | 'date_of_birth' | 'address' | 'origin' {
    return ({ name: 'name', dateOfBirth: 'date_of_birth', address: 'address', origin: 'origin' } as const)[field];
  }

  private confirmationText(template: string, application: IdCardApplicationRow): string {
    const field = application.confirmation_field;
    if (!field) return template;
    const value = field === 'name' ? application.name
      : field === 'dateOfBirth' ? this.readableDate(application.date_of_birth)
        : field === 'address' ? (application.address ?? 'you do not have an address yet')
          : application.origin;
    return template.replace('{answer}', value ?? '');
  }

  private readableDate(value: string | Date | null): string {
    if (!value) return '';
    const iso = value instanceof Date
      ? `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
      : value;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return iso;
    const month = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' })
      .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
    return `${Number(match[3])} ${month} ${match[1]}`;
  }

  private next(field: EditableApplicationField): NextApplicationField {
    return ({ name: 'dateOfBirth', dateOfBirth: 'address', address: 'origin', origin: 'photo' } as const)[field];
  }

  private correctionField(input: string): EditableApplicationField | null {
    const value = normalized(input);
    if (value.includes('date of birth') || value === 'birth date') return 'dateOfBirth';
    if (value.includes('where') && value.includes('come from') || value === 'origin') return 'origin';
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

