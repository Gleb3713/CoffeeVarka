export function createOrderPayload(cart) {
  return {
    items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
  }
}
