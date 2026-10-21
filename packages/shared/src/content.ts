import { z } from 'zod';
import { dialogueMetadataSchema } from './dialogue/metadata';

const identifier = z.string().regex(/^[a-z][a-z0-9_]*$/);
const text = z.string().refine((value) => value.trim().length > 0, 'Text must not be blank');
const level = z.enum(['A1', 'A2', 'B1', 'B2', 'C1']);
const gender = z.enum(['female', 'male']);
const azureVoice = z.string().regex(/^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/);
const azureStyle = z.enum(['cheerful', 'sad']);
export const moodIdSchema = z.enum(['neutral', 'happy', 'hungry', 'stressed', 'tired', 'relaxed', 'sleepy', 'sad', 'upset', 'angry']);

export const moodTypeSchema = z.object({
  id: moodIdSchema,
  label: text,
  guidance: text,
}).strict();
export const moodCatalogSchema = z.array(moodTypeSchema).length(10)
  .refine(uniqueIds, 'Mood IDs must be unique')
  .refine(moods => moodIdSchema.options.every(id => moods.some(mood => mood.id === id)), 'Mood catalog must contain every required mood');

const moodTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const exceptionalMoodRuleSchema = z.object({
  mood: z.enum(['sad', 'upset', 'angry']),
  start: moodTimeSchema,
  end: moodTimeSchema,
  chancePercent: z.number().int().min(1).max(100),
}).strict().refine(rule => rule.start !== rule.end, 'Exceptional mood window cannot be empty');

export const npcMoodRulesSchema = z.object({
  morningHappy: z.boolean().optional(),
  middayMood: z.enum(['hungry', 'stressed']).optional(),
  lateSleepy: z.boolean().optional(),
  mealOffsetMinutes: z.number().int().min(-120).max(120).optional(),
  energyOffsetMinutes: z.number().int().min(-120).max(120).optional(),
  sleepOffsetMinutes: z.number().int().min(-120).max(120).optional(),
  exceptional: z.array(exceptionalMoodRuleSchema).max(2).optional(),
}).strict();

export const voicePoolsSchema = z.object({
  version: z.literal(1),
  voices: z.object({
    female: z.array(azureVoice).min(1).refine(values => new Set(values).size === values.length, 'Female voices must be unique'),
    male: z.array(azureVoice).min(1).refine(values => new Set(values).size === values.length, 'Male voices must be unique'),
  }).strict(),
  voiceOverrides: z.record(identifier, azureVoice),
  styleSupport: z.record(azureVoice, z.array(azureStyle)
    .refine(values => new Set(values).size === values.length, 'Voice styles must be unique')),
}).strict().superRefine((value, context) => {
  const configuredVoices = new Set([
    ...value.voices.female,
    ...value.voices.male,
    ...Object.values(value.voiceOverrides),
  ]);
  for (const voice of Object.keys(value.styleSupport)) {
    if (!configuredVoices.has(voice)) {
      context.addIssue({
        code: 'custom',
        path: ['styleSupport', voice],
        message: 'Style support voice must exist in a pool or override',
      });
    }
  }
});

export const npcPortraitSchema = z.object({
  imageUrl: z.string().regex(/^npcs\/[a-z0-9_]+\/portraits\.png$/),
  index: z.number().int().nonnegative(),
  columns: z.number().int().positive(),
  rows: z.number().int().positive(),
}).strict().refine(
  portrait => portrait.index < portrait.columns * portrait.rows,
  'NPC portrait index must fit inside its grid',
);

const profileList = z.array(text).min(1).max(12)
  .refine(values => new Set(values).size === values.length, 'NPC profile values must be unique');
const weekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const scheduleSlotSchema = z.object({
  days: z.array(weekdaySchema).min(1).refine(days => new Set(days).size === days.length, 'Schedule days must be unique'),
  start: moodTimeSchema,
  end: moodTimeSchema,
  locationId: identifier,
}).strict().refine(slot => slot.start !== slot.end, 'Schedule window cannot be empty');
export const presenceScheduleSchema = z.object({
  timeZoneSource: z.literal('player_country'),
  weeklySlots: z.array(scheduleSlotSchema).min(1),
}).strict().superRefine((schedule, context) => {
  const minutes = (value: string): number => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const occupied = new Map<string, Array<[number, number]>>();
  for (const [index, slot] of schedule.weeklySlots.entries()) for (const day of slot.days) {
    const start = minutes(slot.start);
    const end = minutes(slot.end);
    const windows: Array<[string, number, number]> = start < end
      ? [[day, start, end]]
      : [[day, start, 1440], [weekdaySchema.options[(weekdaySchema.options.indexOf(day) + 1) % 7]!, 0, end]];
    for (const [windowDay, windowStart, windowEnd] of windows) {
      const key = `${slot.locationId}:${windowDay}`;
      const existing = occupied.get(key) ?? [];
      if (existing.some(([from, to]) => windowStart < to && windowEnd > from)) {
        context.addIssue({ code: 'custom', path: ['weeklySlots', index], message: 'Schedule slots cannot overlap' });
      }
      existing.push([windowStart, windowEnd]);
      occupied.set(key, existing);
    }
  }
});

export const npcProfileSchema = z.object({
  profileVersion: z.literal(1),
  job: text.optional(),
  age: z.number().int().min(18).max(120).optional(),
  hometown: text.optional(),
  family: profileList.optional(),
  hobbies: profileList.optional(),
  favouriteFood: text.optional(),
  likes: profileList.optional(),
  dislikes: profileList.optional(),
  conversationTopics: profileList.optional(),
  temperament: text.optional(),
  dailyRoutine: profileList.optional(),
  moodRules: npcMoodRulesSchema.optional(),
  presenceSchedule: presenceScheduleSchema.optional(),
}).strict();

export const townSeedSchema = z.object({
  id: identifier,
  isStarterCity: z.literal(true),
  name: text,
  description: text,
  locations: z.array(z.object({ id: identifier, name: text, type: identifier }).strict())
    .min(1).refine(uniqueIds, 'Location IDs must be unique'),
}).strict();

function uniqueIds<T extends { id: string }>(values: T[]): boolean {
  return new Set(values.map(({ id }) => id)).size === values.length;
}

export const npcSchema = z.object({
  id: identifier,
  name: text,
  gender,
  role: identifier,
  personality: identifier,
  speakingLevel: level,
  locationId: identifier,
  bio: text,
  profile: npcProfileSchema,
  walkImageUrl: z.string().regex(/^npcs\/[a-z0-9_]+\/walk\.png$/).optional(),
  portrait: npcPortraitSchema.optional(),
}).strict();

export const questStepSchema = z.object({
  id: identifier,
  description: text,
  doneWhen: z.object({ intent: identifier, alternativeIntents: z.array(identifier).min(1).optional() }).strict(),
}).strict();

export const questSchema = z.object({
  id: identifier,
  title: text,
  requiredLevel: level,
  npcId: identifier,
  rewards: z.object({ xp: z.number().int().nonnegative(), coins: z.number().int().nonnegative() }).strict(),
  steps: z.array(questStepSchema).min(1).refine(uniqueIds, 'Step IDs must be unique within a quest'),
}).strict();

export const dialogueNodeSchema = dialogueMetadataSchema.extend({
  id: identifier,
  text: z.object({ default: text }).catchall(text),
  variations: z.array(text).min(2).optional(),
  intents: z.array(z.object({
    name: identifier,
    keywords: z.array(text).min(1),
    next: identifier,
  }).strict()).optional(),
  fallback: identifier.optional(),
  completesStep: identifier.optional(),
  end: z.boolean().optional(),
}).strict();

const dialogueFields = {
  version: z.number().int().positive(),
  nodes: z.array(dialogueNodeSchema).min(1).refine(uniqueIds, 'Node IDs must be unique within a file'),
};

// Scope determines which reference is required; global files have neither.
export const dialogueSchema = z.discriminatedUnion('scope', [
  z.object({ ...dialogueFields, scope: z.literal('global') }).strict(),
  z.object({ ...dialogueFields, scope: z.literal('role'), role: identifier }).strict(),
  z.object({ ...dialogueFields, scope: z.literal('npc'), npcId: identifier }).strict(),
]);

