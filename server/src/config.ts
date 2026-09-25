import fs from 'node:fs';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3001),
  BASE_PATH: z.string().default('/scout'),
  HTTPS_ENABLED: z.string().default('false').transform((value) => value === 'true'),
  TLS_CERT_FILE: z.string().default('/app/.certs/tls.crt'),
  TLS_KEY_FILE: z.string().default('/app/.certs/tls.key'),
  USE_MOCK_DATA: z.string().default('true').transform((value) => value === 'true'),
  GOOGLE_MAPS_BROWSER_KEY: z.string().optional(),
  GOOGLE_ISOCHRONES_SERVER_KEY: z.string().optional(),
  GOOGLE_ISOCHRONES_SERVER_KEY_FILE: z.string().optional(),
  GOOGLE_ISOCHRONES_ENDPOINT: z.string().url().default('https://isochrones.googleapis.com/v1/isochrones:generate'),
  TRAFFIC_CACHE_MINUTES: z.coerce.number().positive().default(15),
  STATIC_CACHE_DAYS: z.coerce.number().positive().default(7),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
  MAX_EXTERNAL_CALLS_PER_HOUR: z.coerce.number().int().positive().default(60),
  MAX_EXTERNAL_CALLS_PER_DAY: z.coerce.number().int().positive().default(200),
  MAX_EXTERNAL_CALLS_PER_MONTH: z.coerce.number().int().positive().default(8000),
  USAGE_BUDGET_FILE: z.string().optional(),
  TRUST_PROXY: z.string().default('false').transform((value) => value === 'true'),
});

const parsed = envSchema.parse(process.env);
const normalizedBase = `/${parsed.BASE_PATH.replace(/^\/+|\/+$/g, '')}`;
const fileKey = parsed.GOOGLE_ISOCHRONES_SERVER_KEY_FILE
  ? fs.readFileSync(parsed.GOOGLE_ISOCHRONES_SERVER_KEY_FILE, 'utf8').trim()
  : undefined;

export const config = {
  ...parsed,
  GOOGLE_ISOCHRONES_SERVER_KEY: fileKey || parsed.GOOGLE_ISOCHRONES_SERVER_KEY,
  BASE_PATH: normalizedBase === '/' ? '' : normalizedBase,
};

export type AppConfig = typeof config;
