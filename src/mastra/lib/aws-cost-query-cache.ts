import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { GetCostAndUsageCommandOutput } from '@aws-sdk/client-cost-explorer';

import type { CostPeriod } from './aws-cost-explorer';

const CACHE_FILE_NAME = 'aws-cost-explorer-cache.json';
const CACHE_PATH = path.join(process.cwd(), '.cache', CACHE_FILE_NAME);
const CACHE_VERSION = 2;
const DEFAULT_CURRENT_PERIOD_TTL_HOURS = 90 * 24;
const DEFAULT_HISTORICAL_PERIOD_TTL_HOURS = 90 * 24;
const MAX_CACHE_ENTRIES = 100;

type CachedCostExplorerResponse = Pick<
  GetCostAndUsageCommandOutput,
  'ResultsByTime'
>;

interface CacheEntry {
  cachedAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  query: CostExplorerCacheQuery;
  response: CachedCostExplorerResponse;
}

interface CacheFile {
  entries: Record<string, CacheEntry | LegacyCacheEntry>;
  version: number;
}

interface LegacyCacheEntry {
  cachedAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  response: CachedCostExplorerResponse;
}

export interface CostExplorerCacheQuery {
  groupBy: 'SERVICE' | 'USAGE_TYPE';
  period: CostPeriod;
  service?: string;
}

export interface CachedCostExplorerResult {
  cache: {
    cachedAt?: string;
    source: 'cache-miss' | 'exact-cache' | 'live-aws' | 'similar-cache';
  };
  response: CachedCostExplorerResponse;
}

interface CostExplorerCacheOptions {
  refresh?: boolean;
}

export function getAwsCostCachePolicy() {
  return {
    currentPeriodTtlHours: getCacheTtlHours(
      'AWS_COST_CURRENT_PERIOD_CACHE_TTL_HOURS',
      DEFAULT_CURRENT_PERIOD_TTL_HOURS
    ),
    historicalPeriodTtlHours: getCacheTtlHours(
      'AWS_COST_HISTORICAL_CACHE_TTL_HOURS',
      DEFAULT_HISTORICAL_PERIOD_TTL_HOURS
    ),
    refreshRequiresExplicitRequest: true,
    usesCacheOnlyByDefault: true,
  };
}

let entries: Record<string, CacheEntry> | undefined;
let cacheWriteQueue = Promise.resolve();
const inFlightRequests = new Map<string, Promise<CachedCostExplorerResult>>();

export async function getCachedCostExplorerResponse(
  query: CostExplorerCacheQuery,
  fetchResponse: () => Promise<CachedCostExplorerResponse>,
  options: CostExplorerCacheOptions = {}
): Promise<CachedCostExplorerResult> {
  const key = createCacheKey(query);
  const cache = await getEntries();
  const now = Date.now();
  const cachedEntry = cache[key];

  if (!options.refresh && cachedEntry && cachedEntry.expiresAt > now) {
    return createCachedResult(cachedEntry, 'exact-cache', now);
  }

  const similarEntry = options.refresh
    ? undefined
    : findSimilarCurrentPeriodEntry(cache, query, now);

  if (similarEntry) {
    return createCachedResult(similarEntry, 'similar-cache', now);
  }

  if (!options.refresh) {
    return {
      cache: { source: 'cache-miss' },
      response: { ResultsByTime: [] },
    };
  }

  const pendingRequest = options.refresh ? undefined : inFlightRequests.get(key);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = fetchAndCacheResponse(key, query, fetchResponse);
  inFlightRequests.set(key, request);

  try {
    return await request;
  } finally {
    inFlightRequests.delete(key);
  }
}

async function fetchAndCacheResponse(
  key: string,
  query: CostExplorerCacheQuery,
  fetchResponse: () => Promise<CachedCostExplorerResponse>
): Promise<CachedCostExplorerResult> {
  const response = await fetchResponse();
  const now = Date.now();
  const cache = await getEntries();

  cache[key] = {
    cachedAt: now,
    expiresAt: now + getCacheTtl(query.period),
    lastAccessedAt: now,
    query,
    response,
  };

  try {
    await saveEntries(cache);
  } catch (error) {
    console.warn('Unable to persist the local AWS Cost Explorer cache.', error);
  }

  return {
    cache: { source: 'live-aws' },
    response,
  };
}

function createCachedResult(
  entry: CacheEntry,
  source: 'exact-cache' | 'similar-cache',
  now: number
): CachedCostExplorerResult {
  entry.lastAccessedAt = now;

  return {
    cache: {
      cachedAt: new Date(entry.cachedAt).toISOString(),
      source,
    },
    response: entry.response,
  };
}

async function getEntries(): Promise<Record<string, CacheEntry>> {
  if (entries) {
    return entries;
  }

  entries = await readEntries();
  return entries;
}

