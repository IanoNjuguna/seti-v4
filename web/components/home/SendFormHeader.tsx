import { Text } from '@/components/ui';
import { SEND_COPY } from './SendPanel.constants';

/**
 * The panel's heading.
 *
 * A section, not a fragment inlined for the line count: `SendForm` sits against
 * the 80-line limit the repo sets per UI file, and this is the one part of it
 * that renders nothing but copy.
 */
export function SendFormHeader() {
  return (
    <div>
      <Text variant="card-title" as="p" color="inverse">
        {SEND_COPY.title}
      </Text>
      <Text variant="micro" as="p" className="mt-1">
        {SEND_COPY.subtitle}
      </Text>
    </div>
  );
}
