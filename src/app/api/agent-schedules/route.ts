import type { AgentSchedule, AnySchedule } from '@mastra/core/schedules'
import { NextResponse } from 'next/server'

import { isAwsCostAnalysisAgentId } from '@/lib/aws-cost-analysis-agents'
import {
  getAwsCostScheduleCadence,
  type AwsCostSchedule,
} from '@/lib/aws-cost-schedules'
import { mastra } from '@/mastra'
import { getVultrInferenceConfigurationError } from '@/mastra/models/vultr-inference'

const SCHEDULE_NAME = 'AWS cost analysis'

function isSelectedAgentSchedule(
  schedule: AnySchedule,
  agentId: string,
): schedule is AgentSchedule {
  return schedule.agentId === agentId
}

function toScheduleResponse(schedule: {
  agentId?: string
  cron: string
  id: string
  nextFireAt: number
  status: 'active' | 'paused'
  timezone?: string
}): AwsCostSchedule | undefined {
  if (!schedule.agentId) {
    return undefined
  }

  return {
    agentId: schedule.agentId,
    cron: schedule.cron,
    id: schedule.id,
    nextFireAt: schedule.nextFireAt,
    status: schedule.status,
    timezone: schedule.timezone,
  }
}

export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get('agentId')

  if (!isAwsCostAnalysisAgentId(agentId)) {
    return NextResponse.json(
      { error: 'Select a supported AWS cost analysis agent.' },
      { status: 400 },
    )
  }

  const schedules = await mastra.schedules.list({ agentId })
  const schedule = schedules.find(
    (item): item is AgentSchedule =>
      isSelectedAgentSchedule(item, agentId) && item.name === SCHEDULE_NAME,
  )

  return NextResponse.json({ schedule: schedule ? toScheduleResponse(schedule) : null })
}

export async function POST(req: Request) {
  const configurationError = getVultrInferenceConfigurationError()

  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 })
  }

  const body = await req.json()
  const cadence = getAwsCostScheduleCadence(body.cadence)

  if (!isAwsCostAnalysisAgentId(body.agentId) || !cadence || typeof body.prompt !== 'string') {
    return NextResponse.json(
      { error: 'Select an agent, a supported schedule, and an analysis prompt.' },
      { status: 400 },
    )
  }

  const timezone = typeof body.timezone === 'string' ? body.timezone : undefined
  const schedules = await mastra.schedules.list({ agentId: body.agentId })
  const existing = schedules.find(
    (item): item is AgentSchedule =>
      isSelectedAgentSchedule(item, body.agentId) && item.name === SCHEDULE_NAME,
  )

  try {
    const schedule = existing
      ? await mastra.schedules.update(existing.id, {
          cron: cadence.cron,
          prompt: body.prompt.trim(),
          timezone,
        })
      : await mastra.schedules.create({
          agentId: body.agentId,
          cron: cadence.cron,
          id: `aws-cost-${body.agentId}`,
          name: SCHEDULE_NAME,
          prompt: body.prompt.trim(),
          timezone,
        })

    const activeSchedule = schedule.status === 'paused'
      ? await mastra.schedules.resume(schedule.id)
      : schedule

    return NextResponse.json({ schedule: toScheduleResponse(activeSchedule) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save the schedule.'

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
