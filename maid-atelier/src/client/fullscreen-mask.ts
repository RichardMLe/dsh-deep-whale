/**
 * Fullscreen mask (2026-10-02): the official right-bar fullscreen covers the
 * left with a TRANSPARENT click-blocking layer, so leftover left UI (top tab
 * strip, composer, stage) stays visible through it. The owner asked for a
 * mask with the same fill as the right bar instead of hiding parts of the
 * left one by one. The LEFT SIDEBAR stays visible (official design keeps it
 * outside the fullscreen pane), so the mask's left edge is measured to the
 * sidebar's current width at show time.
 *
 * The mask mirrors the official state marker only — no state of its own:
 * the panel carries [data-sidebar-right-panel='fullscreen'] while in
 * fullscreen and [data-sidebar-right-open] while the right bar is expanded.
 * Hide is debounced (150ms) so session switches that re-render the pane
 * (marker briefly removed then re-added) never flicker.
 *
 * Collapse linkage: collapsing the right bar keeps the official fullscreen
 * mode on (the pane re-opens in fullscreen). Best effort: auto-click the
 * official exit-fullscreen button ([data-sidebar-right-mode='push']) while
 * the panel closes. Safety net lives in the stylesheet: the fullscreen pane
 * is not rendered while the right bar is closed, so the left always comes
 * back even if the synthetic click is ignored.
 */
const MASK_ATTR = 'data-maid-fullscreen-mask'
const MASK_HIDDEN_ATTR = 'data-maid-mask-hidden'
const PANEL_SELECTOR = '[data-sidebar-right-panel]'
const EXIT_SELECTOR = "[data-sidebar-right-mode='push']"
const HIDE_DEBOUNCE_MS = 150

export function installMaidFullscreenMask(body: HTMLElement): () => void {
  const doc = body.ownerDocument
  let mask: HTMLDivElement | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  const panelState = (): { fullscreen: boolean; open: boolean } => {
    const panel = doc.querySelector<HTMLElement>(PANEL_SELECTOR)
    if (panel === null) return { fullscreen: false, open: false }
    return {
      fullscreen: panel.getAttribute('data-sidebar-right-panel') === 'fullscreen',
      open: panel.hasAttribute('data-sidebar-right-open'),
    }
  }

  // 遮罩左缘 = 侧边栏实测宽度:侧边栏在官方全屏中保留可见,遮罩不得盖住它。
  // 双锚兜底(sidebar 槽出口 + sidebarCol 列),取最大有效宽度。
  const measureLeft = (): number => {
    const candidates = doc.querySelectorAll<HTMLElement>("[data-slot='sidebar'], [class*='sidebarCol']")
    let max = 0
    for (const el of candidates) {
      const rect = el.getBoundingClientRect()
      if (rect.width > max && rect.width < window.innerWidth - 200) max = rect.width
    }
    return max
  }

  const ensureMask = (): void => {
    if (mask !== undefined) return
    mask = doc.createElement('div')
    mask.setAttribute(MASK_ATTR, '')
    mask.setAttribute('aria-hidden', 'true')
    mask.setAttribute('data-skin-chrome', 'fullscreen-mask')
    mask.setAttribute('data-skin-owner', 'maid-atelier')
    body.append(mask)
  }

  const show = (): void => {
    if (hideTimer !== undefined) {
      clearTimeout(hideTimer)
      hideTimer = undefined
    }
    ensureMask()
    if (mask !== undefined) {
      mask.style.left = `${measureLeft()}px`
      // 遮罩色 = 右侧栏可见底色。真机反馈:右栏底色与顶部菜单栏一致——两者都
      // 落在透明 token 上、露出 body 背景。取 body 的计算背景色即与之一致;
      // 若取不到再回落窗格/dock/右栏列采样。
      const bodyBg = doc.defaultView?.getComputedStyle(body).backgroundColor ?? ''
      let bg = bodyBg
      if (bg === '' || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
        const rightbar = doc.querySelector<HTMLElement>(
          "[data-dockkit-pane], [data-dockkit-host='dock'], [class*='rightbarCol']",
        )
        bg = rightbar === null ? '' : doc.defaultView?.getComputedStyle(rightbar).backgroundColor ?? ''
      }
      if (bg !== '' && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') mask.style.background = bg
    }
    mask?.removeAttribute(MASK_HIDDEN_ATTR)
  }

  const hideSoon = (): void => {
    if (hideTimer !== undefined) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      hideTimer = undefined
      mask?.setAttribute(MASK_HIDDEN_ATTR, '')
    }, HIDE_DEBOUNCE_MS)
  }

  const sync = (): void => {
    const { fullscreen, open } = panelState()
    if (fullscreen && open) {
      show()
      return
    }
    if (fullscreen && !open) {
      // 收起却仍处全屏:尽力补官方「退出全屏」;样式安全网保证左侧不空白。
      const exit = doc.querySelector<HTMLElement>(EXIT_SELECTOR)
      exit?.click()
      hideSoon()
      return
    }
    hideSoon()
  }

  // 只对与右栏面板相关的变更做同步,避免把对话行/终端行等无关变更拖进查询。
  // 侧边栏折叠(全屏中收起左侧栏)也会改布局 → data-sidebar-collapsed 一并监听。
  const relevant = (records: MutationRecord[]): boolean => records.some(record => {
    if (record.type === 'attributes') {
      return (
        record.attributeName === 'data-sidebar-right-panel' ||
        record.attributeName === 'data-sidebar-right-open' ||
        record.attributeName === 'data-sidebar-collapsed'
      )
    }
    for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue
      if (node.matches(PANEL_SELECTOR) || node.querySelector(PANEL_SELECTOR) !== null) return true
    }
    for (const node of record.removedNodes) {
      if (node instanceof Element && (node.matches(PANEL_SELECTOR) || node.querySelector(PANEL_SELECTOR) !== null)) return true
    }
    return false
  })

  const observer = new MutationObserver((records) => {
    if (relevant(records)) sync()
  })
  observer.observe(body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-sidebar-right-panel', 'data-sidebar-right-open', 'data-sidebar-collapsed'],
  })

  // 侧边栏宽度变化(展开/收起)时,若遮罩可见则重测左缘与底色。
  const onResize = (): void => {
    if (mask === undefined || mask.hasAttribute(MASK_HIDDEN_ATTR)) return
    mask.style.left = `${measureLeft()}px`
  }
  window.addEventListener('resize', onResize)

  sync()

  return () => {
    observer.disconnect()
    window.removeEventListener('resize', onResize)
    if (hideTimer !== undefined) clearTimeout(hideTimer)
    mask?.remove()
    mask = undefined
  }
}
