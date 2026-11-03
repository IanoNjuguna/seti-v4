/** One thing the payer brings to a Seti payment, as a term and one sentence. */
export interface CustomerStep {
  title: string;
  body: string;
}

/** The "what your customer does" band: its marker, its heading and the three terms. */
export interface YourCustomerCopy {
  /** The band's marker, set in caption size above the heading. */
  eyebrow: string;
  /** The band's `h2`. */
  heading: string;
  /** Exactly three, in the order they are rendered. */
  items: CustomerStep[];
}
