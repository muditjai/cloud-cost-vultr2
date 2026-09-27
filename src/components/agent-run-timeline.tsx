import type { ToolUIPart, UIMessage } from 'ai';

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';

type RunStatus = 'complete' | 'current' | 'pending';

interface ToolCall {
  id: string;
  label: string;
  part: ToolUIPart;
}

function formatToolName(type: string) {
  const name = type
    .replace(/^tool-/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2');

  const labels: Record<string, string> = {
    'aws Cost Analysis Code Tool': 'Run isolated cost-analysis code',
    'aws Cost Analysis Tool': 'Rank AWS service costs',
    'aws Cost Cache Policy Tool': 'Check demo cache policy',
    'aws Cost Period Tool': 'Resolve billing period',
    'aws Service Usage Tool': 'Inspect service usage',
  };

  return labels[name] ?? name;
}

function getToolCalls(messages: UIMessage[]): ToolCall[] {
  return messages.flatMap((message) =>
    message.parts.flatMap((part, index) => {
      if (!part.type.startsWith('tool-')) {
        return [];
      }

      return [{
        id: `${message.id}-${index}`,
        label: formatToolName(part.type),
        part: part as ToolUIPart,
      }];
    })
  );
}

function RunStep({
  detail,
  label,
  status,
}: {
  detail: string;
  label: string;
  status: RunStatus;
}) {
  const indicator = status === 'complete' ? '✓' : status === 'current' ? '•' : '–';

  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/20 px-4 py-3">
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          status === 'complete'
            ? 'bg-primary text-primary-foreground'
            : status === 'current'
              ? 'border border-primary text-primary'
              : 'border border-border text-muted-foreground'
        }`}
      >
        {indicator}
      </span>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export function AgentRunTimeline({
  messages,
  status,
}: {
  messages: UIMessage[];
  status: 'error' | 'ready' | 'streaming' | 'submitted';
}) {
  const toolCalls = getToolCalls(messages);
  const hasStarted = status !== 'ready' || messages.length > 0;
  const hasReport = messages.some((message) =>
    message.role === 'assistant' && message.parts.some((part) => part.type === 'text')
  );

  return (
    <div aria-label="Agent activity" className="space-y-3">
      <RunStep
        detail="Validate the request and prepare the selected analyst."
        label="Prepare agent run"
        status={hasStarted ? 'complete' : 'current'}
      />

      {toolCalls.map((toolCall) => {
        const toolState = toolCall.part.state ?? 'input-available';

        return (
          <Tool defaultOpen={toolState !== 'output-available'} key={toolCall.id}>
            <ToolHeader
              className="cursor-pointer"
              state={toolState}
              title={toolCall.label}
              type={toolCall.part.type}
            />
            <ToolContent>
              <ToolInput input={toolCall.part.input ?? {}} />
              <ToolOutput
                errorText={toolCall.part.errorText}
                output={toolCall.part.output}
              />
            </ToolContent>
          </Tool>
        );
      })}

      <RunStep
        detail="Turn tool results into the Markdown report and recommendations."
        label="Generate Markdown report"
        status={hasReport ? 'complete' : hasStarted ? 'current' : 'pending'}
      />
    </div>
  );
}
