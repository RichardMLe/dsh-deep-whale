// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installMaidComposerScroll } from '../src/client/composer-scroll.ts'

const SCROLLPORT_HEIGHT = 300
const SCROLLPORT_CONTENT_HEIGHT = 800
const SWITCH = 'data-maid-composer-mode'

interface Fixture {
  root: HTMLElement
  scrollport: HTMLElement
  seat: HTMLElement
  textarea: HTMLTextAreaElement
  dispose: () => void
}

function mount(mode: string = 'scroll'): Fixture {
  const root = document.createElement('div')
  root.dataset.phase = 'active'
  const scrollport = document.createElement('div')
  scrollport.dataset.conversationScroll = ''
  Object.defineProperties(scrollport, {
    clientHeight: { configurable: true, value: SCROLLPORT_HEIGHT },
    scrollHeight: { configurable: true, value: SCROLLPORT_CONTENT_HEIGHT },
  })
  const flow = document.createElement('div')
  flow.dataset.chatFlow = ''
  const seat = document.createElement('div')
  seat.dataset.composerSeat = ''
  const textarea = document.createElement('textarea')
  seat.append(textarea)
  scrollport.append(flow, seat)
  root.append(scrollport)
  document.body.append(root)
  document.documentElement.setAttribute(SWITCH, mode)
  return { root, scrollport, seat, textarea, dispose: installMaidComposerScroll(document.body) }
}

function scrollTo(scrollport: HTMLElement, top: number): void {
  scrollport.scrollTop = top
  scrollport.dispatchEvent(new Event('scroll'))
}

function wheel(scrollport: HTMLElement, deltaY: number): void {
  scrollport.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true }))
}

function nextMicrotask(): Promise<void> {
  return new Promise(resolve => { setTimeout(resolve, 0) })
}

beforeEach(() => {
  document.body.innerHTML = ''
  document.documentElement.removeAttribute(SWITCH)
})

afterEach(() => {
  document.documentElement.removeAttribute(SWITCH)
})

describe('maid composer scroll-intent', () => {
  it('fades the seat out when scrolling up and back in when scrolling down', () => {
    const { scrollport, seat, dispose } = mount()
    scrollTo(scrollport, 400) // baseline
    scrollTo(scrollport, 200) // scroll up past the threshold
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(true)

    scrollTo(scrollport, 320) // scroll down past the threshold
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
    dispose()
  })

  it('always shows the seat when reaching the bottom', () => {
    const { scrollport, seat, dispose } = mount()
    scrollTo(scrollport, 400)
    scrollTo(scrollport, 200)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(true)

    scrollTo(scrollport, SCROLLPORT_CONTENT_HEIGHT - SCROLLPORT_HEIGHT - 8) // distanceToBottom <= 24
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
    dispose()
  })

  it('steers by wheel direction and ignores micro-wheel deltas', () => {
    const { scrollport, seat, dispose } = mount()
    wheel(scrollport, -120)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(true)

    wheel(scrollport, 120)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)

    wheel(scrollport, 6)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
    dispose()
  })

  it('stays inert when the switch is off and clears state on flipping it off', async () => {
    const { scrollport, seat, dispose } = mount()
    scrollTo(scrollport, 400)
    scrollTo(scrollport, 200)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(true)

    document.documentElement.setAttribute(SWITCH, 'persistent')
    await nextMicrotask()
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)

    scrollTo(scrollport, 150)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
    dispose()
  })

  it('does not run on a non-scroll mode from the start', () => {
    const { scrollport, seat, dispose } = mount('persistent')
    scrollTo(scrollport, 400)
    scrollTo(scrollport, 200)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
    dispose()
  })

  it('focusing the composer brings it back and marks it interactive', async () => {
    const { scrollport, seat, textarea, dispose } = mount()
    scrollTo(scrollport, 400)
    scrollTo(scrollport, 200)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(true)

    textarea.focus()
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
    expect(seat.hasAttribute('data-maid-composer-interactive')).toBe(true)

    textarea.blur()
    await nextMicrotask()
    expect(seat.hasAttribute('data-maid-composer-interactive')).toBe(false)
    dispose()
  })

  it('keeps the composer visible and focused while typing (PG UP accident)', () => {
    const { scrollport, seat, textarea, dispose } = mount()
    textarea.focus()

    // 键盘翻页上滚:焦点在输入框内 → 输入席不隐藏、焦点不被抢走
    scrollTo(scrollport, 400)
    scrollTo(scrollport, 200)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
    expect(document.activeElement).toBe(textarea)

    // 滚轮上滚同理
    wheel(scrollport, -120)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
    expect(document.activeElement).toBe(textarea)

    // 失焦后正常语义恢复:上滚隐藏、回底显示
    textarea.blur()
    scrollTo(scrollport, 150)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(true)
    scrollTo(scrollport, SCROLLPORT_CONTENT_HEIGHT - SCROLLPORT_HEIGHT - 8)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
    dispose()
  })

  it('swallows Page Up/Page Down while the composer owns focus (PG UP accident)', () => {
    const { textarea, dispose } = mount()

    const up = new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true })
    textarea.dispatchEvent(up)
    expect(up.defaultPrevented).toBe(true)

    const down = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true })
    textarea.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    dispose()
  })

  it('leaves Page keys alone outside the active composer', () => {
    const { scrollport, dispose } = mount()

    const up = new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true })
    scrollport.dispatchEvent(up)
    expect(up.defaultPrevented).toBe(false)

    const down = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true })
    scrollport.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(false)
    dispose()
  })

  it('ignores scrollports outside an active conversation root', () => {
    const { root, scrollport, seat, dispose } = mount()
    root.dataset.phase = 'hero'
    scrollTo(scrollport, 400)
    scrollTo(scrollport, 200)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)

    root.dataset.phase = 'active'
    root.querySelector('[data-chat-flow]')!.remove()
    scrollTo(scrollport, 400)
    scrollTo(scrollport, 200)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
    dispose()
  })

  it('dispose removes every owned seat state', () => {
    const { scrollport, seat, dispose } = mount()
    scrollTo(scrollport, 400)
    scrollTo(scrollport, 200)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(true)

    dispose()
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
    expect(seat.hasAttribute('data-maid-composer-interactive')).toBe(false)
  })

  it('older disposal cannot clear state owned by a repeated activation', () => {
    const { scrollport, seat, dispose: disposeOlder } = mount()
    scrollTo(scrollport, 400)
    scrollTo(scrollport, 200)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(true)

    const disposeNewer = installMaidComposerScroll(document.body)
    disposeOlder()
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(true)

    wheel(scrollport, 120)
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
    disposeNewer()
    expect(seat.hasAttribute('data-maid-composer-hidden')).toBe(false)
  })
})
