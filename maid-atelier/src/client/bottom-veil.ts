// 会话流底部遮罩：固定罩住「输入框下缘至屏幕底端」这段区域（与滚动位置无关）。
// 纯 CSS 的 mask 只能锚在元素盒上（滚动时遮罩会跟着内容走）；这里在滚动/尺寸/
// DOM 变化时把渐变遮罩的上下沿换算成流盒内像素写回内联样式，实现"遮罩固定在
// 窗口底部这一段"——只隐掉该区背后的对话，上方消息行完全不受影响。

const VEIL_HEIGHT = 56

const FLOW_SELECTOR = '[data-phase="active"] [data-chat-flow]'
const SCROLLER_SELECTOR = '[data-conversation-scroll]'

export function installMaidBottomVeil(body: HTMLElement): () => void {
  let raf = 0
  let appliedFlow: HTMLElement | null = null
  let appliedScroller: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let mutationObserver: MutationObserver | null = null

  const apply = (): void => {
    raf = 0
    const flow = body.querySelector<HTMLElement>(FLOW_SELECTOR)
    if (flow === null) {
      // 会话流消失：清掉上次写在旧流上的内联遮罩
      if (appliedFlow !== null) {
        appliedFlow.style.removeProperty('mask-image')
        appliedFlow.style.removeProperty('-webkit-mask-image')
        appliedFlow = null
        appliedScroller = null
      }
      return
    }
    const scroller = flow.closest<HTMLElement>(SCROLLER_SELECTOR) ?? flow.parentElement
    const flowRect = flow.getBoundingClientRect()
    const bottomRef = scroller !== null && scroller !== undefined
      ? scroller.getBoundingClientRect().bottom
      : flowRect.bottom
    const yBottom = Math.max(VEIL_HEIGHT, bottomRef - flowRect.top)
    const yTop = yBottom - VEIL_HEIGHT
    const mask = `linear-gradient(180deg, #000 ${yTop}px, transparent ${yBottom}px)`
    flow.style.setProperty('mask-image', mask)
    flow.style.setProperty('-webkit-mask-image', mask)
    appliedFlow = flow
    appliedScroller = scroller
    if (resizeObserver === null && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(schedule)
      resizeObserver.observe(flow)
      if (appliedScroller !== null && appliedScroller !== undefined && appliedScroller !== flow) {
        resizeObserver.observe(appliedScroller)
      }
    }
  }

  const schedule = (): void => {
    if (raf !== 0) return
    raf = window.requestAnimationFrame(apply)
  }

  apply()
  // scroll 事件不冒泡：capture 阶段挂在 window 上能收到所有滚动器的滚动。
  // 滚动必须**同步**应用（rAF 会让遮罩落后一帧：新位置先露出内容再渐隐）；
  // resize/DOM 变化走 rAF 合并（这些不参与逐帧滚动，合并即可）。
  const onScroll = (): void => {
    apply()
  }
  window.addEventListener('scroll', onScroll, { capture: true, passive: true })
  mutationObserver = new MutationObserver((records) => {
    // 只关心会话流的挂载/卸载（避免每帧文本变更触发重算——文本变更不改变遮罩几何）。
    let relevant = false
    for (const record of records) {
      if (record.type !== 'childList') continue
      if (record.target instanceof HTMLElement && record.target.closest('[data-conversation-scroll]') !== null) {
        relevant = true
        break
      }
    }
    if (relevant) schedule()
  })
  mutationObserver.observe(body, { childList: true, subtree: true })

  return () => {
    if (raf !== 0) {
      cancelAnimationFrame(raf)
      raf = 0
    }
    window.removeEventListener('scroll', onScroll, { capture: true })
    if (resizeObserver !== null) resizeObserver.disconnect()
    if (mutationObserver !== null) mutationObserver.disconnect()
    if (appliedFlow !== null) {
      appliedFlow.style.removeProperty('mask-image')
      appliedFlow.style.removeProperty('-webkit-mask-image')
      appliedFlow = null
      appliedScroller = null
    }
  }
}
