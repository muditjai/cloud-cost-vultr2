import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { GetCostAndUsageCommandOutput } from '@aws-sdk/client-cost-explorer';

import type { AwsCostService, CostPeriod } from './aws-cost-explorer';

const CACHE_FILE_NAME = 'aws-cost-explorer-cache.json';
const CACHE_PATH = path.join(process.cwd(), '.cache', CACHE_FILE_NAME);
const CACHE_VERSION = 1;
const CURRENT_PERIOD_TTL_MS = 6 * 60 * 60 * 1000;
const HISTORICAL_PERIOD_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

type CachedCostExplorerResponse = Pick<
  GetCostAndUsageCommandOutput,
  'ResultsByTime'
>;

interface CacheEntry {
  cachedAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  response: CachedCostExplorerResponse;
}

interface CacheFile {
  entries: Record<string, CacheEntry>;
  version: number;
}

export interface CostExplorerCacheQuery {
  groupBy: 'SERVICE' | 'USAGE_TYPE';
  period: CostPeriod;
  service?: AwsCostService;
}

let entries: Record<string, CacheEntry> | undefined;
let cacheWriteQueue = Promise.resolve();
const inFlightRequests = new Map<string, Promise<CachedCostExplorerResponse>>();

export async function getCachedCostExplorerResponse(
  query: CostExplorerCacheQuery,
  fetchResponse: () => Promise<CachedCostExplorerResponse>
): Promise<CachedCostExplorerResponse> {
  const key = createCacheKey(query);
  const cache = await getEntries();
  const now = Date.now();
  const cachedEntry = cache[key];

  if (cachedEntry && cachedEntry.expiresAt > now) {
    cachedEntry.lastAccessedAt = now;
    return cachedEntry.response;
  }

  const pendingRequest = inFlightRequests.get(key);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = fetchAndCacheResponse(key, query.period, fetchResponse);
  inFlightRequests.set(key, request);

  try {
    return await request;
  } finally {
    inFlightRequests.delete(key);
  }
}

async function fetchAndCacheResponse(
  key: string,
  period: CostPeriod,
  fetchResponse: () => Promise<CachedCostExplorerResponse>
): Promise<CachedCostExplorerResponse> {
  const response = await fetchResponse();
  const now = Date.now();
  const cache = await getEntries();

  cache[key] = {
    cachedAt: now,
    expiresAt: now + getCacheTtl(period),
    lastAccessedAt: now,
    response,
  };

  try {
    await saveEntries(cache);
  } catch (error) {
    console.warn('Unable to persist the local AWS Cost Explorer cache.', error);
  }

  return response;
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

    if (file.version !== CACHE_VERSION || !file.entries) {
      return {};
    }

    return pruneExpiredEntries(file.entries);
  } catch (error) {
    if (isMissingFileError(error)) {
      return {};
    }

    console.warn('Unable to read the local AWS Cost Explorer cache.', error);
    return {};
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
  return period.endDate >= formatDate(new Date())
    ? CURRENT_PERIOD_TTL_MS
    : HISTORICAL_PERIOD_TTL_MS;
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
