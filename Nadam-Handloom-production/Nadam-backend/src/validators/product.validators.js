// Request shapes for the product and tag endpoints. Messages are plain English for the app.
import { z } from 'zod';
import { normalizeTag, TAG_PATTERN } from '../utils/tags.js';
import { CHANNELS, LIMITS } from '../services/product.service.js';
import { pageFields } from '../utils/page.js';

const ref = (label) => z.string().min(6, `Unknown ${label}.`).max(64, `Unknown ${label}.`).regex(/^[A-Za-z0-9_-]+$/, `Unknown ${label}.`);
export const tag = z.string({ error: 'Scan or type the tag.' })
  .transform(normalizeTag)
  .pipe(z.string().min(1, 'Scan or type the tag.').regex(TAG_PATTERN, 'That doesn\'t look like a tag. Scan it again or type the number on it.'));

export const idParams = z.object({ id: z.uuid('Unknown saree.') });
export const tagParams = z.object({ id: z.uuid('Unknown saree.'), pieceId: z.uuid('Unknown tag.') });
export const photoParams = z.object({ id: z.uuid('Unknown saree.'), photoId: z.uuid('Unknown photo.') });
export const codeParams = z.object({ code: z.string().min(1).max(80) });

export const listQuery = z.object({
  q: z.string().max(100).default(''),
  filter: z.enum(['all', 'instock', 'soldout', 'nophoto', 'online', 'store']).default('all'),
  subcategoryId: z.uuid().optional(),
  ...pageFields,
});

// A set's tags (one per saree, same photo). The form sends them comma-separated.
const tagList = z.preprocess(
  (v) => (typeof v === 'string' ? v.split(',') : v),
  z.array(z.string()).transform((a) => a.map((x) => x.trim()).filter(Boolean)).pipe(z.array(tag)
    .min(1, 'Scan or type the tag.')
    .max(LIMITS.tagsPerSaree, `Up to ${LIMITS.tagsPerSaree} tags on one saree.`)
    .refine((a) => new Set(a).size === a.length, 'The same tag is in the list twice.')),
);

// One listing (multipart form: these fields plus the "photo" file). `tags` for this
// app; older builds send one `tag`.
export const createBody = z.object({
  subcategoryId: z.uuid('Choose a subcategory.'),
  tag: tag.optional(),
  tags: tagList.optional(),
  channel: z.enum(CHANNELS).default('both'),
  clientRef: ref('saree').optional(),
  batchId: ref('batch').optional(),
}).refine((v) => v.tag || v.tags, { message: 'Scan or type the tag.', path: ['tag'] })
  .transform(({ tag: one, tags, ...rest }) => ({ ...rest, tags: tags ?? [one] }));

export const addTagsBody = z.object({ codes: tagList });

export const checkBody = z.object({ codes: z.array(z.string().max(80)).min(1).max(60) });
export const codeBody = z.object({ code: tag });

const detail = z.union([z.null(), z.string().max(60, 'Keep it under 60 characters.')]).optional();
export const patchBody = z.object({
  subcategoryId: z.uuid('Choose a subcategory.').optional(),
  channel: z.enum(CHANNELS).optional(),
  bestSeller: z.boolean().optional(),
  details: z.object({
    color: detail, fabric: detail, borderStyle: detail, technique: detail, blouseType: detail, zariTier: detail, purity: detail, pattern: detail,
    occasion: z.array(z.string().max(40)).max(10).optional(),
  }).strict().optional(),
}).refine((v) => Object.keys(v).length > 0, 'Nothing to change.');

export const photoOrderBody = z.object({ ids: z.array(z.uuid()).min(1).max(5) });
