/**
 * Official chrome tagging (2026-10-02): convert Chinese anchors into ASCII
 * data attributes so every later rule survives any parsing pipeline, and
 * apply the titlebar toggle color inline (highest priority).
 * - [data-maid-official-settings]  → 官方设置触发器(隐藏用)
 * - [data-maid-official-toggle]    → 官方折叠/展开钮(颜色用,内联上色)
 * - [data-maid-panel-plugins]      → 侧边栏「插件」面板行(隐藏用)
 */
const TOGGLE_LABELS = ['收起侧边栏', '打开侧边栏', 'Collapse sidebar', 'Open sidebar']

export function installMaidChromeTags(body: HTMLElement): () => void {
  const doc = body.ownerDocument

  // 底部触发器的"外壳链"一并隐藏:按钮 display:none 后其包装层(触发行/根)
  // 残留成灰色长条(真机所见)。只允许在 sidebar.settings 槽子树内打标——
  // 上一版"无槽即上溯到 body"误伤右栏(aria-haspopup 按钮的祖先链被打标隐藏,
  // 右栏按钮整体消失,真机实证)。
  const settingsOutlet = (): HTMLElement | null => doc.querySelector<HTMLElement>("[data-slot='sidebar.settings']")
  const tagWrapperChain = (btn: HTMLElement): void => {
    const outlet = settingsOutlet()
    let node: HTMLElement | null = btn.parentElement
    while (node !== null && node !== body) {
      if (node === outlet || (outlet !== null && !outlet.contains(node))) break
      node.setAttribute('data-maid-official-settings-row', '')
      node = node.parentElement
    }
  }

  const tagAll = (): void => {
    for (const btn of doc.querySelectorAll<HTMLElement>('button')) {
      if (btn.hasAttribute('data-maid-settings-button')) continue
      const label = (btn.getAttribute('aria-label') ?? '').trim()
      const text = (btn.textContent ?? '').trim()
      const isSettingsLike = label.startsWith('设置') || label.startsWith('Settings') || text.startsWith('设置') || text.startsWith('Settings')
      // 账号触发器:仅在底部槽子树内识别(aria-haspopup 全局判定会误伤右栏)。
      const insideSettingsSlot = settingsOutlet()?.contains(btn) ?? false
      const isAccountTrigger = insideSettingsSlot && (label.startsWith('账号菜单') || label.startsWith('Account menu') || btn.getAttribute('aria-haspopup') === 'menu')
      if (isSettingsLike || isAccountTrigger) {
        btn.setAttribute('data-maid-official-settings', '')
        if (insideSettingsSlot) tagWrapperChain(btn)
      }
      if (TOGGLE_LABELS.some(p => label.startsWith(p))) {
        btn.setAttribute('data-maid-official-toggle', '')
        // 内联上色(真机探针实证):官方 token 在 frame 作用域被覆写成近白,
        // var(--dsw-alias-*) 在此按钮上解析错误——改用皮肤自有变量
        // var(--maid-ink)(亮=深墨蓝,暗=浅月白),无官方层可覆盖。
        btn.style.color = 'var(--maid-ink)'
        btn.style.background = 'transparent'
      }
      if (label.startsWith('插件') || label.startsWith('Plugins')) {
        btn.setAttribute('data-maid-panel-plugins', '')
      }
    }
  }

  // 设置面板"白底卡片"打标(2026-10-03):只给**自身有背景色**的页面容器加
  // 内边距(样式表按 data-maid-settings-card 加 28px)——通用设置页那些无底色
  // 的分组不再被误加,消除"权限"多出的约 16px。
  const tagSettingsCards = (): void => {
    const dialog = doc.querySelector<HTMLElement>("[role='dialog'][data-shortcut-modal='settings']")
    if (dialog === null) return
    for (const el of dialog.querySelectorAll<HTMLElement>("[class*='_section']")) {
      let bg = ''
      try { bg = getComputedStyle(el).backgroundColor } catch { bg = '' }
      const isCard = bg !== '' && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)'
      if (isCard) el.setAttribute('data-maid-settings-card', '')
      else el.removeAttribute('data-maid-settings-card')
    }
  }

  const observer = new MutationObserver(() => tagAll())
  observer.observe(body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label'],
  })
  tagAll()
  // 卡片打标走独立节拍(120ms):不进入突变回调——突变路径必须保持"零查询"
  // (既有契约:better-sidebar 终端行突变不得触发任何 querySelector)。
  // 120ms = 切页后间距立刻补上(此前 1000ms 被主人实测为"要等一秒")。
  tagSettingsCards()
  const cardTimer = setInterval(() => { tagSettingsCards() }, 120)

  return () => {
    observer.disconnect()
    clearInterval(cardTimer)
  }
}
