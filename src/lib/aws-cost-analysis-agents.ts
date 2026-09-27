export const awsCostAnalysisAgents = [
  {
    description: 'Find the five highest-cost AWS services for the current billing period.',
    id: 'aws-cost-agent',
    label: 'Analyze account bill and services',
    prompt:
      'Analyze the current AWS billing period. Identify the five highest-cost services, then deliver a prioritized, actionable cost-reduction plan. Keep detailed evidence in the service artifacts and make the final report about concrete next actions.',
  },
  {
    description: 'Run a fixed proof that disposable MicroSandbox workloads are isolated from the control plane and each other.',
    id: 'sandbox-verification-agent',
    label: 'Verify sandbox isolation',
    prompt:
      'Verify the dedicated sandbox host. Run the fixed MicroSandbox proof, show the Fibonacci and guest identity evidence, confirm sibling isolation, and confirm teardown.',
  },
  {
    description: 'Analyze load balancer usage types and cost-reduction options.',
    id: 'load-balancer-cost-agent',
    label: 'Load balancing',
    prompt:
      'Analyze Elastic Load Balancing usage for the current billing period. Explain the largest usage types and provide prioritized cost-reduction recommendations.',
  },
  {
    description: 'Analyze database usage types and cost-reduction options.',
    id: 'rds-cost-agent',
    label: 'RDS',
    prompt:
      'Analyze Amazon RDS usage for the current billing period. Explain the largest usage types and provide prioritized cost-reduction recommendations.',
  },
  {
    description: 'Analyze CDN usage types and cost-reduction options.',
    id: 'cloudfront-cost-agent',
    label: 'CloudFront',
    prompt:
      'Analyze CloudFront usage for the current billing period. Explain the largest usage types and provide prioritized cost-reduction recommendations.',
  },
  {
    description: 'Analyze object-storage usage types and cost-reduction options.',
    id: 's3-cost-agent',
    label: 'S3',
    prompt:
      'Analyze Amazon S3 usage for the current billing period. Explain the largest usage types and provide prioritized cost-reduction recommendations.',
  },
  {
    description: 'Analyze observability usage types and cost-reduction options.',
    id: 'cloudwatch-cost-agent',
    label: 'CloudWatch',
    prompt:
      'Analyze Amazon CloudWatch usage for the current billing period. Explain the largest usage types and provide prioritized cost-reduction recommendations.',
  },
] as const;

export type AwsCostAnalysisAgentId = (typeof awsCostAnalysisAgents)[number]['id'];

export function isAwsCostAnalysisAgentId(
  agentId: unknown,
): agentId is AwsCostAnalysisAgentId {
  return awsCostAnalysisAgents.some(agent => agent.id === agentId);
}