async function readEntries(): Promise<Record<string, CacheEntry>> {
  try {
    const file = JSON.parse(await readFile(CACHE_PATH, 'utf8')) as CacheFile;

    if (!file.entries) {
      return {};
    }

    if (file.version === CACHE_VERSION) {
      return pruneExpiredEntries(file.entries as Record<string, CacheEntry>);
    }

    if (file.version === 1) {
      return migrateVersionOneEntries(file.entries);
    }

    return {};
  } catch (error) {
    if (isMissingFileError(error)) {
      return {};
    }

    console.warn('Unable to read the local AWS Cost Explorer cache.', error);
    return {};
  }
}

function migrateVersionOneEntries(
  legacyEntries: Record<string, CacheEntry | LegacyCacheEntry>
): Record<string, CacheEntry> {
  const migratedEntries = Object.entries(legacyEntries).flatMap(([key, entry]) => {
    const query = parseQueryFromCacheKey(key);

    if (!query) {
      return [];
    }

    return [[key, { ...entry, query }] as const];
  });

  return pruneExpiredEntries(Object.fromEntries(migratedEntries));
}

function parseQueryFromCacheKey(key: string): CostExplorerCacheQuery | undefined {
  try {
    const value = JSON.parse(key) as Partial<CostExplorerCacheQuery>;

    if (
      (value.groupBy !== 'SERVICE' && value.groupBy !== 'USAGE_TYPE')
      || !value.period
      || typeof value.period.startDate !== 'string'
      || typeof value.period.endDate !== 'string'
    ) {
      return undefined;
    }

    return {
      groupBy: value.groupBy,
      period: value.period,
      service: value.service,
    };
  } catch {
    return undefined;
  }
}

async function saveEntries(cache: Record<string, CacheEntry>): Promise<void> {
  const prunedEntries = limitEntries(pruneExpiredEntries(cache));

  entries = prunedEntries;
  cacheWriteQueue = cacheWriteQueue
    .catch(() => undefined)
    .then(() => writeEntries(prunedEntries));

  await cacheWriteQueue;
}

async function writeEntries(entriesToWrite: Record<string, CacheEntry>): Promise<void> {
  const directory = path.dirname(CACHE_PATH);
  await mkdir(directory, { recursive: true });

  const temporaryPath = `${CACHE_PATH}.${process.pid}.tmp`;
  const file: CacheFile = {
    entries: entriesToWrite,
    version: CACHE_VERSION,
  };

  await writeFile(temporaryPath, JSON.stringify(file), 'utf8');
  await rename(temporaryPath, CACHE_PATH);
}

function createCacheKey(query: CostExplorerCacheQuery): string {
  return JSON.stringify({
    groupBy: query.groupBy,
    period: query.period,
    service: query.service ?? null,
    version: CACHE_VERSION,
  });
}

function getCacheTtl(period: CostPeriod): number {
  return getCacheTtlHours(
    period.endDate >= formatDate(new Date())
      ? 'AWS_COST_CURRENT_PERIOD_CACHE_TTL_HOURS'
      : 'AWS_COST_HISTORICAL_CACHE_TTL_HOURS',
    period.endDate >= formatDate(new Date())
      ? DEFAULT_CURRENT_PERIOD_TTL_HOURS
      : DEFAULT_HISTORICAL_PERIOD_TTL_HOURS
  ) * 60 * 60 * 1000;
}

function getCacheTtlHours(name: string, fallback: number): number {
  const configuredValue = Number(process.env[name]);

  return Number.isFinite(configuredValue) && configuredValue > 0
    ? configuredValue
    : fallback;
}

function findSimilarCurrentPeriodEntry(
  cache: Record<string, CacheEntry>,
  query: CostExplorerCacheQuery,
  now: number
): CacheEntry | undefined {
  if (!isCurrentMonth(query.period)) {
    return undefined;
  }

  return Object.values(cache)
    .filter((entry) => (
      entry.expiresAt > now
      && entry.query.groupBy === query.groupBy
      && entry.query.service === query.service
      && entry.query.period.startDate === query.period.startDate
      && isCurrentMonth(entry.query.period)
    ))
    .sort((first, second) => second.cachedAt - first.cachedAt)[0];
}

function isCurrentMonth(period: CostPeriod): boolean {
  const now = new Date();
  const currentMonthStart = formatDate(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  );

  return period.startDate === currentMonthStart;
}

function pruneExpiredEntries(
  cache: Record<string, CacheEntry>
): Record<string, CacheEntry> {
  const now = Date.now();

  return Object.fromEntries(
    Object.entries(cache).filter(([, entry]) => entry.expiresAt > now)
  );
}

function limitEntries(cache: Record<string, CacheEntry>): Record<string, CacheEntry> {
  return Object.fromEntries(
    Object.entries(cache)
      .sort(([, first], [, second]) => second.lastAccessedAt - first.lastAccessedAt)
      .slice(0, MAX_CACHE_ENTRIES)
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
