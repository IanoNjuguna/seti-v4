import { StateMessage, Text } from '@/components/ui';

export interface ClaimFormStatusProps {
  /** The in-flight line ("waiting for your wallet", "saving your claim"), or null. */
  progress: string | null;
  /** The server's refusal, or null when the claim has not been refused. */
  error: string | null;
  errorTitle: string;
  /**
   * The support reference for the refusal — the server's request id, already
   * labelled — or null when the server sent none.
   *
   * Printed BESIDE the reason, never instead of it: the reason is what the person
   * acts on, and the reference is what they quote when they cannot act on it. It is
   * the pairing the graceful-fault pattern exists for — the server logs the whole
   * fault against this id and hands the client a stable sentence, so a report lands
   * on the exact log line.
   */
  reference?: string | null;
}

/**
 * What the claim is doing, and why it stopped — split out so the form stays a
 * list of decisions rather than markup.
 *
 * `signing` and `submitting` are the caller's distinct sentences because they
 * fail differently: a wallet prompt that was dismissed is not a backend refusal,
 * and conflating them sends people hunting for the wrong problem.
 *
 * The in-flight line is a `role="status"` live region: signing a claim moves into
 * a wallet prompt the page cannot see, so the only feedback a person gets is this
 * sentence — and without the role, a screen reader was told nothing at all while
 * it changed. The button below already carries the spinner, so this line carries
 * the words and not a second indicator.
 */
export function ClaimFormStatus({ progress, error, errorTitle, reference }: ClaimFormStatusProps) {
  return (
    <>
      {progress ? (
        <Text variant="body" as="p" color="secondary" role="status">
          {progress}
        </Text>
      ) : null}

      {error ? (
        <div className="space-y-2">
          <StateMessage variant="failure" title={errorTitle} body={error} />
          {reference ? (
            <Text variant="micro" as="p" color="secondary" className="break-all">
              {reference}
            </Text>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
