export interface SendFlowProps {
  /** The recipient named by the URL (`?to=` / `?handle=`), if the link had one. */
  linked: string | null;
}
