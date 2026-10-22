import { Badge, Text } from '@/components/ui';
import { STATUS_BADGE, STATUS_LABEL } from './PayPublic.constants';
import type { PayStatusLineProps } from './PayPublic.types';

/**
 * What state this request is in, and what to do about it.
 *
 * The badge's colour is never the message. The label says the state in words and the
 * sentence says the next move, so the page still reads correctly in greyscale, in a
 * screenshot, through a screen reader, and to anyone who cannot tell the yellow from
 * the green.
 */
export function PayStatusLine({ status, step }: PayStatusLineProps) {
  return (
    <div className="space-y-2">
      <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>
      <Text variant="body" color="secondary" as="p">
        {step}
      </Text>
    </div>
  );
}
