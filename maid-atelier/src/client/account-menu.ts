/**
 * Account-menu reconciliation (2026-10-02, new-shell migration): the new
 * sidebar footer hosts the official account menu (设置 / 意见反馈 / 退出登录).
 * The owner wants the footer button to BE the settings button:
 *  - 意见反馈/退出登录 迁入设置面板后,菜单内这两项由皮肤隐藏;
 *  - 菜单一经挂载即自动点选「设置」——单击底部按钮 = 直接打开设置面板。
 *
 * 实测教训(探针回传):菜单是预挂载、靠 aria-expanded 切换显示——展开时不产生
 * 新增节点,纯 childList 观察器哑火;菜单项文本带快捷键后缀。改为双通道:
 * ①aria-expanded 翻转(属性观察)→ 微任务后全页扫描点选;②childList 兜底;
 * 标签按归一化前缀匹配。
 */
const HIDDEN_ITEM_ATTR = 'data-maid-menu-hidden'
const HIDE_PREFIXES = ['退出登录', '意见反馈', 'Sign out', 'Log out', 'Feedback']
const SETTINGS_PREFIXES = ['设置', 'Settings']
const CANDIDATE_SELECTOR = '[role="menuitem"], [role="option"], [role="menuitemcheckbox"], button, a'
const AUTO_SELECT_COOLDOWN_MS = 600

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim()
const hasPrefix = (label: string, prefixes: string[]): boolean =>
  prefixes.some(prefix => label.startsWith(prefix))

export function installMaidAccountMenu(body: HTMLElement): () => void {
  const doc = body.ownerDocument
  let lastAutoSelectAt = 0

  const reconcileItem = (item: Element): void => {
    // 真机教训(探针实锤):我们的「设置」按钮文本也是"设置"——上一版观察器
    // 把自己的按钮当菜单项隐藏了(快 10 轮的 #6 真因)。皮肤自有按钮一律跳过。
    if (item.hasAttribute('data-maid-settings-button') || item.hasAttribute('data-maid-rail-settings')) return
    const label = normalize(item.textContent ?? '')
    if (label === '') return
    if (hasPrefix(label, SETTINGS_PREFIXES)) {
      // 先点选(自动直达设置),再把菜单项也隐藏:
      // 菜单项是预挂载的真实按钮,菜单一开「设置」就露出来(主人所见"复现")。
      const now = Date.now()
      if (now - lastAutoSelectAt >= AUTO_SELECT_COOLDOWN_MS) {
        lastAutoSelectAt = now
        // 官方菜单项接受真实点击:onSelect → openSettings() 并关闭菜单。
        ;(item as HTMLElement).click()
      }
      item.setAttribute(HIDDEN_ITEM_ATTR, '')
      return
    }
    if (hasPrefix(label, HIDE_PREFIXES)) {
      item.setAttribute(HIDDEN_ITEM_ATTR, '')
    }
  }

  const reconcile = (root: Element): void => {
    // 节点自身可能是菜单项(非 button/role 变体),一并判定。
    if (root.matches(CANDIDATE_SELECTOR)) {
      reconcileItem(root)
      return
    }
    for (const item of root.querySelectorAll<Element>(CANDIDATE_SELECTOR)) reconcileItem(item)
  }

  // 属性通道:任何 aria-haspopup 触发器展开 → 微任务后全页点选「设置」。
  const autoSelectOpenMenu = (): void => {
    queueMicrotask(() => {
      const candidates = [...doc.querySelectorAll<Element>(CANDIDATE_SELECTOR)]
        .filter(item => hasPrefix(normalize(item.textContent ?? ''), SETTINGS_PREFIXES))
      const last = candidates[candidates.length - 1]
      if (last !== undefined) reconcileItem(last)
    })
  }

  const attributeObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type !== 'attributes' || record.attributeName !== 'aria-expanded') continue
      const el = record.target as Element
      if (el.getAttribute('aria-expanded') === 'true') autoSelectOpenMenu()
    }
  })
  attributeObserver.observe(body, { subtree: true, attributes: true, attributeFilter: ['aria-expanded'] })

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        reconcile(node)
      }
    }
  })
  observer.observe(body, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
    attributeObserver.disconnect()
  }
}
