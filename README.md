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

The cost agents use a bounded heavy-analysis profile by default: up to eight
agent steps and 32,000 output tokens per model response. To use a different
budget, set an integer from 1 through 160,000 and restart the server:

```bash
VULTR_HEAVY_MAX_OUTPUT_TOKENS=32000
```

Heavy analysis uses Mastra Code Mode with an isolated QuickJS runtime. Model-
generated code can only orchestrate the registered read-only AWS tools; it has
no filesystem, shell, process, or network access.

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
