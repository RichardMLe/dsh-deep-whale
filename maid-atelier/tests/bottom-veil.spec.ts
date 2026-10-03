// @vitest-environment jsdom
/**
 * bottom-veil spec(9-12):遮罩只在「对话」视图真实渲染时存在——
 * 轨迹视图接管(chat-flow 卸载或隐藏)后经 200ms 静默复查撤下,切回后重挂。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installMaidBottomVeil } from '../src/client/bottom-veil.ts'

const STRIP = "[data-skin-chrome='bottom-veil-strip']"
const RECHECK_MS = 200

function chatDom(): { host: HTMLElement; flow: HTMLElement } {
  document.body.innerHTML = `
    <main data-phase="active">
      <div data-conversation-scroll><div data-chat-flow></div></div>
    </main>
  `
  return {
    host: document.querySelector<HTMLElement>('main')!,
    flow: document.querySelector<HTMLElement>('[data-chat-flow]')!,
  }
}

/** jsdom 无布局:offsetParent 恒为 null,可见性由 getClientRects 决定。 */
function renderFlow(flow: HTMLElement, rendered: boolean): void {
  vi.spyOn(flow, 'getClientRects').mockReturnValue(
    rendered ? [{} as DOMRect] : [],
  )
}

let dispose: (() => void) | undefined

afterEach(() => {
  dispose?.()
  dispose = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('installMaidBottomVeil', () => {
  it('mounts the strip while the chat flow is rendered', () => {
    const { flow } = chatDom()
    renderFlow(flow, true)
    dispose = installMaidBottomVeil(document.body)
    expect(document.querySelector(STRIP)).not.toBeNull()
  })

  // 2026-10-02 契约更新(真机反馈:部分对话遮罩始终缺失):阶段根存在即挂遮罩,
  // 不再要求流已渲染。
  it('mounts the strip when the phase exists even if the flow is not rendered', () => {
    const { flow } = chatDom()
    renderFlow(flow, false)
    dispose = installMaidBottomVeil(document.body)
    expect(document.querySelector(STRIP)).not.toBeNull()
  })

  it('removes the strip after the flow unmounts inside the host (view switch), debounced', async () => {
    vi.useFakeTimers()
    const { flow } = chatDom()
    renderFlow(flow, true)
    dispose = installMaidBottomVeil(document.body)
    expect(document.querySelector(STRIP)).not.toBeNull()

    // 轨迹视图接管:chat-flow 在宿主内卸载(命中宿主内突变跳过路径)
    flow.remove()
    await Promise.resolve()
    // 复查点之前遮罩仍在(不即时查询)
    expect(document.querySelector(STRIP)).not.toBeNull()
    vi.advanceTimersByTime(RECHECK_MS)
    expect(document.querySelector(STRIP)).toBeNull()
  })

  it('remounts the strip after the flow returns, debounced', async () => {
    vi.useFakeTimers()
    const { flow } = chatDom()
    renderFlow(flow, true)
    dispose = installMaidBottomVeil(document.body)

    flow.remove()
    await Promise.resolve()
    vi.advanceTimersByTime(RECHECK_MS)
    expect(document.querySelector(STRIP)).toBeNull()

    // 切回对话视图:flow 重新挂回滚动容器内(官方结构)
    document.querySelector('[data-conversation-scroll]')!
      .insertAdjacentHTML('beforeend', '<div data-chat-flow></div>')
    const next = document.querySelector<HTMLElement>('[data-chat-flow]')!
    renderFlow(next, true)
    await Promise.resolve()
    vi.advanceTimersByTime(RECHECK_MS)
    expect(document.querySelector(STRIP)).not.toBeNull()
  })

  it('hides the strip when the flow is display-hidden without unmounting', async () => {
    vi.useFakeTimers()
    const { flow, host } = chatDom()
    renderFlow(flow, true)
    dispose = installMaidBottomVeil(document.body)
    expect(document.querySelector(STRIP)).not.toBeNull()

    // 视图切换但 flow 仍挂载、被隐藏:伪造不再渲染,并触发一次宿主内突变
    vi.mocked(flow.getClientRects).mockReturnValue([])
    host.append(document.createElement('article'))
    await Promise.resolve()
    vi.advanceTimersByTime(RECHECK_MS)
    expect(document.querySelector(STRIP)).toBeNull()
  })

  it('streaming row churn never queries synchronously: the recheck stays postponed', async () => {
    vi.useFakeTimers()
    const { flow, host } = chatDom()
    renderFlow(flow, true)
    dispose = installMaidBottomVeil(document.body)
    const querySelector = vi.spyOn(document, 'querySelector')

    // 流式:宿主内连续大批行增删,永不越过 200ms 静默
    for (let i = 0; i < 12; i++) {
      host.append(document.createElement('article'))
      await Promise.resolve()
      vi.advanceTimersByTime(RECHECK_MS - 60)
    }
    expect(document.querySelector(STRIP)).not.toBeNull()
    expect(querySelector).not.toHaveBeenCalledWith('[data-phase="active"] [data-chat-flow]')

    // 停歇后复查才发生,且流仍在渲染 → 遮罩保留
    vi.advanceTimersByTime(RECHECK_MS)
    expect(document.querySelector(STRIP)).not.toBeNull()
  })

  it('clears the recheck timer on dispose', async () => {
    vi.useFakeTimers()
    const { flow } = chatDom()
    renderFlow(flow, true)
    dispose = installMaidBottomVeil(document.body)
    flow.remove()
    await Promise.resolve()
    dispose()
    dispose = undefined
    // 已清理的计时器不再触发任何查询;遮罩已随 dispose 移除
    vi.advanceTimersByTime(RECHECK_MS)
    expect(document.querySelector(STRIP)).toBeNull()
  })
})
