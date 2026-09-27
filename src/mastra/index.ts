
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from "@mastra/duckdb";
import { MastraCompositeStore } from '@mastra/core/storage';
import { Observability, MastraStorageExporter, MastraPlatformExporter, SensitiveDataFilter } from '@mastra/observability';
import { weatherWorkflow } from './workflows/weather-workflow';
import { awsCostAgent } from './agents/aws-cost-agent';
import {
  cloudFrontCostAgent,
  cloudWatchCostAgent,
  loadBalancerCostAgent,
  rdsCostAgent,
  s3CostAgent,
} from './agents/aws-service-cost-agents';
import { weatherAgent } from './agents/weather-agent';


export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: {
    awsCostAgent,
    cloudFrontCostAgent,
    cloudWatchCostAgent,
    loadBalancerCostAgent,
    rdsCostAgent,
    s3CostAgent,
    weatherAgent,
  },
  scheduler: {
    enabled: true,
  },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: "mastra-storage",
      // Uses a hosted database when deployed (mastra env db create --kind turso),
      // and a local file during development.
      url: process.env.TURSO_DATABASE_URL
        ?? process.env.MASTRA_DATABASE_URL
        ?? `file:${process.cwd()}/mastra.db`,
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    }
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [
          new MastraStorageExporter(), // Persists observability events to Mastra Storage
          new MastraPlatformExporter(), // Sends observability events to Mastra Platform (if MASTRA_PLATFORM_ACCESS_TOKEN is set)
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(), // Redacts sensitive data like passwords, tokens, keys
        ],
      },
    },
  }),
});
