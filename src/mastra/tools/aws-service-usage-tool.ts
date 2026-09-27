import { GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  awsCostServices,
  costExplorer,
  costPeriodInputSchema,
  getCostPeriod,
  sum,
  toCurrency,
  toPercentage,
} from '../lib/aws-cost-explorer';
import { getCachedCostExplorerResponse } from '../lib/aws-cost-query-cache';

const serviceUsageInputSchema = costPeriodInputSchema.extend({
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .describe('Number of highest-cost usage types to return.'),
  service: z
    .enum(awsCostServices)
    .describe('The AWS service to analyze.'),
});

const serviceUsageOutputSchema = z.object({
  estimated: z.boolean(),
  period: z.object({
    endDate: z.string(),
    startDate: z.string(),
  }),
  service: z.enum(awsCostServices),
  serviceUnblendedCostUsd: z.number(),
  topUsageTypes: z.array(
    z.object({
      shareOfServiceCostPercent: z.number(),
      unblendedCostUsd: z.number(),
      usageType: z.string(),
    })
  ),
});

export const awsServiceUsageTool = createTool({
  id: 'analyze-aws-service-usage',
  description:
    'Get the highest-cost AWS billing usage types for one service. This read-only tool excludes credits and refunds.',
  inputSchema: serviceUsageInputSchema,
  outputSchema: serviceUsageOutputSchema,
  execute: async (input) => {
    const period = getCostPeriod(input);

    try {
      const response = await getCachedCostExplorerResponse(
        { groupBy: 'USAGE_TYPE', period, service: input.service },
        () =>
          costExplorer.send(
            new GetCostAndUsageCommand({
              Filter: {
                And: [
                  {
                    Dimensions: {
                      Key: 'SERVICE',
                      Values: [input.service],
                    },
                  },
                  {
                    Not: {
                      Dimensions: {
                        Key: 'RECORD_TYPE',
                        Values: ['Credit', 'Refund'],
                      },
                    },
                  },
                ],
              },
              Granularity: 'MONTHLY',
              GroupBy: [{ Key: 'USAGE_TYPE', Type: 'DIMENSION' }],
              Metrics: ['UnblendedCost'],
              TimePeriod: {
                End: period.endDate,
                Start: period.startDate,
              },
            })
          )
      );

      const usageTypes = (response.ResultsByTime ?? []).flatMap((result) =>
        (result.Groups ?? []).flatMap((group) => {
          const usageType = group.Keys?.[0];
          const amount = Number(group.Metrics?.UnblendedCost?.Amount ?? 0);

          return usageType && Number.isFinite(amount) ? [{ amount, usageType }] : [];
        })
      );
      const serviceUnblendedCostUsd = sum(
        usageTypes.map(({ amount }) => amount)
      );

      return {
        estimated: (response.ResultsByTime ?? []).some(
          (result) => result.Estimated ?? false
        ),
        period,
        service: input.service,
        serviceUnblendedCostUsd: toCurrency(serviceUnblendedCostUsd),
        topUsageTypes: usageTypes
          .sort((first, second) => second.amount - first.amount)
          .slice(0, input.limit)
          .map(({ amount, usageType }) => ({
            shareOfServiceCostPercent: toPercentage(amount, serviceUnblendedCostUsd),
            unblendedCostUsd: toCurrency(amount),
            usageType,
          })),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown AWS error';
      throw new Error(`Unable to retrieve AWS service usage costs: ${message}`);
    }
  },
});
