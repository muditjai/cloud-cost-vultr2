import type { UIMessage } from 'ai'

type TimelineStatus = 'complete' | 'current' | 'pending'

interface TimelineItem {
  detail: string
  id: string
  label: string
  status: TimelineStatus
}

function formatToolName(type: string) {
  return type
    .replace(/^tool-/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
}

function getToolTimelineItems(messages: UIMessage[]): TimelineItem[] {
  return messages.flatMap(message =>
    message.parts.flatMap((part, index) => {
      if (!part.type.startsWith('tool-')) {
        return []
      }

      const isComplete = 'state' in part && part.state === 'output-available'

      return [{
        detail: isComplete
          ? 'Billing data returned successfully.'
          : 'Querying read-only AWS billing data.',
        id: `${message.id}-${index}`,
        label: formatToolName(part.type),
        status: isComplete ? 'complete' : 'current',
      }]
    }),
  )
}

export function AgentRunTimeline({
  messages,
  status,
}: {
  messages: UIMessage[]
  status: 'error' | 'ready' | 'streaming' | 'submitted'
}) {
  const toolItems = getToolTimelineItems(messages)
  const hasStarted = status !== 'ready' || messages.length > 0
  const hasReport = messages.some(message =>
    message.role === 'assistant' && message.parts.some(part => part.type === 'text'),
  )
  const items: TimelineItem[] = [
    {
      detail: 'Validate the request and prepare the selected analyst.',
      id: 'prepare',
      label: 'Prepare agent run',
      status: hasStarted ? 'complete' : 'current',
    },
    ...toolItems,
    {
      detail: 'Turn returned billing data into findings and recommendations.',
      id: 'report',
      label: 'Generate Markdown report',
      status: hasReport ? 'complete' : hasStarted ? 'current' : 'pending',
    },
  ]

  return (
    <ol aria-label="Agent run timeline" className="space-y-4">
      {items.map((item, index) => (
        <li className="flex gap-3" key={item.id}>
          <div className="flex flex-col items-center">
            <span
              className={`flex size-7 items-center justify-center rounded-full border text-xs font-semibold ${
                item.status === 'complete'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : item.status === 'current'
                    ? 'border-primary text-primary'
                    : 'border-border text-muted-foreground'
              }`}
            >
              {item.status === 'complete' ? '✓' : index + 1}
            </span>
            {index < items.length - 1 ? <span className="mt-1 h-8 w-px bg-border" /> : null}
          </div>
          <div className="pb-2">
            <p className="text-sm font-medium">{item.label}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
