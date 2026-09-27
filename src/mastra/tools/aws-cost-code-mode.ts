import { createCodeMode } from '@mastra/core/tools';
import { QuickJsCodeModeTransport } from '@mastra/quickjs';
import { awsCostAnalysisTool } from './aws-cost-analysis-tool';
import { awsServiceUsageTool } from './aws-service-usage-tool';

const codeMode = createCodeMode(
  {
    id: 'runAwsCostAnalysisCode',
    timeout: 60_000,
    tools: {
      awsCostAnalysisTool,
      awsServiceUsageTool,
    },
  },
  new QuickJsCodeModeTransport({ memoryLimitMb: 64 }),
);

export const awsCostAnalysisCodeTool = codeMode.tool;
export const awsCostAnalysisCodeInstructions = codeMode.instructions;
