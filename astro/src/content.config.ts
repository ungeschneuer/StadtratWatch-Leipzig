import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import type { Registry } from '@models/registry.ts';
import type { SessionSpeech } from '@models/session-speech.ts';
import { sessionScanSchema } from '@models/session-scan.schema.ts';
import { z } from 'astro/zod';

const parliamentPeriods = defineCollection({
  loader: glob({
    pattern: '**/registry.json',
    base: '../data',
    generateId: (options) => options.data.id as string,
  }),
  schema: z.custom<Registry>(),
});

const sessionScans = defineCollection({
  loader: glob({
    pattern: '**/session-scan-*.json',
    base: '../data',
    generateId: (options) => {
      const entryParts = options.entry.split('/');
      return `${entryParts[0]}/${entryParts[1]}`;
    },
  }),
  schema: sessionScanSchema,
});

const sessionSpeeches = defineCollection({
  loader: glob({
    pattern: '**/session-speeches-*.json',
    base: '../data',
    generateId: (options) => {
      const entryParts = options.entry.split('/');
      return `${entryParts[0]}/${entryParts[1]}`;
    },
  }),
  schema: z.array(z.custom<SessionSpeech>()),
});

export const collections = {
  parliamentPeriods,
  sessionScans,
  sessionSpeeches,
};
