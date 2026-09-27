This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

## Environment

Set your Vultr Serverless Inference subscription API key in your local `.env`
file before running an agent. Do not use the main Vultr account API key or an
OpenAI key, and do not commit this value.

```bash
VULTR_INFERENCE_API_KEY=your_vultr_inference_api_key
```

Restart the development server after changing `.env`.

The cost agents use a bounded heavy-analysis profile by default: up to 20
agent steps and 32,000 output tokens per model response. To use a different
budget, set an integer from 1 through 160,000 and restart the server:

```bash
VULTR_HEAVY_MAX_OUTPUT_TOKENS=32000
```

### Optional sandbox verification

The **Verify sandbox isolation** agent is independent of the AWS billing flow.
It invokes a private, token-authenticated runner on the separate Vultr VX1
sandbox VM. That runner accepts no user-supplied code and runs only a fixed
Fibonacci, guest-identity, sibling-isolation, and teardown proof in disposable
MicroSandbox microVMs.

Configure these values only on the control-plane process; never commit them or
place the token in browser-accessible variables:

```bash
SANDBOX_RUNNER_URL=http://10.1.96.4:8787
SANDBOX_RUNNER_TOKEN=replace_with_a_long_random_value
```

The companion runner source and systemd unit are in `sandbox-runner/`. Bind it
to the sandbox VM's private VPC address and allow TCP 8787 only from the
control-plane private IP.

Cost analysis uses direct, streamed read-only tools so every backend operation
is visible in the dashboard. Account analysis resolves the period and cache
policy, ranks services, inspects each of the top five services, and produces a
Markdown artifact for each service.

AWS Cost Explorer results are persisted locally in `.cache/` and excluded from
Git. For the demo, an exact query and equivalent current-month queries reuse a
cached result for 90 days by default. Cache-only mode is the default: a cache
miss does not call AWS. The tool output identifies whether the data came from
AWS, an exact cache hit, a similar current-month cache hit, or a cache miss.
Set either value below to change the cache window (in hours):

```bash
AWS_COST_CURRENT_PERIOD_CACHE_TTL_HOURS=2160
AWS_COST_HISTORICAL_CACHE_TTL_HOURS=2160
```

In the dashboard, **Run settings → Refresh** is off by default. Enabling it
bypasses the cache only for that run, issues read-only Cost Explorer calls,
and updates the local cache with the result.

## Scheduled analyses

The dashboard can persist a daily or weekly schedule for any cost-analysis
agent. Schedules are stored by Mastra and use the same read-only AWS tools as
manual runs. Mastra's built-in scheduler needs a long-running Node process;
it is suitable for local development and long-lived servers, but not a
serverless process that is frozen between requests.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
