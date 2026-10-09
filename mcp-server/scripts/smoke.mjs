/**
 * Smoke test for the Seti MCP server.
 *
 * Deliberately speaks raw JSON-RPC over stdio rather than using the SDK's own
 * client: the point is to exercise the wire protocol a real MCP host will use
 * (initialize → notifications/initialized → tools/list → tools/call), so an SDK
 * change that only satisfies its own client cannot make this pass.
 *
 * Usage:
 *   npm run build && npm run smoke
 *   node scripts/smoke.mjs --call tempo_get_balance --args '{"owner":"0x…"}'
 *
 * Exit code is non-zero if the handshake fails, no tools are registered, or a
 * requested tool call comes back as an error.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, '..', 'dist', 'index.js');

function parseArgs(argv) {
  const out = { call: null, args: {}, expectError: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--call') out.call = argv[i + 1];
    if (argv[i] === '--args') out.args = JSON.parse(argv[i + 1]);
    if (argv[i] === '--expect-error') out.expectError = true;
  }
  return out;
}

const { call, args, expectError } = parseArgs(process.argv.slice(2));

const child = spawn(process.execPath, [entry], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (d) => { stdout += d.toString(); });
child.stderr.on('data', (d) => { stderr += d.toString(); });

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

/**
 * Waits for a JSON-RPC *response* with the given id, or resolves null on timeout.
 *
 * Requiring `result` or `error` to be present matters: MCP servers may also send
 * requests and notifications, and matching on `id` alone can return one of those
 * instead — which reads as an empty response and sends you debugging the server
 * rather than the harness.
 */
function awaitResponse(id, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tick = () => {
      const lines = stdout.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        const isResponse = msg.result !== undefined || msg.error !== undefined;
        if (msg.id === id && isResponse) return resolve(msg);
      }
      if (Date.now() > deadline) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });
}

const fail = (msg) => {
  console.error(`FAIL  ${msg}`);
  if (stdout.trim()) console.error(`--- raw server stdout ---\n${stdout.trim()}`);
  if (stderr.trim()) console.error(`--- server stderr ---\n${stderr.trim()}`);
  child.kill();
  process.exit(1);
};

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'seti-mcp-smoke', version: '0.0.1' },
  },
});

const init = await awaitResponse(1);
if (!init) fail('no response to initialize');
if (init.error) fail(`initialize returned an error: ${JSON.stringify(init.error)}`);

const serverInfo = init.result?.serverInfo ?? {};
console.log(`ok    initialize -> ${serverInfo.name ?? '(unnamed)'} v${serverInfo.version ?? '?'}`);
console.log(`ok    protocolVersion -> ${init.result?.protocolVersion ?? '?'}`);

send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });

const list = await awaitResponse(2);
if (!list) fail('no response to tools/list');
if (list.error) fail(`tools/list returned an error: ${JSON.stringify(list.error)}`);

const tools = list.result?.tools ?? [];
if (tools.length === 0) fail('tools/list returned zero tools');

console.log(`ok    tools/list -> ${tools.length} tools`);
for (const tool of tools) {
  const required = (tool.inputSchema?.required ?? []).join(', ');
  console.log(`        ${tool.name.padEnd(28)} ${required ? `required: ${required}` : 'no required args'}`);
}

if (call) {
  console.log(`\n--- tools/call ${call} ${JSON.stringify(args)} ---`);
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: call, arguments: args } });
  const result = await awaitResponse(3, 45_000);
  if (!result) fail(`no response to tools/call ${call}`);
  if (result.error) fail(`tools/call returned a protocol error: ${JSON.stringify(result.error)}`);
  const text = (result.result?.content ?? [])
    .map((c) => (c.type === 'text' ? c.text : `<${c.type}>`))
    .join('\n');
  console.log(text);
  // An error result is the expected outcome for the refusal paths (a missing
  // token, a bad checksum). Asserting it — rather than just observing it — is
  // what stops the success path being confused with a working failure path.
  if (result.result?.isError) {
    if (expectError) {
      console.log('\nok    tool returned the expected error result');
    } else {
      fail(`tool reported an error result for ${call}`);
    }
  }
}

console.log('\nAll smoke checks passed.');
child.kill();
process.exit(0);
