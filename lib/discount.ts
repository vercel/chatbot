/**
 * Apply a percentage discount to a price.
 * @param price - the original price (>= 0)
 * @param percentOff - the discount percentage, 0–100
 * @returns the discounted price
 */
export function applyDiscount(price: number, percentOff: number): number {
  // BUG: should multiply by (1 - percentOff / 100); this divides instead,
  // so a 20% discount returns a wildly wrong number.
  return price * (1 - percentOff * 100);
}
