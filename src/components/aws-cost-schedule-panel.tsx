'use client'

import { useEffect, useState } from 'react'

import type { AwsCostAnalysisAgentId } from '@/lib/aws-cost-analysis-agents'
import {
  awsCostScheduleCadences,
  type AwsCostSchedule,
  type AwsCostScheduleCadence,
} from '@/lib/aws-cost-schedules'

function formatNextRun(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

export function AwsCostSchedulePanel({
  agentId,
  disabled,
  prompt,
}: {
  agentId: AwsCostAnalysisAgentId
  disabled: boolean
  prompt: string
}) {
  const [cadence, setCadence] = useState<AwsCostScheduleCadence>('weekly')
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)
  const [schedule, setSchedule] = useState<AwsCostSchedule | null>()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    let isCurrent = true

    async function loadSchedule() {
      setSchedule(undefined)
      setError(undefined)

      const response = await fetch(`/api/agent-schedules?agentId=${agentId}`)
      const data = await response.json()

      if (!isCurrent) {
        return
      }

      if (!response.ok) {
        setError(data.error ?? 'Unable to load the agent schedule.')
        return
      }

      setSchedule(data.schedule)
    }

    void loadSchedule()

    return () => {
      isCurrent = false
    }
  }, [agentId])

  async function saveSchedule() {
    setError(undefined)
    setIsSaving(true)

    try {
      const response = await fetch('/api/agent-schedules', {
        body: JSON.stringify({ agentId, cadence, prompt, timezone }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save the agent schedule.')
      }

      setSchedule(data.schedule)
    } catch (scheduleError) {
      setError(
        scheduleError instanceof Error
          ? scheduleError.message
          : 'Unable to save the agent schedule.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">Automate this agent</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Save a recurring Mastra schedule for the selected analysis.
          </p>
        </div>
        {schedule ? (
          <span className="w-fit rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {schedule.status}
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 text-sm font-medium" htmlFor="schedule-cadence">
          Cadence
          <select
            className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={disabled || isSaving}
            id="schedule-cadence"
            onChange={event => setCadence(event.target.value as AwsCostScheduleCadence)}
            value={cadence}
          >
            {awsCostScheduleCadences.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="mt-auto rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || isSaving || !prompt.trim()}
          onClick={() => void saveSchedule()}
          type="button"
        >
          {isSaving ? 'Saving…' : 'Set schedule'}
        </button>
      </div>

      {schedule ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Next run: {formatNextRun(schedule.nextFireAt)} ({schedule.timezone ?? timezone})
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Schedules are persisted by Mastra and run while this Node process is online. Each run uses the same read-only AWS tools as a manual run.
      </p>
    </section>
  )
}
