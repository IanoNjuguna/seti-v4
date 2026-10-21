import { Text } from '@/components/ui';
import { ACTIVITY_COPY } from './Activity.constants';
import { StatementRow } from './StatementRow';

/**
 * The page's title and the statement row, above whatever view is selected.
 *
 * Both live here rather than inside the list because the statement acts on the whole
 * account: it is not a property of the transactions view, and putting it inside one
 * tab would hide it from the other and from the screen's own heading.
 */
export function ActivityHeader() {
  return (
    <div className="flex flex-col gap-6">
      <Text variant="section" as="h1">
        {ACTIVITY_COPY.title}
      </Text>

      <StatementRow />
    </div>
  );
}
