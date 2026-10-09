#!/usr/bin/env node
/**
 * Seti MCP server (stdio).
 *
 * Exposes two tool groups:
 *  - credential-free Tempo tools (read the chain, build unsigned calldata);
 *  - Seti API tools (require SETI_API_BASE_URL + SETI_API_TOKEN; writes off by
 *    default).
 *
 * **stdout is the protocol channel.** Anything written there that is not a
 * JSON-RPC message corrupts the session for the host, so every diagnostic here
 * goes to stderr — and `console.log` is redirected outright, because a future
 * dependency logging on import is a realistic failure and it would present as a
 * mysteriously broken server.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { allowWrites, defaultNetwork, setiApiConfig } from './config.js';
import { scrub } from './errors.js';
import { registerTempoTools } from './tools/tempo.js';
import { registerSetiTools } from './tools/seti.js';

const SERVER_NAME = 'seti-mcp';
const SERVER_VERSION = '0.1.0';

// Protect the protocol channel before anything else can touch it.
console.log = (...args: unknown[]) => {
  console.error(...args);
};

function log(message: string): void {
  console.error(`[${SERVER_NAME}] ${message}`);
}

async function main(): Promise<void> {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  registerTempoTools(server);
  log('registered Tempo tools (no credentials required)');

  const setiTools = registerSetiTools(server);
  log(`registered ${setiTools.length} Seti API tools: ${setiTools.join(', ')}`);

  const api = setiApiConfig();
  log(`default network: ${defaultNetwork()} (testnet unless TEMPO_CHAIN_ID=4217)`);
  log(
    api
      ? `Seti API: ${api.baseUrl}`
      : 'Seti API: not configured — set SETI_API_BASE_URL and SETI_API_TOKEN to enable those tools'
  );
  log(
    allowWrites()
      ? 'writes: ENABLED (seti_record_payment can persist a payment)'
      : 'writes: disabled (SETI_MCP_ALLOW_WRITES is not "true")'
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('connected on stdio');
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log(`received ${signal}, exiting`);
    process.exit(0);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? scrub(error.message) : scrub(String(error));
  log(`fatal: ${message}`);
  process.exit(1);
});
