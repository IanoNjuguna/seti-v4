import { Text } from '@/components/ui';

export interface ClaimFormHeaderProps {
  title: string;
  intro: string;
}

/**
 * The claim form's own heading.
 *
 * Its own component because the words change without the form changing: a business
 * name, a username, or onboarding's neutral set before the kind is chosen. A second
 * heading baked into the form would make that a second form.
 *
 * On `/app/merchant` this 20px `section` heading IS the page title — that route is
 * the claim and nothing else — and in the onboarding wizard it is the step's
 * heading under a 20px page title. Both readings hold, so the level stays.
 *
 * The intro is `body` + `secondary` (16px, #505a63) rather than the `micro` default
 * (14px in #8d969e, 2.9:1 on white). It says what signing does and that it costs
 * nothing — the two things a person wants before touching a wallet, and not
 * metadata beside the field.
 */
export function ClaimFormHeader({ title, intro }: ClaimFormHeaderProps) {
  return (
    <div>
      <Text variant="section" as="h2">
        {title}
      </Text>
      <Text variant="body" color="secondary" as="p" className="mt-1">
        {intro}
      </Text>
    </div>
  );
}
