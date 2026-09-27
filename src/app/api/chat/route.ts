import { handleChatStream } from '@mastra/ai-sdk'
import { createUIMessageStreamResponse } from 'ai'
import { NextResponse } from 'next/server'

import { isAwsCostAnalysisAgentId } from '@/lib/aws-cost-analysis-agents'
import { mastra } from '@/mastra'
import { getVultrInferenceConfigurationError } from '@/mastra/models/vultr-inference'

const RESOURCE_ID = 'aws-cost-analysis'

export async function POST(req: Request) {
  const params = await req.json()

  if (!isAwsCostAnalysisAgentId(params.agentId)) {
    return NextResponse.json(
      { error: 'Select a supported AWS cost analysis agent.' },
      { status: 400 },
    )
  }

  const configurationError = getVultrInferenceConfigurationError()

  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 })
  }

  const stream = await handleChatStream({
    mastra,
    agentId: params.agentId,
    version: 'v7',
    params: {
      ...params,
      memory: {
        ...params.memory,
        thread: params.agentId,
        resource: RESOURCE_ID,
      },
    },
  })
  return createUIMessageStreamResponse({ stream })
}

export async function GET() {
  return NextResponse.json([])
}
