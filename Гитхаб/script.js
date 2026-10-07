import { filters, productMap, products } from './src/data/products.js'
import { MAX_QUANTITY, readCart, writeCart } from './src/cart/storage.js'
import { createOrderPayload } from './src/api/orders.js'
import { isSafeExternalUrl, safeTargetAttributes } from './src/security/url.js'
import { $, escapeHtml } from './src/utils/dom.js'
import { rub } from './src/utils/format.js'

const state = { filter: 'Всё', cart: readCart(), menuOpen: false, lastFocus: null }
const $body = document.body

const ORPHAN_WORDS = /(^|[^\p{L}])((?:и|а|но|да|или|либо|в|во|на|за|из|к|ко|с|со|у|о|об|по|от|до|для|без|не|ни|же|бы|ли|как|про))\s+(?=\p{L})/giu

function fixOrphans(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT)$/.test(parent.tagName)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const node of nodes) node.nodeValue = node.nodeValue.replace(ORPHAN_WORDS, '$1$2\u00A0')
}

function quantityTotal() { return state.cart.reduce((sum, item) => sum + item.quantity, 0) }
function cartTotal() { return state.cart.reduce((sum, item) => sum + (productMap.get(item.productId)?.price ?? 0) * item.quantity, 0) }
function save() { writeCart(state.cart) }
function announce(message) { const live = $('#live'); if (!live) return; live.textContent = ''; requestAnimationFrame(() => { live.textContent = message }) }

function renderFilters() {
  $('#filters').innerHTML = filters.map((filter) => `
    <button type="button" role="tab" aria-selected="${state.filter === filter}" class="filter-button${state.filter === filter ? ' is-active' : ''}" data-filter="${filter}">
      ${filter}
    </button>`).join('')
}

function renderProducts() {
  const visible = state.filter === 'Всё' ? products : products.filter((product) => product.category === state.filter)
  $('#productGrid').innerHTML = visible.map((product) => `
    <article class="product-card-wrap">
      <div class="product-card">
        <div class="product-card__image-wrap">
          <img src="${product.image}" alt="${escapeHtml(product.alt)}" loading="lazy" width="800" height="800">
        </div>
        <div class="product-card__meta"><span>${product.category}</span><span>${product.volume}</span></div>
        <div class="product-card__main">
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.description)}</p>
        </div>
        <div class="product-card__buy">
          <strong class="product-card__price">${rub.format(product.price)}</strong>
          <div class="product-card__controls">
            <button type="button" class="product-add-button" data-add="${product.id}" aria-label="Добавить ${escapeHtml(product.name)}" ${product.available ? '' : 'disabled'}>${product.available ? '<span class="add-full-label">Добавить</span><span class="add-mobile-label" aria-hidden="true">＋</span>' : 'Нет в наличии'}</button>
            ${(() => { const qty = state.cart.find((item) => item.productId === product.id)?.quantity ?? 0; return qty > 0 ? `<button type="button" class="product-minus-button" data-dec="${product.id}" aria-label="Уменьшить количество ${escapeHtml(product.name)}">−</button>` : '' })()}
            <span class="product-qty" id="qty-${product.id}" data-qty-for="${product.id}" aria-live="polite" aria-label="Количество ${escapeHtml(product.name)} в корзине">${state.cart.find((item) => item.productId === product.id)?.quantity ?? 0}</span>
          </div>
        </div>
      </div>
    </article>`).join('')
  fixOrphans($('#productGrid'))
}

function renderCart() {
  const count = quantityTotal()
  $('#cartCount').textContent = count
  $('#mobileCartCount').textContent = count
  const content = $('#cartContent')
  if (!state.cart.length) {
    content.innerHTML = `<div class="cart-empty"><div class="cart-empty__symbol">∅</div><h3>Корзина пуста</h3><p>Начните с кофе, а дальше посмотрим.</p><button class="button button--dark" id="emptyToMenu">Перейти к меню</button></div>`
    fixOrphans(content)
    return
  }

  content.innerHTML = `
    <div class="cart-items">
      ${state.cart.map((item) => {
        const product = productMap.get(item.productId)
        return `<div class="cart-item">
          <img src="${product.image}" alt="" width="72" height="72">
          <div class="cart-item__body">
            <div class="cart-item__top">
              <div><span>${product.category}</span><h3>${escapeHtml(product.name)}</h3></div>
              <button class="icon-button" data-remove="${product.id}" aria-label="Удалить ${escapeHtml(product.name)}">×</button>
            </div>
            <div class="cart-item__bottom">
              <div class="stepper">
                <button data-dec="${product.id}" aria-label="Уменьшить количество ${escapeHtml(product.name)}">−</button>
                <span aria-live="polite">${item.quantity}</span>
                <button data-inc="${product.id}" aria-label="Увеличить количество ${escapeHtml(product.name)}">＋</button>
              </div>
              <strong>${rub.format(product.price * item.quantity)}</strong>
            </div>
          </div>
        </div>`
      }).join('')}
    </div>
    <div class="cart-footer">
      <button class="text-button" id="clearCart">Очистить корзину</button>
      <div class="cart-total"><span>Итого</span><strong>${rub.format(cartTotal())}</strong></div>
      <button class="button button--dark button--wide" id="checkoutButton">Оформить заказ</button>
      <small>После подключения backend цена пересчитывается сервером по productId.</small>
    </div>`
  fixOrphans(content)
}

