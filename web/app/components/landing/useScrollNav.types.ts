import type { RefObject } from 'react';

/**
 * What `useScrollNav` hands back: the ref its caller must put on the nav's
 * HEADER, which is the element the state attribute is written to.
 *
 * The element, not the state. There is nothing to read and nothing to render
 * from: the scrolled state is a single attribute, written straight to the DOM,
 * because a nav that re-rendered React on every threshold crossing would be a
 * client component that re-renders while somebody is reading.
 */
export type ScrollNavRef = RefObject<HTMLElement | null>;
