import { CostExplorerClient } from '@aws-sdk/client-cost-explorer';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { z } from 'zod';

export const awsCostServices = [
  'Amazon Elastic Load Balancing',
  'Amazon Relational Database Service',
  'Amazon CloudFront',
  'Amazon Simple Storage Service',
  'AmazonCloudWatch',
] as const;

export type AwsCostService = (typeof awsCostServices)[number];

export const costExplorer = new CostExplorerClient({
  credentials: fromNodeProviderChain(),
  maxAttempts: 3,
  region: process.env.AWS_COST_EXPLORER_REGION ?? 'us-east-1',
});

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format.');

export const costPeriodInputSchema = z.object({
  endDate: dateSchema
    .optional()
    .describe('Exclusive end date. Defaults to today in UTC, excluding the current day.'),
  startDate: dateSchema
    .optional()
    .describe('Inclusive start date. Defaults to the first day of the current month in UTC.'),
});

export type CostPeriodInput = z.infer<typeof costPeriodInputSchema>;
export interface CostPeriod {
  endDate: string;
  startDate: string;
}

export function getCostPeriod(input: CostPeriodInput): CostPeriod {
  if (input.startDate && input.endDate && input.startDate >= input.endDate) {
    throw new Error('startDate must be earlier than endDate.');
  }

  if (input.startDate || input.endDate) {
    if (!input.startDate || !input.endDate) {
      throw new Error('Provide both startDate and endDate, or neither to use the default period.');
    }

    return { endDate: input.endDate, startDate: input.startDate };
  }

  const now = new Date();
  const startOfCurrentMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  if (now.getUTCDate() !== 1) {
    return {
      endDate: formatDate(now),
      startDate: formatDate(startOfCurrentMonth),
    };
  }

  const startOfPreviousMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  );

  return {
    endDate: formatDate(startOfCurrentMonth),
    startDate: formatDate(startOfPreviousMonth),
  };
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function toCurrency(value: number): number {
  return Number(value.toFixed(2));
}

export function toPercentage(value: number, total: number): number {
  return total === 0 ? 0 : Number(((value / total) * 100).toFixed(2));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
