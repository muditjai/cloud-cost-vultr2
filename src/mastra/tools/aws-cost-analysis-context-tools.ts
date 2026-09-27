import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  costPeriodInputSchema,
  getCostPeriod,
} from '../lib/aws-cost-explorer';
import { getAwsCostCachePolicy } from '../lib/aws-cost-query-cache';

export const awsCostPeriodTool = createTool({
  id: 'get-aws-cost-period',
  description:
    'Resolve the AWS billing date range before running a cost query. This is a local calculation and never calls AWS.',
  inputSchema: costPeriodInputSchema,
  outputSchema: z.object({
    endDate: z.string(),
    startDate: z.string(),
  }),
  execute: async (input) => getCostPeriod(input),
});

export const awsCostCachePolicyTool = createTool({
  id: 'get-aws-cost-cache-policy',
  description:
    'Read the local AWS Cost Explorer cache policy before a cost analysis. This is local-only and never calls AWS.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    currentPeriodTtlHours: z.number(),
    historicalPeriodTtlHours: z.number(),
    refreshRequiresExplicitRequest: z.boolean(),
    usesCacheOnlyByDefault: z.boolean(),
  }),
  execute: async () => getAwsCostCachePolicy(),
});
