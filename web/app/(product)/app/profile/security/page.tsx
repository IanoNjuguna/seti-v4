import { SecurityScreen } from '@/components/profile/security/SecurityScreen';

/**
 * The security surface, a route of its own rather than a section on the profile.
 *
 * It is reachable from the profile's own row and it is the only screen where a
 * customer can turn a second factor on, so a stable URL matters more than a shorter
 * one: it is the address a support reply names.
 */
export default function SecurityPage() {
  return <SecurityScreen />;
}
