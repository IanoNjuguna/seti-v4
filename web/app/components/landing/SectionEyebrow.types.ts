export interface SectionEyebrowProps {
  label: string;
  /** True on a dark band, where the hairline and the label invert. */
  onDark?: boolean;
  /**
   * The element the marker renders as. `p` by default; `h2` when the band has no
   * display heading and this marker is the only name it has (#288).
   */
  as?: 'p' | 'h2';
}
