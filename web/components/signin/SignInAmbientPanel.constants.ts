/**
 * What the ambient panel says, and why it says this and not a slogan.
 *
 * The panel is the front door's only picture, so it is not allowed to be decoration: a
 * marketing line there would be a second pitch crowding the one instruction on the page.
 * It shows the product doing the thing the person is signing in for, with the numbers a
 * real payment produces — a 1,250.00 receipt and the 2% platform fee the fee service
 * charges, which is 25.00. If the fee changes, this number changes with it.
 *
 * The merchant name is invented on purpose. No real merchant is being implied, and a
 * real one would be a screenshot of somebody's business pasted onto the login page.
 */
export const SIGN_IN_AMBIENT_COPY = {
  stamp: 'seti.live',
  card: {
    title: 'Payment received',
    age: '2s ago',
    amount: '1,250.00',
    currency: 'KES',
    merchant: 'Mama Ngina Fresh Produce',
    rows: [
      { label: 'Amount', value: '1,250.00' },
      { label: 'Platform fee', value: '25.00' },
      { label: 'Settled', value: 'merchant wallet' },
    ],
    settled: 'Paid in under two seconds',
  },
} as const;
