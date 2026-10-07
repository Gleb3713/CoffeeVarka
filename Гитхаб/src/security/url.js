const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function isSafeExternalUrl(value) {
  try {
    const url = new URL(value, window.location.origin)
    return SAFE_PROTOCOLS.has(url.protocol)
  } catch {
    return false
  }
}

export function safeTargetAttributes(anchor) {
  if (anchor.target === '_blank') anchor.rel = 'noopener noreferrer'
}
