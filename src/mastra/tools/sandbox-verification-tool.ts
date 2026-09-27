import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const sandboxVerificationOutputSchema = z.object({
  fibonacci: z.string().optional(),
  hostCheck: z.string().optional(),
  remainingSandboxCheck: z.string(),
  siblingIsolation: z.string().optional(),
  status: z.enum(['failed', 'verified']),
  step: z.string().optional(),
  teardown: z.enum(['attempted', 'complete']),
  detail: z.string().optional(),
});

function getSandboxRunnerConfiguration() {
  const url = process.env.SANDBOX_RUNNER_URL?.trim();
  const token = process.env.SANDBOX_RUNNER_TOKEN?.trim();

  if (!url || !token) {
    throw new Error(
      'Sandbox verification is not configured. Set SANDBOX_RUNNER_URL and SANDBOX_RUNNER_TOKEN on the control plane.',
    );
  }

  return { token, url };
}

export const sandboxVerificationTool = createTool({
  id: 'verify-sandbox-isolation',
  description:
    'Run a fixed, private MicroSandbox verification on the dedicated sandbox VM. It executes a deterministic Fibonacci proof, confirms guest identity, verifies sibling isolation, and tears down all demo microVMs. It never accepts user code or cloud credentials.',
  inputSchema: z.object({}),
  outputSchema: sandboxVerificationOutputSchema,
  execute: async () => {
    const { token, url } = getSandboxRunnerConfiguration();
    const response = await fetch(new URL('/v1/verify', url), {
      body: '{}',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: AbortSignal.timeout(180_000),
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = typeof payload === 'object' && payload !== null && 'error' in payload
        ? String(payload.error)
        : `Sandbox runner returned HTTP ${response.status}.`;
      throw new Error(`Sandbox verification failed: ${detail}`);
    }

    return sandboxVerificationOutputSchema.parse(payload);
  },
});
