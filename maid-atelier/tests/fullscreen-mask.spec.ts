// @vitest-environment jsdom
/**
 * fullscreen-mask spec(2026-10-02):遮罩只镜像官方全屏标记
 * [data-sidebar-right-panel='fullscreen'] + [data-sidebar-right-open];
 * 撤除 150ms 去抖;收起却仍全屏时自动合成点击官方退出全屏按钮
 * ([data-sidebar-right-mode='push']);dispose 清理。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMaidFullscreenMask } from '../src/client/fullscreen-mask.ts'

let dispose: (() => void) | undefined

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  dispose?.()
  dispose = undefined
  vi.useRealTimers()
  document.body.innerHTML = ''
})

async function flush(): Promise<void> {
  await Promise.resolve()
}

function mountPanel(attrs: Record<string, string | null>): HTMLElement {
  const panel = document.createElement('div')
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null) continue
    panel.setAttribute(k, v)
  }
  document.body.append(panel)
  return panel
}

const mask = (): HTMLElement | null => document.querySelector('[data-maid-fullscreen-mask]')

describe('installMaidFullscreenMask', () => {
  it('shows the mask only while the panel is open AND fullscreen', async () => {
    dispose = installMaidFullscreenMask(document.body)
    const panel = mountPanel({ 'data-sidebar-right-panel': 'fullscreen', 'data-sidebar-right-open': '' })
    await flush()
    expect(mask()).not.toBeNull()
    expect(mask()?.hasAttribute('data-maid-mask-hidden')).toBe(false)
    // 退出全屏(模式变化)→ 遮罩去抖后隐
    panel.setAttribute('data-sidebar-right-panel', 'push')
    await flush()
    vi.advanceTimersByTime(160)
    expect(mask()?.hasAttribute('data-maid-mask-hidden')).toBe(true)
  })

  it('debounces hide so a transient marker flicker never flashes', async () => {
    dispose = installMaidFullscreenMask(document.body)
    const panel = mountPanel({ 'data-sidebar-right-panel': 'fullscreen', 'data-sidebar-right-open': '' })
    await flush()
    expect(mask()?.hasAttribute('data-maid-mask-hidden')).toBe(false)
    // 模拟会话切换重渲染:标记闪没又回来(去抖窗口内)
    panel.setAttribute('data-sidebar-right-panel', 'push')
    await flush()
    vi.advanceTimersByTime(80)
    panel.setAttribute('data-sidebar-right-panel', 'fullscreen')
    await flush()
    vi.advanceTimersByTime(300)
    expect(mask()?.hasAttribute('data-maid-mask-hidden')).toBe(false)
  })

  it('auto-exits fullscreen when the panel collapses while fullscreen', async () => {
    dispose = installMaidFullscreenMask(document.body)
    const panel = mountPanel({ 'data-sidebar-right-panel': 'fullscreen', 'data-sidebar-right-open': '' })
    const exit = document.createElement('button')
    exit.setAttribute('data-sidebar-right-mode', 'push')
    panel.append(exit)
    await flush()
    const clickSpy = vi.spyOn(exit, 'click')
    // 收起:去掉 open,全屏标记残留
    panel.removeAttribute('data-sidebar-right-open')
    await flush()
    expect(clickSpy).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(160)
    expect(mask()?.hasAttribute('data-maid-mask-hidden')).toBe(true)
  })

  it('measures the mask left edge to the sidebar width, sparing the sidebar', async () => {
    dispose = installMaidFullscreenMask(document.body)
    const sidebar = document.createElement('div')
    sidebar.setAttribute('data-slot', 'sidebar')
    Object.defineProperty(sidebar, 'getBoundingClientRect', {
      value: () => ({ width: 260, height: 800, top: 0, left: 0, right: 260, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }),
    })
    document.body.append(sidebar)
    mountPanel({ 'data-sidebar-right-panel': 'fullscreen', 'data-sidebar-right-open': '' })
    await flush()
    expect(mask()?.style.left).toBe('260px')
  })

  it('removes the mask and stops observing on dispose', async () => {
    dispose = installMaidFullscreenMask(document.body)
    mountPanel({ 'data-sidebar-right-panel': 'fullscreen', 'data-sidebar-right-open': '' })
    await flush()
    expect(mask()).not.toBeNull()
    dispose()
    dispose = undefined
    expect(document.querySelector('[data-maid-fullscreen-mask]')).toBeNull()
  })
})
