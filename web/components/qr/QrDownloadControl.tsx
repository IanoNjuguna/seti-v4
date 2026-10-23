'use client';

import { Button, Text } from '@/components/ui';
import { useDownloadQr } from './useDownloadQr';
import type { QrDownloadControlProps } from './qr.types';

/**
 * The control that saves a code as a PNG, and the failure line it owes the customer.
 *
 * It is a control of its own rather than part of the plate because of ORDER: it used
 * to sit between the code and the name, and the name is what the code stands for. The
 * half now places it with the other actions, after the string the person is here to
 * hand over.
 *
 * A failed save is rendered, never swallowed: the browser refused a download the
 * customer asked for, and the honest next step is a screenshot, which only the failing
 * line can suggest.
 */
export function QrDownloadControl({ download, value }: QrDownloadControlProps) {
  const { state, download: save } = useDownloadQr(download.filename, value);

  return (
    <>
      <Button variant="ghost" onClick={() => void save()} loading={state === 'busy'}>
        {state === 'busy' ? download.working : download.label}
      </Button>
      {state === 'failed' ? (
        <Text variant="micro" as="p" color="alert">
          {download.failed}
        </Text>
      ) : null}
    </>
  );
}
