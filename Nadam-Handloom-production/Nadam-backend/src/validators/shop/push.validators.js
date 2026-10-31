// Request shapes for /api/v2/shop/push.
import { z } from 'zod';
import { PUSH_TOPICS } from '../../config/constants.js';
import { pushToken } from './common.js';

const topics = z.array(z.enum(PUSH_TOPICS, { error: 'Unknown notification topic.' })).max(PUSH_TOPICS.length);

export const subscribeBody = z.object({ token: pushToken, topics: topics.optional() });
export const tokenBody = z.object({ token: pushToken });
export const topicsBody = z.object({ token: pushToken, topics });
