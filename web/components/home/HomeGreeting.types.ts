export interface HomeGreetingProps {
  /**
   * The account's username, without the `@`.
   *
   * Nothing in the repo supplies one yet, so the prop is optional and the line
   * greets `anon` — see the `TODO(username)` note on `greetingName` in
   * `useGreeting.ts`, which is the single place that would read it.
   */
  username?: string | null;
}
