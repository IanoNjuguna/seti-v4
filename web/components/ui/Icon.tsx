import { ICON_PATHS, type IconName } from './icon-paths.constants';

export interface IconProps {
  name: IconName;
  /** Size and colour come from here — the icon inherits `currentColor`. */
  className?: string;
}

/**
 * Icon primitive. Decorative by default (`aria-hidden`): every icon in this app
 * sits next to a visible label, or inside a button that carries its own
 * `aria-label`. If an icon ever stands alone, give the button the label, not
 * this component.
 */
export function Icon({ name, className = 'h-5 w-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
