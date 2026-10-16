/**
 * Runtime chain-id probe for `rpc-guard.check.ts`.
 *
 * Spawned with an environment whose SERVED network points at a LOCAL STUB (the
 * parent starts it), this process imports the served client exactly as a booting
 * deployment does and makes TWO calls through it. It prints what the runtime
 * guard decided on each, and the parent counts how many `eth_chainId` calls the
 * stub actually saw — so the check proves both the refusal AND that the verdict
 * was cached (one call, not one per request).
 *
 * It never touches a real chain: the endpoint is the stub. The unit of this file
 * is one process, so `services/chain.ts`'s module-level cache is fresh per run.
 */
import { publicClient, RpcChainIdMismatchError } from '../services/chain.js';

function describe(error: unknown): string {
  const name = error instanceof Error ? error.name : String(error);
  const code = (error as { code?: string } | null)?.code ?? '(none)';
  const expected = (error as { expectedChainId?: number } | null)?.expectedChainId;
  const reported = (error as { reportedChainId?: number } | null)?.reportedChainId;
  const typed = error instanceof RpcChainIdMismatchError;
  const firstLine = error instanceof Error ? error.message.split('\n')[0] : '';
  return `name=${name} code=${code} expected=${expected} reported=${reported} typed=${typed} message=${firstLine}`;
}

async function main(): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      // A NON-chain-id method on purpose: the guard's own `eth_chainId` is then
      // the only one, so the parent's count of `eth_chainId` calls is exactly the
      // guard's cost, not the business call's.
      const block = await publicClient.getBlockNumber();
      process.stdout.write(`PROBE attempt=${attempt} ok block=${block}\n`);
    } catch (error) {
      process.stdout.write(`PROBE attempt=${attempt} refused ${describe(error)}\n`);
    }
  }
  process.stdout.write('PROBE_DONE\n');
}

main().catch((error) => {
  process.stdout.write(`PROBE_CRASH ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
