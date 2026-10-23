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
 *   node scripts/smoke.mjs --receive          # the four receive tools, end to end
 *
 * `--receive` needs SETI_API_BASE_URL and NO token: the receive tools authenticate with
 * the payee's own signature. It generates a throwaway wallet in this process, signs the
 * typed data the server hands back, creates a charge, fetches it, resolves its link and
 * lists it, then proves a signature from a DIFFERENT wallet is refused with a code.
 * That is the whole property: this script stands in for a human's wallet, and the
 * server never sees a key.
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
  const out = { call: null, args: {}, expectError: false, receive: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--call') out.call = argv[i + 1];
    if (argv[i] === '--args') out.args = JSON.parse(argv[i + 1]);
    if (argv[i] === '--expect-error') out.expectError = true;
    if (argv[i] === '--receive') out.receive = true;
  }
  return out;
}

const { call, args, expectError, receive } = parseArgs(process.argv.slice(2));

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

/**
 * The four receive tools, driven the way a host would: call, read the text content,
 * decide. Each `tools/call` gets its own id so a late response cannot be mistaken for
 * the current one.
 */
async function callTool(name, toolArgs, expectIsError = false) {
  const id = nextId();
  send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: toolArgs } });
  const result = await awaitResponse(id, 45_000);
  if (!result) fail(`no response to tools/call ${name}`);
  if (result.error) fail(`tools/call ${name} returned a protocol error: ${JSON.stringify(result.error)}`);

  const text = (result.result?.content ?? [])
    .map((c) => (c.type === 'text' ? c.text : `<${c.type}>`))
    .join('\n');
  const isError = Boolean(result.result?.isError);

  if (isError && !expectIsError) fail(`${name} reported an error result: ${text}`);
  if (!isError && expectIsError) fail(`${name} was expected to be refused, and was not: ${text}`);

  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  return { text, isError, payload };
}

let nextIdValue = 10;
function nextId() {
  nextIdValue += 1;
  return nextIdValue;
}

if (receive) {
  if (!process.env.SETI_API_BASE_URL) {
    fail('--receive needs SETI_API_BASE_URL (the API to drive). No token is required or used.');
  }
  const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts');

  const wallet = privateKeyToAccount(generatePrivateKey());
  const stranger = privateKeyToAccount(generatePrivateKey());
  const recipient = wallet.address.toLowerCase();
  const chainId = Number(process.env.TEMPO_CHAIN_ID === '4217' ? 4217 : 42431);

  console.log(`\n--- receive: an agent asks to be paid ---`);
  console.log(`    wallet in this script: ${recipient} (the server never sees its key)`);

  // 1. Ask what to sign. Nothing is written.
  const asked = await callTool('seti_create_payment_request', {
    recipient,
    amount: '12.500000',
    memo: 'smoke: an invoice from an agent',
    expiresInMinutes: 30,
    network: chainId === 4217 ? 'mainnet' : 'testnet',
  });
  const plan = asked.payload;
  const signedFields = {
    recipient,
    amount: plan?.typedData?.message?.amount,
    asset: plan?.typedData?.message?.asset,
    memo: plan?.typedData?.message?.memo,
    expiresAt: plan?.typedData?.message?.expiresAt,
    id: plan?.typedData?.message?.id,
    nonce: plan?.typedData?.message?.nonce,
    network: chainId === 4217 ? 'mainnet' : 'testnet',
  };
  if (!plan?.needsSignature) fail('create_payment_request did not answer with the typed data to sign');
  if (plan.wrote !== false) fail('create_payment_request reported a write on the unsigned call');
  if (plan.chainId !== chainId) fail(`the typed data is for chain ${plan.chainId}, expected ${chainId}`);
  console.log(`ok    unsigned call returns the typed data and writes nothing (id ${plan.typedData.message.id})`);

  // 2. Sign it, as the human's wallet would, and create the charge.
  const signature = await wallet.signTypedData(plan.typedData);
  const created = await callTool('seti_create_payment_request', { ...signedFields, signature });
  const charge = created.payload?.charge;
  if (!charge?.id) fail(`create_payment_request did not create a charge: ${created.text}`);
  console.log(`ok    signed call created ${charge.id}  ${created.payload.pageUrl}`);
  console.log(`        seti uri: ${created.payload.uri}`);

  // 3. Fetch it.
  const fetched = await callTool('seti_get_charge', { id: charge.id });
  if (fetched.payload?.charge?.id !== charge.id) fail('get_charge did not return the charge it was asked for');
  console.log(`ok    get_charge -> ${fetched.payload.charge.status}`);

  // 4. Resolve the link a human pastes back.
  const resolved = await callTool('seti_resolve_pay_link', { link: created.payload.pageUrl });
  if (resolved.payload?.charge?.id !== charge.id) fail('resolve_pay_link did not resolve the page link to the charge');
  const resolvedUri = await callTool('seti_resolve_pay_link', { link: created.payload.uri });
  if (resolvedUri.payload?.charge?.id !== charge.id) fail('resolve_pay_link did not resolve the seti:// URI');
  console.log('ok    resolve_pay_link -> the same charge, from the page link and from the URI');

  // 5. List them: the payee's own set, signed.
  const listPlan = await callTool('seti_list_received', {
    recipient,
    limit: 10,
    network: chainId === 4217 ? 'mainnet' : 'testnet',
  });
  if (!listPlan.payload?.needsSignature) fail('list_received did not answer with the typed data to sign');
  if (listPlan.payload.read !== false) fail('list_received reported a read on the unsigned call');
  const listSignature = await wallet.signTypedData({
    ...listPlan.payload.typedData,
    message: { ...listPlan.payload.typedData.message, limit: BigInt(listPlan.payload.typedData.message.limit) },
  });
  const listed = await callTool('seti_list_received', {
    recipient,
    limit: 10,
    network: chainId === 4217 ? 'mainnet' : 'testnet',
    issuedAt: listPlan.payload.typedData.message.issuedAt,
    nonce: listPlan.payload.typedData.message.nonce,
    signature: listSignature,
  });
  const rows = listed.payload?.charges ?? [];
  if (!rows.some((row) => row.id === charge.id)) fail('list_received did not include the charge just created');
  console.log(`ok    list_received -> ${listed.payload.count} charge(s), including ${charge.id}`);

  // 6. A signature from the wrong wallet is a CODE, not a 500.
  const wrong = await callTool(
    'seti_create_payment_request',
    {
      ...signedFields,
      memo: plan.typedData.message.memo,
      id: `${plan.typedData.message.id.slice(0, 62)}s`,
      signature: await stranger.signTypedData(plan.typedData),
    },
    true
  );
  if (!wrong.text.includes('charge-signature-invalid')) {
    fail(`the wrong-wallet refusal did not carry the code: ${wrong.text}`);
  }
  console.log('ok    a signature from another wallet is refused with charge-signature-invalid');
  console.log(`\n    the charge this run created: ${charge.id} (${fetched.payload.charge.status})`);
}

console.log('\nAll smoke checks passed.');
child.kill();
process.exit(0);
