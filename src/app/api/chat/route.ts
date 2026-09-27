import { handleChatStream } from '@mastra/ai-sdk'
import { createUIMessageStreamResponse } from 'ai'
import { NextResponse } from 'next/server'

import { isAwsCostAnalysisAgentId } from '@/lib/aws-cost-analysis-agents'
import { mastra } from '@/mastra'
import { getVultrInferenceConfigurationError } from '@/mastra/models/vultr-inference'

const RESOURCE_ID = 'aws-cost-analysis'
const FRESH_AWS_DATA_MARKER = '[FRESH_AWS_DATA_REQUESTED]'

function addFreshDataMarker(messages: unknown) {
  if (!Array.isArray(messages)) {
    return messages
  }

  const lastMessage = messages.at(-1)

  if (
    !lastMessage
    || typeof lastMessage !== 'object'
    || lastMessage === null
    || !('role' in lastMessage)
    || lastMessage.role !== 'user'
    || !('parts' in lastMessage)
    || !Array.isArray(lastMessage.parts)
  ) {
    return messages
  }

  return [
    ...messages.slice(0, -1),
    {
      ...lastMessage,
      parts: [
        ...lastMessage.parts,
        {
          text: `\n\n${FRESH_AWS_DATA_MARKER}`,
          type: 'text',
        },
      ],
    },
  ]
}

export async function POST(req: Request) {
  const params = await req.json()
  const freshDataRequested = params.freshData === true

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
      messages: freshDataRequested
        ? addFreshDataMarker(params.messages)
        : params.messages,
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