function openCart() {
  state.lastFocus = document.activeElement
  $('#cartOverlay').hidden = false
  $('#cartTrigger').setAttribute('aria-expanded', 'true')
  $body.classList.add('no-scroll')
  renderCart()
  requestAnimationFrame(() => $('#cartClose').focus())
}

function closeCart() {
  $('#cartOverlay').hidden = true
  $('#cartTrigger').setAttribute('aria-expanded', 'false')
  $body.classList.toggle('no-scroll', state.menuOpen)
  state.lastFocus?.focus?.()
  state.lastFocus = null
}

function toggleMenu(force) {
  state.menuOpen = typeof force === 'boolean' ? force : !state.menuOpen
  const trigger = $('#menuTrigger')
  const nav = $('#mobileNav')
  nav.hidden = !state.menuOpen
  trigger.setAttribute('aria-expanded', String(state.menuOpen))
  trigger.setAttribute('aria-label', state.menuOpen ? 'Закрыть меню' : 'Открыть меню')
  trigger.textContent = state.menuOpen ? '×' : '☰'
  $body.classList.toggle('no-scroll', state.menuOpen || !$('#cartOverlay').hidden)
  if (state.menuOpen) nav.querySelector('a')?.focus()
  else trigger.focus()
}

function addToCart(productId) {
  const product = productMap.get(productId)
  if (!product?.available) return
  const existing = state.cart.find((item) => item.productId === productId)
  if (existing) existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + 1)
  else state.cart.push({ productId, quantity: 1 })
  save(); renderCart(); renderProducts(); announce(`${product.name} добавлен в корзину`)
}

function changeQuantity(productId, delta) {
  const item = state.cart.find((candidate) => candidate.productId === productId)
  if (!item) return
  item.quantity += delta
  if (item.quantity <= 0) state.cart = state.cart.filter((candidate) => candidate !== item)
  else item.quantity = Math.min(MAX_QUANTITY, item.quantity)
  save(); renderCart(); renderProducts()
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.productId !== productId)
  save(); renderCart(); renderProducts(); announce('Товар удалён из корзины')
}

$('#filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]')
  if (!button) return
  state.filter = button.dataset.filter
  renderFilters(); renderProducts()
})

$('#productGrid').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return
  if (button.dataset.add) addToCart(button.dataset.add)
  if (button.dataset.dec) changeQuantity(button.dataset.dec, -1)
})

$('#cartContent').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return
  if (button.id === 'emptyToMenu') { closeCart(); $('#menu').scrollIntoView({ behavior: 'smooth' }); return }
  if (button.id === 'clearCart') { state.cart = []; save(); renderCart(); renderProducts(); announce('Корзина очищена'); return }
  if (button.id === 'checkoutButton') {
    const payload = createOrderPayload(state.cart)
    alert(`Демо-заказ подготовлен. Позже этот payload отправляется POST /api/orders.\n\n${JSON.stringify(payload, null, 2)}`)
    return
  }
  if (button.dataset.inc) changeQuantity(button.dataset.inc, 1)
  if (button.dataset.dec) changeQuantity(button.dataset.dec, -1)
  if (button.dataset.remove) removeFromCart(button.dataset.remove)
})

$('#cartTrigger').addEventListener('click', openCart)
$('#cartClose').addEventListener('click', closeCart)
$('#cartScrim').addEventListener('click', closeCart)
$('#menuTrigger').addEventListener('click', () => toggleMenu())
$('#mobileCartTrigger').addEventListener('click', () => { toggleMenu(false); openCart() })
$('#mobileNav').addEventListener('click', (event) => { if (event.target.matches('a')) toggleMenu(false) })

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!$('#cartOverlay').hidden) closeCart()
    else if (state.menuOpen) toggleMenu(false)
  }
})

document.querySelectorAll('a[href]').forEach((anchor) => {
  const href = anchor.getAttribute('href') || ''
  if (href.startsWith('http')) {
    if (!isSafeExternalUrl(href)) anchor.removeAttribute('href')
    else safeTargetAttributes(anchor)
  }
})

const live = document.createElement('div')
live.id = 'live'
live.className = 'sr-only'
live.setAttribute('aria-live', 'polite')
document.body.appendChild(live)

renderFilters(); renderProducts(); renderCart(); fixOrphans(document.body)
