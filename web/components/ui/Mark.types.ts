export type MarkSize = 'lg' | 'md' | 'sm';

/**
 * The account's own mark.
 *
 * It takes no name and no address any more: the face is the product's, not a seed's. A photo,
 * when there is one, will arrive as its own prop and this stays the fallback — which is why the
 * component still takes a size rather than being three loose spans.
 */
export interface MarkProps {
  size?: MarkSize;
  className?: string;
}
