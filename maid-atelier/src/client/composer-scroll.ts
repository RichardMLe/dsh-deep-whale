/**
 * Composer scroll-intent presentation: scrolling up through the transcript
 * fades the docked composer out, scrolling back down (or reaching the
 * bottom) fades it in. Ported from the ORCA LINK approach (see
 * orca-link/src/client/composer-motion.ts) and gated by the skin-manager
 * setting `composerMode` (`data-maid-composer-mode` on <html>, owned by
 * installMaidCustomization; active only for the 'scroll' choice).
 *
 * The module only presents a reversible visibility state on the host's
 * stable data hooks; it never submits prompts or creates sessions. When the
 * switch is off (or the manager has not applied a state yet), every listener
 * stays inert and no seat state is touched.
 */
const SCROLLPORT_SELECTOR = '[data-conversation-scroll]'
const COMPOSER_SEAT_SELECTOR = '[data-composer-seat]'
const CHAT_FLOW_SELECTOR = '[data-chat-flow]'
const MODE_ATTRIBUTE = 'data-maid-composer-mode'
const HIDDEN_ATTRIBUTE = 'data-maid-composer-hidden'
const INTERACTIVE_ATTRIBUTE = 'data-maid-composer-interactive'
const NESTED_SCROLL_SURFACE_SELECTOR = [
  '[role="menu"]',
  '[role="listbox"]',
  '[role="dialog"]',
  '[aria-modal="true"]',
  '[data-radix-popper-content-wrapper]',
  '[data-floating-ui-portal]',
].join(',')

const SCROLL_THRESHOLD = 10
const BOTTOM_THRESHOLD = 24

interface SeatSnapshot {
  hidden: string | null
  interactive: string | null
}

interface ScrollOwnership {
  token: symbol
  originals: Map<HTMLElement, SeatSnapshot>
}

const ownershipByDocument = new WeakMap<Document, ScrollOwnership>()

function phaseRootOf(element: Element): HTMLElement | null {
  let candidate: Element | null = element
  while (candidate !== null) {
    if (
      candidate instanceof HTMLElement
      && candidate.hasAttribute('data-phase')
      && candidate.querySelector(':scope > [data-conversation-scroll]') !== null
    ) return candidate
    candidate = candidate.parentElement
  }
  return null
}

function scrollEnabled(doc: Document): boolean {
  return doc.documentElement.getAttribute(MODE_ATTRIBUTE) === 'scroll'
}

function activeSeatOf(scrollport: HTMLElement): HTMLElement | null {
  const root = phaseRootOf(scrollport)
  if (root?.dataset.phase !== 'active') return null
  // The inspector overlay mounts an extra scrollport without a chat flow; its
  // seat is already display:none'd by the skin and must not be driven. Only
  // transcript scrollports own the gesture (same gate as the CSS contract).
  if (scrollport.querySelector(CHAT_FLOW_SELECTOR) === null) return null
  return scrollport.querySelector<HTMLElement>(COMPOSER_SEAT_SELECTOR)
}

/**
 * Wheeling inside an open popover (model picker, mode list, attachments)
 * must not drive the composer state. Any scrollable element on the event
 * path before the transcript scrollport owns the gesture.
 */
function wheelBelongsToNestedSurface(event: WheelEvent, scrollport: HTMLElement): boolean {
  for (const candidate of event.composedPath()) {
    if (candidate === scrollport) break
    if (!(candidate instanceof HTMLElement)) continue
    if (candidate.matches(NESTED_SCROLL_SURFACE_SELECTOR)) return true

    const style = getComputedStyle(candidate)
    if (!/(auto|scroll)/.test(style.overflowY) || candidate.scrollHeight <= candidate.clientHeight) continue
    if (event.deltaY < 0 && candidate.scrollTop > 0) return true
    if (event.deltaY > 0 && candidate.scrollTop + candidate.clientHeight < candidate.scrollHeight) return true
  }
  return false
}

/**
 * @param body - skin owning element (document.body) used to reach the
 * document; the switch attribute lives on documentElement.
 */
