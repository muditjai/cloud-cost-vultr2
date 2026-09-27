import { GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  costExplorer,
  costPeriodInputSchema,
  getCostPeriod,
  sum,
  toCurrency,
  toPercentage,
} from '../lib/aws-cost-explorer';
import { getCachedCostExplorerResponse } from '../lib/aws-cost-query-cache';

const costAnalysisInputSchema = costPeriodInputSchema.extend({
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe('Number of highest-cost services to return.'),
  refresh: z
    .boolean()
    .default(false)
    .describe('Bypass the local cache and query AWS Cost Explorer now. Use only for an explicitly requested refresh.'),
});

const costAnalysisOutputSchema = z.object({
  dataSource: z.object({
    cachedAt: z.string().optional(),
    source: z.enum(['exact-cache', 'live-aws', 'similar-cache']),
  }),
  estimated: z.boolean(),
  period: z.object({
    endDate: z.string(),
    startDate: z.string(),
  }),
  topServices: z.array(
    z.object({
      service: z.string(),
      shareOfTotalPercent: z.number(),
      unblendedCostUsd: z.number(),
    })
  ),
  topServicesShareOfTotalPercent: z.number(),
  topServicesUnblendedCostUsd: z.number(),
  totalUnblendedCostUsd: z.number(),
});

export const awsCostAnalysisTool = createTool({
  id: 'analyze-aws-costs',
  description:
    'Get the highest-cost AWS services and total unblended cost for a date range. This read-only tool excludes credits and refunds.',
  inputSchema: costAnalysisInputSchema,
  outputSchema: costAnalysisOutputSchema,
  execute: async (input) => getAwsCostAnalysis(input),
});

async function getAwsCostAnalysis(
  input: z.infer<typeof costAnalysisInputSchema>
): Promise<z.infer<typeof costAnalysisOutputSchema>> {
  const period = getCostPeriod(input);

  try {
    const cachedResult = await getCachedCostExplorerResponse(
      { groupBy: 'SERVICE', period },
      () =>
        costExplorer.send(
          new GetCostAndUsageCommand({
            Filter: {
              Not: {
                Dimensions: {
                  Key: 'RECORD_TYPE',
                  Values: ['Credit', 'Refund'],
                },
              },
            },
            Granularity: 'MONTHLY',
            GroupBy: [{ Key: 'SERVICE', Type: 'DIMENSION' }],
            Metrics: ['UnblendedCost'],
            TimePeriod: {
              End: period.endDate,
              Start: period.startDate,
            },
          })
        ),
      { refresh: input.refresh }
    );

    const response = cachedResult.response;
    const costsByService = new Map<string, number>();
    let estimated = false;

    for (const result of response.ResultsByTime ?? []) {
      estimated ||= result.Estimated ?? false;

      for (const group of result.Groups ?? []) {
        const service = group.Keys?.[0];
        const amount = Number(group.Metrics?.UnblendedCost?.Amount ?? 0);

        if (!service || !Number.isFinite(amount)) {
          continue;
        }

        costsByService.set(service, (costsByService.get(service) ?? 0) + amount);
      }
    }

    const services = [...costsByService.entries()]
      .map(([service, amount]) => ({ service, amount }))
      .sort((first, second) => second.amount - first.amount);
    const totalUnblendedCostUsd = sum(services.map(({ amount }) => amount));

    const topServices = services.slice(0, input.limit);
    const topServicesUnblendedCostUsd = sum(
      topServices.map(({ amount }) => amount)
    );

    return {
      dataSource: cachedResult.cache,
      estimated,
      period,
      topServices: topServices.map(({ service, amount }) => ({
        service,
        shareOfTotalPercent: toPercentage(amount, totalUnblendedCostUsd),
        unblendedCostUsd: toCurrency(amount),
      })),
      topServicesShareOfTotalPercent: toPercentage(
        topServicesUnblendedCostUsd,
        totalUnblendedCostUsd
      ),
      topServicesUnblendedCostUsd: toCurrency(topServicesUnblendedCostUsd),
      totalUnblendedCostUsd: toCurrency(totalUnblendedCostUsd),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AWS error';
    throw new Error(`Unable to retrieve AWS cost data: ${message}`);
  }
}
