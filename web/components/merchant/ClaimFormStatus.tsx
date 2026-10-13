import { StateMessage, Text } from '@/components/ui';

export interface ClaimFormStatusProps {
  /** The in-flight line ("waiting for your wallet", "saving your claim"), or null. */
  progress: string | null;
  /** The server's refusal, or null when the claim has not been refused. */
  error: string | null;
  errorTitle: string;
}

/**
 * What the claim is doing, and why it stopped — split out so the form stays a
 * list of decisions rather than markup.
 *
 * `signing` and `submitting` are the caller's distinct sentences because they
 * fail differently: a wallet prompt that was dismissed is not a backend refusal,
 * and conflating them sends people hunting for the wrong problem.
 */
export function ClaimFormStatus({ progress, error, errorTitle }: ClaimFormStatusProps) {
  return (
    <>
      {progress ? (
        <Text variant="micro" as="p">
          {progress}
        </Text>
      ) : null}

      {error ? <StateMessage tone="alert" title={errorTitle} body={error} /> : null}
    </>
  );
}
