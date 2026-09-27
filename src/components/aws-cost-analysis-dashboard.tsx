'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type ToolUIPart } from 'ai';
import { useState } from 'react';

import { AgentRunTimeline } from '@/components/agent-run-timeline';
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
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';

const initialAgent = awsCostAnalysisAgents[0];

export function AwsCostAnalysisDashboard() {
  const [activeAgentId, setActiveAgentId] =
    useState<AwsCostAnalysisAgentId>(initialAgent.id);
  const [input, setInput] = useState<string>(initialAgent.prompt);
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

    await sendMessage({ text: prompt }, { body: { agentId: activeAgentId } });
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <header className="max-w-3xl space-y-2">
          <p className="text-sm font-medium text-muted-foreground">AWS cost operations</p>
          <h1 className="text-3xl font-semibold tracking-tight">Run an agent, inspect every step</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Start a read-only cost analysis and follow its tool calls in order. Schedule the same agent for recurring checks.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
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
            <p className="mt-4 text-sm text-muted-foreground">{activeAgent.description}</p>
            <label className="mt-5 block text-sm font-medium" htmlFor="analysis-prompt">
              Run instruction
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-md border bg-background p-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isRunning}
                id="analysis-prompt"
                onChange={event => setInput(event.target.value)}
                value={input}
              />
            </label>
            <p className="mt-3 text-xs text-muted-foreground">Read-only: no AWS resources will be changed.</p>
          </div>

          <aside className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Agent activity</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tool calls appear here as the run progresses.</p>
            <div className="mt-5">
              <AgentRunTimeline messages={messages} status={status} />
            </div>
          </aside>
        </section>

        <AwsCostSchedulePanel
          agentId={activeAgentId}
          disabled={isRunning}
          prompt={input}
        />

        <section className="rounded-xl border bg-card shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Run output</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Findings and recommendations are rendered as Markdown after the agent completes.
            </p>
          </div>
          <div className="min-h-80 space-y-4 px-5 py-4">
            {messages.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
                Start an agent to collect billing data and generate a cost-analysis report.
              </p>
            ) : (
              messages.map(message => (
                <div key={message.id}>
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                      const isAssistantMessage = message.role === 'assistant';

                      return (
                        <Message
                          className={isAssistantMessage ? 'max-w-full' : 'hidden'}
                          key={`${message.id}-${index}`}
                          from={message.role}
                        >
                          <MessageContent className="w-full max-w-full">
                            <AwsCostAnalysisReport>{part.text}</AwsCostAnalysisReport>
                          </MessageContent>
                        </Message>
                      );
                    }

                    if (part.type.startsWith('tool-')) {
                      const toolPart = part as ToolUIPart;

                      return (
                        <Tool key={`${message.id}-${index}`}>
                          <ToolHeader
                            className="cursor-pointer"
                            state={toolPart.state || 'output-available'}
                            type={toolPart.type}
                          />
                          <ToolContent>
                            <ToolInput input={toolPart.input || {}} />
                            <ToolOutput
                              errorText={toolPart.errorText}
                              output={toolPart.output}
                            />
                          </ToolContent>
                        </Tool>
                      );
                    }

                    return null;
                  })}
                </div>
              ))
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
