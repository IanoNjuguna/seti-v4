/** What the merchant half needs: the name a customer reads, and the stored handle. */
export interface ReceiveMerchantHalfProps {
  /** The business name as the customer reads it: `Java House`. */
  name: string;
  /**
   * The stored handle, which is NOT the name: `javahouse`. The link and the saved file
   * are built from this, so a name with a space in it cannot produce a broken URL.
   */
  handle: string;
}
