import { PROFILE_PAGE_COPY } from './ProfilePage.constants';
import { ProfileRow } from './ProfileRow';
import { PROFILE_SHORTCUTS } from './ProfileShortcuts.constants';
import type { ProfileShortcutsProps } from './ProfileShortcuts.types';

/**
 * The two shortcuts, between the person and the settings.
 *
 * A `nav` with its own name, because these are destinations rather than settings
 * and a screen reader should hear them as such. They share the settings list's
 * row (`ProfileRow`), so both lists have one left edge and one row height: the page
 * is one column of rows with a person at the top, not a header, a strip of tiles
 * and then a list.
 */
export function ProfileShortcuts({ shortcuts = PROFILE_SHORTCUTS }: ProfileShortcutsProps) {
  return (
    <nav aria-label={PROFILE_PAGE_COPY.shortcutsLabel} className="flex flex-col divide-y divide-hairline-light">
      {shortcuts.map((shortcut) => (
        <ProfileRow
          key={shortcut.key}
          title={shortcut.title}
          subtitle={shortcut.subtitle}
          href={shortcut.href}
          icon={shortcut.icon}
        />
      ))}
    </nav>
  );
}
