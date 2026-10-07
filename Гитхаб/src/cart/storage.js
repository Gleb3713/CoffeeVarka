import { productMap } from '../data/products.js'

export const STORAGE_KEY = 'kofevarka-cart-v2'
export const MAX_QUANTITY = 20

export function sanitizeCart(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => ({
      productId: typeof item?.productId === 'string' ? item.productId : '',
      quantity: Number.isFinite(item?.quantity) ? Math.floor(item.quantity) : 0,
    }))
    .filter((item) => productMap.has(item.productId) && item.quantity > 0)
    .map((item) => ({ ...item, quantity: Math.min(MAX_QUANTITY, item.quantity) }))
}

export function readCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizeCart(JSON.parse(raw)) : []
  } catch {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    return []
  }
}

export function writeCart(cart) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeCart(cart))) } catch {}
}
