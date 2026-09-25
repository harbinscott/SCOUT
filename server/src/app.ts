import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import type { AppConfig } from './config.js';
import { MemoryCache } from './cache/memory-cache.js';
import type { IsochroneResult } from '../../shared/types.js';
import { isochroneRequestSchema } from '../../shared/schemas.js';
import { MockIsochroneProvider } from './providers/mock-provider.js';
import { GoogleIsochroneProvider } from './providers/google-provider.js';
import { ProviderError } from './providers/provider.js';
import { ExternalCallBudget, IsochroneService } from './services/isochrone-service.js';

export function createApp(config: AppConfig) {
  const app = express();
  if (config.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  const provider = config.USE_MOCK_DATA
    ? new MockIsochroneProvider()
    : config.GOOGLE_ISOCHRONES_SERVER_KEY
      ? new GoogleIsochroneProvider(config.GOOGLE_ISOCHRONES_SERVER_KEY, config.GOOGLE_ISOCHRONES_ENDPOINT)
      : null;
  const budget = new ExternalCallBudget(
    config.MAX_EXTERNAL_CALLS_PER_HOUR,
    config.MAX_EXTERNAL_CALLS_PER_MONTH,
    config.MAX_EXTERNAL_CALLS_PER_DAY,
    config.USAGE_BUDGET_FILE,
  );
  const service = provider ? new IsochroneService(
    provider,
    new MemoryCache<IsochroneResult>(),
    config.TRAFFIC_CACHE_MINUTES * 60_000,
    config.STATIC_CACHE_DAYS * 86_400_000,
    budget,
  ) : null;
  const apiPath = `${config.BASE_PATH}/api`;

  app.get(`${config.BASE_PATH}/health`, (_request, response) => {
    response.json({ ok: true, mode: config.USE_MOCK_DATA ? 'mock' : service ? 'live' : 'configuration-required' });
  });

  app.get(`${apiPath}/status`, (_request, response) => {
    response.json({
      mode: config.USE_MOCK_DATA ? 'mock' : service ? 'live' : 'configuration-required',
      mapsBrowserKey: config.GOOGLE_MAPS_BROWSER_KEY || undefined,
      isochronesConfigured: Boolean(config.GOOGLE_ISOCHRONES_SERVER_KEY),
      basePath: config.BASE_PATH,
      apiVersion: 'v1-preview',
      externalCallsThisHour: budget.count(),
      externalCallLimit: config.MAX_EXTERNAL_CALLS_PER_HOUR,
      externalCallsToday: budget.dailyCount(),
      externalCallDailyLimit: config.MAX_EXTERNAL_CALLS_PER_DAY,
      externalCallsThisMonth: budget.monthlyCount(),
      externalCallMonthlyLimit: config.MAX_EXTERNAL_CALLS_PER_MONTH,
    });
  });

  const limiter = rateLimit({
    windowMs: 60_000,
    limit: config.RATE_LIMIT_PER_MINUTE,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'LOCAL_RATE_LIMIT', message: 'Too many commute requests. Please wait a moment and try again.' } },
  });

  app.post(`${apiPath}/isochrones`, limiter, async (request, response) => {
    const parsed = isochroneRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: { code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message || 'Invalid commute request.' } });
      return;
    }
    if (!service) {
      response.status(503).json({ error: { code: 'CONFIGURATION_REQUIRED', message: 'Add a server Isochrones credential or enable mock mode.' } });
      return;
    }
    try {
      response.json(await service.generate(parsed.data));
    } catch (error) {
      if (error instanceof ProviderError) {
        response.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
      }
      console.error('Isochrone request failed', error instanceof Error ? error.message : 'Unknown error');
      response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The commute area could not be generated.' } });
    }
  });

  if (config.NODE_ENV === 'production') {
    const clientDirectory = path.resolve(process.cwd(), 'dist/client');
    app.use(config.BASE_PATH, express.static(clientDirectory, { index: false, maxAge: '1h' }));
    app.get(`${config.BASE_PATH}/{*path}`, (_request, response) => response.sendFile(path.join(clientDirectory, 'index.html')));
    if (config.BASE_PATH) app.get('/', (_request, response) => response.redirect(`${config.BASE_PATH}/`));
  }

  return app;
}
