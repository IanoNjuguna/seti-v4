'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Text } from '@/components/ui';
import { writeToClipboard } from '@/lib/clipboard';
import { formatFiat } from '@/lib/formatCurrency';
import { useShareLink } from '@/components/receive/useShareLink';
import { ASK_COPY } from './ask.constants';
import type { AskResultProps } from './ask.types';

/**
 * The link, once it exists (#465).
 *
 * The figure stays on screen because it is the thing that was just created, and the string below it is
 * the whole asset: an ask with no link is a row nobody can pay. `Copy link` and `Share` are both
 * present rather than one guessing at the other, because sharing a link to a person is a different act
 * from pasting it into a chat — and `useShareLink` already falls back to the clipboard where the OS
 * sheet does not exist, so the laptop case is covered by the same control.
 */
export function AskResult({ created, link, onAnother }: AskResultProps) {
  const share = useShareLink(ASK_COPY.resultTitle, link);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(() => {
    void writeToClipboard(link).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    });
  }, [link]);

  const amount = formatFiat(Number(created.amount), created.currency);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Text variant="micro" as="p" color="secondary">
          {ASK_COPY.resultTitle}
        </Text>
        <Text variant="balance-compact" as="p" tabular>
          {amount}
        </Text>
        <Text variant="micro" as="p" color="secondary">
          {ASK_COPY.resultBody(amount, `@${created.destinationHandle}`)}
        </Text>
        {created.memo ? (
          <Text variant="body" as="p">
            {created.memo}
          </Text>
        ) : null}
      </div>

      <Text variant="body" as="p" className="break-all">
        {link}
      </Text>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" fullWidth onClick={copy}>
          {copied ? ASK_COPY.copied : ASK_COPY.copy}
        </Button>
        <Button variant="secondary" fullWidth onClick={share.share}>
          {ASK_COPY.share}
        </Button>
      </div>

      <Button variant="secondary" onClick={onAnother}>
        {ASK_COPY.another}
      </Button>
    </div>
  );
}
