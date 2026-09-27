import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const usageTypeSchema = z.object({
  shareOfServiceCostPercent: z.number(),
  unblendedCostUsd: z.number(),
  usageType: z.string(),
});

const dataSourceSchema = z.object({
  cachedAt: z.string().optional(),
  source: z.enum(['exact-cache', 'live-aws', 'similar-cache']),
});

const artifactInputSchema = z.object({
  dataSource: dataSourceSchema,
  estimated: z.boolean(),
  period: z.object({
    endDate: z.string(),
    startDate: z.string(),
  }),
  service: z.string().min(1),
  serviceUnblendedCostUsd: z.number(),
  topUsageTypes: z.array(usageTypeSchema),
});

const artifactOutputSchema = z.object({
  id: z.string(),
  markdown: z.string(),
  service: z.string(),
  title: z.string(),
});

export const awsCostServiceArtifactTool = createTool({
  id: 'create-aws-service-cost-artifact',
  description:
    'Create a Markdown cost-analysis artifact from a returned service usage breakdown. This is local-only and never calls AWS.',
  inputSchema: artifactInputSchema,
  outputSchema: artifactOutputSchema,
  execute: async (input) => ({
    id: createArtifactId(input.service),
    markdown: createArtifactMarkdown(input),
    service: input.service,
    title: `${input.service} cost analysis`,
  }),
});

function createArtifactId(service: string) {
  return service.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '');
}

function createArtifactMarkdown(input: z.infer<typeof artifactInputSchema>) {
  const dataLabel = input.dataSource.source === 'live-aws'
    ? 'Live AWS Cost Explorer result'
    : `Local demo cache (${input.dataSource.source})`;
  const usageRows = input.topUsageTypes.length === 0
    ? '| Not available | Not available | Not available |'
    : input.topUsageTypes
      .map((usage) => (
        `| ${escapeTableCell(usage.usageType)} | $${usage.unblendedCostUsd.toFixed(2)} | ${usage.shareOfServiceCostPercent}% |`
      ))
      .join('\n');

  return `# ${input.service} cost analysis

## Billing period

- **Period:** ${input.period.startDate} to ${input.period.endDate}
- **Data:** ${dataLabel}
- **Estimated:** ${input.estimated ? 'Yes' : 'No'}
- **Service cost:** $${input.serviceUnblendedCostUsd.toFixed(2)}

## Highest-cost usage types

| Usage type | Unblended cost | Share of service cost |
| --- | ---: | ---: |
${usageRows}

## Cost-reduction hypotheses

- **Configuration or right-sizing:** Validate the largest usage type against resource-level metrics before changing capacity, retention, or traffic settings.
- **AWS alternative:** Compare the dominant usage type with an AWS architecture or pricing alternative only after confirming functional and SLA requirements.
- **Third-party or self-managed:** Consider an external or self-managed option only after validating operational overhead, migration risk, and egress economics.

## Next validation step

Collect the resource-level metric or inventory that explains the highest-cost usage type; billing data alone does not identify the underlying resource.`;
}

function escapeTableCell(value: string) {
  return value.replaceAll('|', '\\|');
}