export const npcCatalogSchema = z.array(npcSchema).min(1).refine(uniqueIds, 'NPC IDs must be unique');
export const questCatalogSchema = z.array(questSchema).min(1).refine(uniqueIds, 'Quest IDs must be unique');

const mapPointSchema = z.object({ x: z.number().min(0).max(1536), y: z.number().min(0).max(1024) }).strict();
const streetRouteSchema = z.object({ id: identifier, points: z.array(mapPointSchema).min(10).max(15) }).strict();
const streetNpcSchema = npcSchema.extend({
  job: text,
  walkImageUrl: z.string().regex(/^npcs\/[a-z0-9_]+\/walk\.png$/),
  frame: z.literal('walk'),
  portrait: npcPortraitSchema,
  voice: z.enum(['female', 'male']),
  routeId: identifier,
  startWaypoint: z.number().int().nonnegative(),
  stationary: z.boolean().default(false),
  topics: z.array(identifier).min(3).refine(values => new Set(values).size === values.length, 'NPC topics must be unique'),
}).strict();
export const streetNpcContentSchema = z.object({
  version: z.literal(2),
  routes: z.array(streetRouteSchema).min(1).refine(uniqueIds, 'Street route IDs must be unique'),
  npcs: z.array(streetNpcSchema).min(10).max(20).refine(uniqueIds, 'Street NPC IDs must be unique'),
}).strict().superRefine((catalog, context) => {
  const routes = new Map(catalog.routes.map(route => [route.id, route]));
  for (const [index, npc] of catalog.npcs.entries()) {
    const route = routes.get(npc.routeId);
    if (!route) context.addIssue({ code: 'custom', path: ['npcs', index, 'routeId'], message: `Unknown street route ${npc.routeId}` });
    else if (npc.startWaypoint >= route.points.length) context.addIssue({ code: 'custom', path: ['npcs', index, 'startWaypoint'], message: 'Start waypoint must be part of the NPC route' });
    if (npc.locationId !== 'loc_town_street') context.addIssue({ code: 'custom', path: ['npcs', index, 'locationId'], message: 'Street NPCs must belong to loc_town_street' });
  }
});

export const shopSchema = z.enum(['cafe', 'clothes']);
export const shopItemSchema = z.object({
  id: identifier,
  name: text,
  kind: z.enum(['drink', 'food', 'clothing']),
  price: z.number().int().positive().max(2147483647),
  shop: shopSchema,
  color: z.enum(['blue', 'green', 'red', 'yellow']).optional(),
  image: z.string().regex(/^\/images\/shops\/[a-z0-9_-]+\.(?:png|webp|svg)$/).optional(),
}).strict();
export const shopCatalogSchema = z.array(shopItemSchema).refine(uniqueIds, 'Shop item IDs must be unique');

export const shopOrderItemSchema = z.object({
  itemId: identifier, name: text, quantity: z.number().int().positive(), unitPrice: z.number().int().positive(),
}).strict();
export const shopOrderSchema = z.object({
  id: z.string().uuid(), shop: shopSchema, items: z.array(shopOrderItemSchema).min(1),
  total: z.number().int().positive(), createdAt: z.string().datetime(),
}).strict().refine(order => order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) === order.total,
  'Shop order total must match its item snapshots');
export const shopOrderListSchema = z.array(shopOrderSchema).max(10);

export type Shop = z.infer<typeof shopSchema>;
export type ShopItem = z.infer<typeof shopItemSchema>;
export type ShopOrder = z.infer<typeof shopOrderSchema>;

export type NpcContent = z.infer<typeof npcSchema>;
export type NpcProfile = z.infer<typeof npcProfileSchema>;
export type NpcMoodRules = z.infer<typeof npcMoodRulesSchema>;
export type MoodId = z.infer<typeof moodIdSchema>;
export type MoodType = z.infer<typeof moodTypeSchema>;
export type StreetNpcContent = z.infer<typeof streetNpcSchema>;
export type StreetNpcCatalog = z.infer<typeof streetNpcContentSchema>;
export type QuestContent = z.infer<typeof questSchema>;
export type DialogueContent = z.infer<typeof dialogueSchema>;
export type VoicePools = z.infer<typeof voicePoolsSchema>;
