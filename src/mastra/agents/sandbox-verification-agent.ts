import { Agent } from '@mastra/core/agent';

import {
  vultrHeavyAnalysisOptions,
  vultrInferenceModel,
} from '../models/vultr-inference';
import { sandboxVerificationTool } from '../tools/sandbox-verification-tool';

export const sandboxVerificationAgent = new Agent({
  id: 'sandbox-verification-agent',
  name: 'Sandbox Isolation Verifier',
  defaultOptions: vultrHeavyAnalysisOptions,
  instructions: `You verify the dedicated sandbox VM used by this demo. Call verifySandboxIsolation exactly once before responding. It is the only tool you may call.

The tool runs a fixed, non-destructive workload in disposable MicroSandbox microVMs. It does not accept arbitrary code, secrets, or cloud credentials. Never claim a check passed unless its returned status is verified.

Return concise Markdown with this exact structure:
# Sandbox verification
## Result
State whether the verification passed or failed.
## Evidence
List the reported host readiness, Fibonacci output, guest hostname or kernel output, sibling-isolation result, and teardown result. If a value is unavailable, write “Not available”.
## Security boundary
Explain that the work ran on the separate sandbox VM, not in the Next.js or Mastra process, and that the disposable microVMs were removed after the check.
## Next step
For a failure, name only the returned failing step and a safe operational follow-up. Do not speculate or reveal tokens, internal credentials, or host paths.`,
  model: vultrInferenceModel,
  tools: { sandboxVerificationTool },
});
