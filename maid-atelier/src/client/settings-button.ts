/**
 * Footer settings button (2026-10-02): the official footer hosts the account
 * button (label = account name). The owner wants the old skin's 「设置」
 * button back — label, look, and one-click behavior.
 *
 * Ground truth: the bottom area's real slot is `sidebar.settings`
 * (registered by ui-settings-general: the shell store + settings trigger;
 * the account launcher also mounts there), while `sidebar.footer.action` is
 * an empty list slot. The skin hides the official trigger(s) (stylesheet)
 * and draws its own 「设置」 button in the same foot area; clicking it
 * forwards to the official trigger — its menu is auto-selected to 设置 by
 * account-menu.ts, so one click opens the settings panel through the
 * official path only.
 */
const SETTINGS_BUTTON_ATTR = 'data-maid-settings-button'
const SETTINGS_OUTLET_SELECTOR = "[data-slot='sidebar.settings']"
const FOOTER_OUTLET_SELECTOR = "[data-slot='sidebar.footer.action']"
const FOOT_ANCHOR_SELECTOR = `:is(${SETTINGS_OUTLET_SELECTOR}, ${FOOTER_OUTLET_SELECTOR})`
// 官方按钮可能被中间容器包裹;真实锚 = 设置触发器/账号菜单(带 aria-haspopup)。
const OFFICIAL_BUTTON_SELECTOR = `${FOOT_ANCHOR_SELECTOR} :is(button, [role='button'], [aria-haspopup])`

export function installMaidSettingsButton(body: HTMLElement): () => void {
  const doc = body.ownerDocument
  const button = doc.createElement('button')
  button.type = 'button'
  button.setAttribute(SETTINGS_BUTTON_ATTR, '')
  button.setAttribute('data-skin-chrome', 'settings-button')
  button.setAttribute('data-skin-owner', 'maid-atelier')
  button.textContent = '设置'

  const place = (): void => {
    // 优先放在 sidebar.settings 所在底部区,官方触发器被隐藏后原位接替。
    const outlet =
      doc.querySelector<HTMLElement>(SETTINGS_OUTLET_SELECTOR) ??
      doc.querySelector<HTMLElement>(FOOTER_OUTLET_SELECTOR)
    const foot = outlet?.parentElement
    if (foot === null || foot === undefined) return
    if (button.parentElement === foot) return
    // 官方重渲染若移除异物节点,观察器会在此重新放回。
    foot.append(button)
  }

  // 只对与底部槽相关的变更重放,避免把对话行/终端行等无关变更拖进查询。
  const relevant = (records: MutationRecord[]): boolean => records.some(record => {
    for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue
      if (node.matches(FOOT_ANCHOR_SELECTOR) || node.querySelector(FOOT_ANCHOR_SELECTOR) !== null) return true
    }
    for (const node of record.removedNodes) {
      if (!(node instanceof Element)) continue
      if (node.matches(`[${SETTINGS_BUTTON_ATTR}]`) || node.matches(FOOT_ANCHOR_SELECTOR) || node.querySelector(FOOT_ANCHOR_SELECTOR) !== null) return true
    }
    return false
  })

  const observer = new MutationObserver((records) => {
    if (relevant(records)) place()
  })
  observer.observe(body, { childList: true, subtree: true })
  place()

  button.addEventListener('click', () => {
    doc.querySelector<HTMLElement>(OFFICIAL_BUTTON_SELECTOR)?.click()
  })

  return () => {
    observer.disconnect()
    button.remove()
  }
}
