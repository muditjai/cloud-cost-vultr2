'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

import { AgentRunTimeline } from '@/components/agent-run-timeline';
import { AwsCostArtifacts } from '@/components/aws-cost-artifacts';
import { AwsCostSchedulePanel } from '@/components/aws-cost-schedule-panel';
import {
  awsCostAnalysisAgents,
  type AwsCostAnalysisAgentId,
} from '@/lib/aws-cost-analysis-agents';
import { AwsCostAnalysisReport } from '@/components/aws-cost-analysis-report';
import {
  Message,
  MessageContent,
} from '@/components/ai-elements/message';
import { Spinner } from '@/components/ui/spinner';

const initialAgent = awsCostAnalysisAgents[0];

function getFinalReport(messages: ReturnType<typeof useChat>['messages']) {
  return messages
    .flatMap(message => (
      message.role === 'assistant'
        ? message.parts.filter(part => part.type === 'text').map(part => part.text)
        : []
    ))
    .at(-1);
}

export function AwsCostAnalysisDashboard() {
  const [activeAgentId, setActiveAgentId] =
    useState<AwsCostAnalysisAgentId>(initialAgent.id);
  const [input, setInput] = useState<string>(initialAgent.prompt);
  const [useFreshAwsData, setUseFreshAwsData] = useState(false);
  const [transport] = useState(
    () => new DefaultChatTransport({ api: '/api/chat' }),
  );

  const { error, messages, sendMessage, setMessages, status } = useChat({
    transport,
  });

  const activeAgent = awsCostAnalysisAgents.find(
    agent => agent.id === activeAgentId,
  ) ?? initialAgent;
  const isRunning = status !== 'ready';
  const finalReport = getFinalReport(messages);

  function selectAgent(agentId: AwsCostAnalysisAgentId) {
    const nextAgent = awsCostAnalysisAgents.find(agent => agent.id === agentId);

    if (!nextAgent || agentId === activeAgentId) {
      return;
    }

    setActiveAgentId(agentId);
    setInput(nextAgent.prompt);
    setMessages([]);
  }

  async function runAnalysis() {
    const prompt = input.trim();

    if (!prompt) {
      return;
    }

    const freshData = useFreshAwsData;

    setUseFreshAwsData(false);
    await sendMessage(
      { text: prompt },
      { body: { agentId: activeAgentId, freshData } },
    );
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <header className="max-w-3xl space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Cloud financial operations</p>
          <h1 className="text-3xl font-semibold tracking-tight">Cloud FinOps agent</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Analyze AWS spend with a visible, cache-first tool chain and review the cost-optimization artifacts it produces.
          </p>
        </header>

        {isRunning ? (
          <div
            aria-live="polite"
            className="sticky top-3 z-50 rounded-lg border border-primary/25 bg-primary/95 px-4 py-3 shadow-md backdrop-blur"
            role="status"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Spinner className="text-primary" />
                <span>Agent is working</span>
              </div>
              <span className="text-xs text-muted-foreground">Streaming tool results</span>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-primary/15">
              <div className="h-full w-2/3 rounded-full bg-primary animate-pulse" />
            </div>
          </div>
        ) : null}

        <section className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm font-medium" htmlFor="analysis-agent">
                Agent
                <select
                  className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  disabled={isRunning}
                  id="analysis-agent"
                  onChange={event => selectAgent(event.target.value as AwsCostAnalysisAgentId)}
                  value={activeAgentId}
                >
                  {awsCostAnalysisAgents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isRunning || !input.trim()}
                onClick={() => void runAnalysis()}
                type="button"
              >
                {isRunning ? 'Agent running…' : 'Start agent'}
              </button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{activeAgent.description}</p>
            <label className="mt-4 block text-sm font-medium" htmlFor="analysis-prompt">
              Run instruction
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-md border bg-background p-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isRunning}
                id="analysis-prompt"
                onChange={event => setInput(event.target.value)}
                value={input}
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              {activeAgentId === 'sandbox-verification-agent'
                ? 'The verification run creates and removes disposable microVMs on the separate sandbox host.'
                : 'Read-only: no AWS resources will be changed.'}
            </p>
            <details className="mt-3 rounded-md border bg-muted/20 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">
                Run settings
              </summary>
              <AwsCostSchedulePanel
                agentId={activeAgentId}
                disabled={isRunning}
                prompt={input}
              />
              <label className="mt-4 flex cursor-pointer items-start gap-3 border-t pt-4 text-sm">
                <input
                  checked={useFreshAwsData}
                  className="mt-0.5 size-4 accent-primary"
                  disabled={isRunning}
                  onChange={event => setUseFreshAwsData(event.target.checked)}
                  type="checkbox"
                />
                <span className="font-medium">Refresh</span>
              </label>
            </details>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-semibold">Agent activity</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Expand each tool call to inspect its request, result, and status.
            </p>
          </div>
          </div>
          <div className="mt-4">
            <AgentRunTimeline messages={messages} status={status} />
          </div>
        </section>

        <AwsCostArtifacts messages={messages} />

        <section className="rounded-xl border bg-card shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Run output</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Findings and recommendations are rendered as Markdown after the agent completes.
            </p>
          </div>
          <div className="min-h-80 space-y-4 px-5 py-4">
            {!finalReport ? (
              <p className="rounded-lg border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
                Start an agent to collect billing data and generate a cost-analysis report.
              </p>
            ) : (
              <Message className="max-w-full" from="assistant">
                <MessageContent className="w-full max-w-full">
                  <AwsCostAnalysisReport>{finalReport}</AwsCostAnalysisReport>
                </MessageContent>
              </Message>
            )}
          </div>
          {error ? (
            <p className="mx-5 mb-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error.message}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
