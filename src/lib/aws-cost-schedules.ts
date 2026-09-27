export const awsCostScheduleCadences = [
  {
    id: 'daily',
    label: 'Daily at 8:00 AM',
    cron: '0 8 * * *',
  },
  {
    id: 'weekly',
    label: 'Weekly on Monday at 8:00 AM',
    cron: '0 8 * * 1',
  },
] as const

export type AwsCostScheduleCadence =
  (typeof awsCostScheduleCadences)[number]['id']

export interface AwsCostSchedule {
  agentId: string
  cron: string
  id: string
  nextFireAt: number
  status: 'active' | 'paused'
  timezone?: string
}

export function getAwsCostScheduleCadence(
  cadence: unknown,
): (typeof awsCostScheduleCadences)[number] | undefined {
  return awsCostScheduleCadences.find(option => option.id === cadence)
}