export function installMaidComposerScroll(body: HTMLElement): () => void {
  const doc = body.ownerDocument
  const token = Symbol('maid-composer-scroll')
  const ownership = ownershipByDocument.get(doc) ?? { token, originals: new Map() }
  ownership.token = token
  ownershipByDocument.set(doc, ownership)
  const current = (): boolean => ownership.token === token
  const remember = (seat: HTMLElement): void => {
    if (ownership.originals.has(seat)) return
    ownership.originals.set(seat, {
      hidden: seat.getAttribute(HIDDEN_ATTRIBUTE),
      interactive: seat.getAttribute(INTERACTIVE_ATTRIBUTE),
    })
  }
  const write = (seat: HTMLElement, attribute: string, value: string | null): void => {
    if (!current()) return
    remember(seat)
    if (value === null) seat.removeAttribute(attribute)
    else seat.setAttribute(attribute, value)
  }
  const restoreSeat = (seat: HTMLElement, snapshot: SeatSnapshot): void => {
    if (snapshot.hidden === null) seat.removeAttribute(HIDDEN_ATTRIBUTE)
    else seat.setAttribute(HIDDEN_ATTRIBUTE, snapshot.hidden)
    if (snapshot.interactive === null) seat.removeAttribute(INTERACTIVE_ATTRIBUTE)
    else seat.setAttribute(INTERACTIVE_ATTRIBUTE, snapshot.interactive)
  }
  const clearSeatStates = (): void => {
    if (!current()) return
    ownership.originals.forEach((snapshot, seat) => { restoreSeat(seat, snapshot) })
  }
  // Baseline per scrollport, established lazily so a freshly mounted
  // conversation never reacts to its first tear-down style pass.
  const lastTops = new WeakMap<HTMLElement, number>()

  const hideSeat = (seat: HTMLElement): void => {
    if (!current() || !scrollEnabled(doc)) return
    // 正在输入(焦点在输入席内)时不隐藏(9-12 PG UP 事故):旧实现滚动上移时
    // 抢走输入框焦点并隐藏输入席,之后 PG DN 等键失去滚动目标,界面永久卡在
    // 「内容上移、底部黑行」状态,只能重载。焦点在手 = 用户正在打字,滚动
    // 不改变输入席显隐。
    const active = doc.activeElement
    if (active instanceof HTMLElement && seat.contains(active)) return
    write(seat, INTERACTIVE_ATTRIBUTE, null)
    write(seat, HIDDEN_ATTRIBUTE, '')
  }

  const showSeat = (seat: HTMLElement): void => {
    write(seat, HIDDEN_ATTRIBUTE, null)
  }

  const activateSeat = (seat: HTMLElement): void => {
    showSeat(seat)
    write(seat, INTERACTIVE_ATTRIBUTE, '')
    if (!scrollEnabled(doc)) write(seat, INTERACTIVE_ATTRIBUTE, null)
  }

  const onScroll = (event: Event): void => {
    if (!current() || !scrollEnabled(doc)) return
    const scrollport = event.target
    if (!(scrollport instanceof HTMLElement) || !scrollport.matches(SCROLLPORT_SELECTOR)) return
    const seat = activeSeatOf(scrollport)
    if (seat === null) return

    const top = scrollport.scrollTop
    const previousTop = lastTops.get(scrollport)
    lastTops.set(scrollport, top)

    const distanceToBottom = scrollport.scrollHeight - top - scrollport.clientHeight
    if (distanceToBottom <= BOTTOM_THRESHOLD) {
      showSeat(seat)
      return
    }
    if (previousTop !== undefined && top > previousTop + SCROLL_THRESHOLD) showSeat(seat)
    else if (previousTop !== undefined && top < previousTop - SCROLL_THRESHOLD) hideSeat(seat)
  }

  const onWheel = (event: WheelEvent): void => {
    if (!current() || !scrollEnabled(doc)) return
    if (Math.abs(event.deltaY) <= SCROLL_THRESHOLD) return

    for (const candidate of event.composedPath()) {
      if (!(candidate instanceof HTMLElement) || !candidate.matches(SCROLLPORT_SELECTOR)) continue
      const scrollport = candidate
      if (wheelBelongsToNestedSurface(event, scrollport)) return
      const seat = activeSeatOf(scrollport)
      if (seat === null) return
      if (!lastTops.has(scrollport)) lastTops.set(scrollport, scrollport.scrollTop)
      if (event.deltaY < 0) hideSeat(seat)
      else showSeat(seat)
      return
    }
  }

  const onFocusIn = (event: FocusEvent): void => {
    if (!current()) return
    const target = event.target
    if (!(target instanceof Element)) return
    const seat = target.closest<HTMLElement>(COMPOSER_SEAT_SELECTOR)
    if (seat !== null && phaseRootOf(seat)?.dataset.phase === 'active') activateSeat(seat)
  }

  const onFocusOut = (event: FocusEvent): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    const seat = target.closest<HTMLElement>(COMPOSER_SEAT_SELECTOR)
    if (seat === null) return
    queueMicrotask(() => {
      if (current() && !seat.contains(doc.activeElement)) write(seat, INTERACTIVE_ATTRIBUTE, null)
    })
  }

  // 焦点在输入席内时吞掉翻页键(9-12 PG UP 事故根治):键盘滚动把转录区滚上去后,
  // 插入符导航语义不保证 PG DN 能把窗口滚回来——界面卡在「内容上移、底部黑行」,
  // 只能重载。误触翻页键一律不滚动转录区(输入框内正常保留插入符行为);
  // 想用键盘翻页看历史,先点一下正文区(焦点离开输入席)即可,与未聚焦路径一致。
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!current()) return
    if (event.key !== 'PageUp' && event.key !== 'PageDown') return
    const target = event.target
    if (!(target instanceof Element)) return
    const seat = target.closest<HTMLElement>(COMPOSER_SEAT_SELECTOR)
    if (seat === null || phaseRootOf(seat)?.dataset.phase !== 'active') return
    event.preventDefault()
  }

  // Toggling the setting off must immediately restore every seat instead of
  // waiting for the next scroll gesture.
  const stateObserver = new MutationObserver((records) => {
    if (!current()) return
    if (!records.some(record => record.type === 'attributes' && record.attributeName === MODE_ATTRIBUTE)) return
    if (!scrollEnabled(doc)) clearSeatStates()
  })
  stateObserver.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: [MODE_ATTRIBUTE],
  })

  // Scroll does not bubble; capture on the document still sees each
  // scrollport's events, so no per-element binding lifecycle is needed.
  doc.addEventListener('scroll', onScroll, true)
  doc.addEventListener('wheel', onWheel, true)
  doc.addEventListener('focusin', onFocusIn, true)
  doc.addEventListener('focusout', onFocusOut, true)
  doc.addEventListener('keydown', onKeyDown, true)

  return () => {
    stateObserver.disconnect()
    doc.removeEventListener('scroll', onScroll, true)
    doc.removeEventListener('wheel', onWheel, true)
    doc.removeEventListener('focusin', onFocusIn, true)
    doc.removeEventListener('focusout', onFocusOut, true)
    doc.removeEventListener('keydown', onKeyDown, true)
    if (current()) {
      clearSeatStates()
      ownership.originals.clear()
      ownershipByDocument.delete(doc)
    }
  }
}
