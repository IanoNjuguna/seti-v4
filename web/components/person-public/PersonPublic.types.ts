import type { HandleIdentity } from '@/lib/api';

/**
 * The public PERSON page's shapes. It is fed the same `HandleIdentity` a business
 * page is — a username and a business name are the same kind of signed handle, so
 * the two pages share one identity type and can never disagree about what a
 * handle is.
 */
export interface PersonPublicViewProps {
  person: HandleIdentity;
}

export interface PersonIdentityProps {
  person: HandleIdentity;
}

export interface PersonSendActionProps {
  /** The stored handle, carried into the send flow as `?to=`. */
  handle: string;
}
