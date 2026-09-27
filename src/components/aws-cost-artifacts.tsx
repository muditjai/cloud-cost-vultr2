'use client';

import type { UIMessage } from 'ai';
import { useState } from 'react';

import { AwsCostAnalysisReport } from '@/components/aws-cost-analysis-report';
import {
  Artifact,
  ArtifactActions,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from '@/components/ai-elements/artifact';

interface AwsCostArtifact {
  id: string;
  markdown: string;
  service: string;
  title: string;
}

function isAwsCostArtifact(value: unknown): value is AwsCostArtifact {
  return (
    typeof value === 'object'
    && value !== null
    && 'id' in value
    && 'markdown' in value
    && 'service' in value
    && 'title' in value
    && typeof value.id === 'string'
    && typeof value.markdown === 'string'
    && typeof value.service === 'string'
    && typeof value.title === 'string'
  );
}

function getArtifacts(messages: UIMessage[]) {
  const artifacts = new Map<string, AwsCostArtifact>();

  for (const message of messages) {
    for (const part of message.parts) {
      if (!part.type.startsWith('tool-') || !('output' in part)) {
        continue;
      }

      if (isAwsCostArtifact(part.output)) {
        artifacts.set(part.output.id, part.output);
      }
    }
  }

  return [...artifacts.values()];
}

export function AwsCostArtifacts({ messages }: { messages: UIMessage[] }) {
  const artifacts = getArtifacts(messages);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string>();
  const selectedArtifact = artifacts.find(({ id }) => id === selectedArtifactId);

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-semibold">Produced artifacts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each service analysis becomes a Markdown artifact when its tool chain finishes.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {artifacts.length} of 5 service artifacts ready
        </p>
      </div>

      {artifacts.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed bg-muted/40 p-5 text-sm text-muted-foreground">
          Service artifacts will appear here as their analysis tool calls complete.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {artifacts.map((artifact) => (
            <Artifact key={artifact.id}>
              <ArtifactHeader>
                <div className="min-w-0">
                  <ArtifactTitle className="truncate">{artifact.service}</ArtifactTitle>
                  <ArtifactDescription className="mt-1">
                    Markdown analysis ready
                  </ArtifactDescription>
                </div>
                <ArtifactActions>
                  <button
                    className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                    onClick={() => setSelectedArtifactId(artifact.id)}
                    type="button"
                  >
                    View artifact
                  </button>
                </ArtifactActions>
              </ArtifactHeader>
            </Artifact>
          ))}
        </div>
      )}

      {selectedArtifact ? (
        <div
          aria-label={`${selectedArtifact.title} artifact`}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-xl border bg-popover p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{selectedArtifact.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Markdown artifact produced from the service usage analysis.
                </p>
              </div>
              <button
                aria-label="Close artifact"
                className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                onClick={() => setSelectedArtifactId(undefined)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="mt-5">
              <AwsCostAnalysisReport>{selectedArtifact.markdown}</AwsCostAnalysisReport>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
