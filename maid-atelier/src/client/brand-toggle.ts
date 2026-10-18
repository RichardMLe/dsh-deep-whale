/**
 * Brand toggle (2026-10-02): in the new shell the sidebar brand click starts
 * a NEW session, while the owner expects the old behavior — clicking the
 * brand collapses/expands the sidebar. The skin intercepts brand clicks and
 * forwards them to the official sidebar toggle button (aria-label 收起/打开
 * 侧边栏, en equivalents), whose 56px rail the skin styles as the side strip.
 */
const BRAND_SLOT_SELECTOR = "[data-slot='sidebar.brand.mark'], [data-slot='sidebar.brand.name']"
const TOGGLE_LABELS = new Set(['收起侧边栏', '打开侧边栏', 'Collapse sidebar', 'Open sidebar'])

export function installMaidBrandToggle(body: HTMLElement): () => void {
  const doc = body.ownerDocument

  const resolveBrand = (target: Element): Element | null => {
    const direct = target.closest(BRAND_SLOT_SELECTOR)
    if (direct !== null) return direct
    // 点击品牌按钮的非槽区域:按钮内含品牌槽即为品牌按钮。
    const button = target.closest('button')
    if (button !== null) {
      // 2026-10-18 关键修复:官方折叠/展开钮本身(aria-label 收起/打开侧边栏)
      // 在收起态**内部就含品牌 mark 槽**,于是被误判成"品牌点击" →
      // 本监听器 stopPropagation 吞掉事件 → 宿主永远收不到 → 收起后展不开
      // (真机表现为"左栏点了就消失")。此处显式放行官方折叠钮,交给宿主处理;
      // 同时放行轨道自绘按钮。
      const label = (button.getAttribute('aria-label') ?? '').trim()
      if (TOGGLE_LABELS.has(label) || button.closest('[data-maid-rail-controls]') !== null) return null
      if (button.querySelector(BRAND_SLOT_SELECTOR) !== null) return button
    }
    return null
  }

  const onClick = (event: MouseEvent): void => {
    if (event.button !== 0 || event.defaultPrevented) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (resolveBrand(target) === null) return
    event.preventDefault()
    event.stopPropagation()
    const toggle = [...doc.querySelectorAll<HTMLElement>('button[aria-label]')].find(button =>
      TOGGLE_LABELS.has(button.getAttribute('aria-label') ?? ''),
    )
    toggle?.click()
  }

  doc.addEventListener('click', onClick, true)
  return () => {
    doc.removeEventListener('click', onClick, true)
  }
}
