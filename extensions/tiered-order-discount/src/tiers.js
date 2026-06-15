export function getTierPercentage(subtotal) {
  if (subtotal >= 5000) {
    return 15;
  }

  if (subtotal >= 1000) {
    return 10;
  }

  if (subtotal >= 50) {
    return 5;
  }

  return 0;
}
