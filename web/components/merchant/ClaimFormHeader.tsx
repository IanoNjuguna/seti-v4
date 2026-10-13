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
 */
export function ClaimFormHeader({ title, intro }: ClaimFormHeaderProps) {
  return (
    <div>
      <Text variant="section" as="h2">
        {title}
      </Text>
      <Text variant="micro" as="p" className="mt-1">
        {intro}
      </Text>
    </div>
  );
}
