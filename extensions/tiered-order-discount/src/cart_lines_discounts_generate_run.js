import { getTierPercentage } from "./tiers";

export function cartLinesDiscountsGenerateRun(input) {
  if (!input.discount.discountClasses.includes("ORDER")) {
    return { operations: [] };
  }

  const subtotal = Number(input.cart.cost.subtotalAmount.amount);
  const percentage = getTierPercentage(subtotal);

  if (percentage === 0) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        orderDiscountsAdd: {
          candidates: [
            {
              message: `${percentage}% off`,
              targets: [
                {
                  orderSubtotal: {
                    excludedCartLineIds: [],
                  },
                },
              ],
              value: {
                percentage: {
                  value: percentage,
                },
              },
            },
          ],
          selectionStrategy: "FIRST",
        },
      },
    ],
  };
}
