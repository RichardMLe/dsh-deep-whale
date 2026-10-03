/**
 * Collapsed rail strip (2026-10-02): the official collapsed sidebar's own
 * background rides --dsw-specific-sidebar-fill which the skin now sets
 * transparent (titlebar fix), so the rail is invisible. The skin draws its
 * own strip on the left edge while the official collapsed state is present
 * ([data-sidebar-collapsed] anywhere), and in fully-hidden mode adds the old
 * skin's circular controls on it: a toggle (expand) and a new-session button,
 * forwarding clicks to the official equivalents. Pure decoration otherwise:
 * the strip itself is pointer-events none; its buttons are clickable.
 */
const STRIP_ATTR = 'data-maid-rail-strip'
const STRIP_FIXED_ATTR = 'data-maid-rail-fixed'
const COLLAPSED_SELECTOR = '[data-sidebar-collapsed]'
const COLUMN_SELECTOR = "[class*='sidebarCol']"
const TOGGLE_LABELS = ['打开侧边栏', '收起侧边栏', 'Open sidebar', 'Collapse sidebar']
const NEW_SESSION_PREFIXES = ['新会话', '新建会话', 'New Session']

const findButtonByLabel = (doc: Document, prefixes: string[]): HTMLButtonElement | undefined =>
  [...doc.querySelectorAll<HTMLButtonElement>('button[aria-label]')].find(button => {
    const label = (button.getAttribute('aria-label') ?? '').trim()
    return prefixes.some(p => label.startsWith(p))
  })

export function installMaidRailStrip(body: HTMLElement): () => void {
  const doc = body.ownerDocument
  let strip: HTMLDivElement | undefined
  let controls: HTMLDivElement | undefined
  let whaleSvgCache: string | undefined
  let toggleButton: HTMLButtonElement | undefined
  let newSessionButton: HTMLButtonElement | undefined
  let workspaceButton: HTMLButtonElement | undefined
  let searchButton: HTMLButtonElement | undefined
  let settingsButton: HTMLButtonElement | undefined

  const styleButton = (button: HTMLButtonElement): void => {
    // 内联样式:绕开一切 CSS 管线歧义,保证圆钮必定可见。
    button.style.display = 'flex'
    button.style.alignItems = 'center'
    button.style.justifyContent = 'center'
    button.style.width = '34px'
    button.style.height = '34px'
    button.style.margin = '10px auto 0'
    button.style.border = '1px solid rgba(211, 180, 119, 0.75)'
    button.style.borderRadius = '50%'
    button.style.background = 'rgba(10, 23, 58, 0.85)'
    button.style.color = '#f2dfba'
    button.style.font = "600 15px/1 Georgia, 'Times New Roman', serif"
    button.style.cursor = 'pointer'
    button.style.pointerEvents = 'auto'
    button.style.position = 'relative'
    button.style.zIndex = '2'
  }

  // 品牌鲸鱼图标 = 展开态品牌图左侧的鲸鱼 mark(sidebar.brand.mark 槽内 svg)。
  // 收起态该槽可能已卸载——安装期即缓存 outerHTML,构建轨钮时兜底复用。
  const captureWhaleSvg = (): void => {
    if (whaleSvgCache !== undefined) return
    const svg = doc.querySelector("[data-slot='sidebar.brand.mark'] svg")
    if (svg !== null) whaleSvgCache = svg.outerHTML
  }
  const useWhaleIcon = (button: HTMLElement): void => {
    captureWhaleSvg()
    const live = doc.querySelector("[data-slot='sidebar.brand.mark'] svg")
    const markup = live !== null ? live.outerHTML : whaleSvgCache
    if (markup !== undefined) {
      const holder = doc.createElement('span')
      holder.innerHTML = markup
      const el = holder.firstElementChild
      if (el !== null) {
        const svg = el as SVGSVGElement
        // 主人定稿:36 宽(4:3 → 36×27;24 太小、48 太大)。
        svg.setAttribute('width', '36')
        svg.setAttribute('height', '27')
        svg.style.display = 'block'
        button.textContent = ''
        button.append(svg)
        return
      }
    }
    button.textContent = '鲸'
  }

  const buildButtons = (): void => {
    if (controls !== undefined) return
    // 控件独立于条:body 级固定容器,z 高于官方内容,不受条内绘制顺序影响。
    controls = doc.createElement('div')
    controls.setAttribute('data-maid-rail-controls', '')
    controls.setAttribute('aria-hidden', 'true')
    controls.setAttribute('data-skin-chrome', 'rail-controls')
    controls.setAttribute('data-skin-owner', 'maid-atelier')
    controls.style.position = 'fixed'
    controls.style.left = '0'
    controls.style.top = 'var(--dsh-windows-titlebar-height, 40px)'
    controls.style.width = '56px'
    controls.style.bottom = '0'
    controls.style.zIndex = '200'
    controls.style.pointerEvents = 'none'
    controls.style.display = 'block'
    // 官方图标克隆(与展开态同款图标,观感一致)
    const cloneIcon = (button: HTMLElement, sourceSelector: string, fallback: string): void => {
      const source = doc.querySelector<HTMLElement>(sourceSelector)
      const svg = source?.querySelector('svg')
      if (svg !== null && svg !== undefined) {
        const clone = svg.cloneNode(true) as SVGSVGElement
        clone.setAttribute('width', '18')
        clone.setAttribute('height', '18')
        clone.style.display = 'block'
        button.textContent = ''
        button.append(clone)
      } else {
        button.textContent = fallback
      }
    }
    // ① 品牌徽记 = 折叠/展开按钮(主人规格):与展开态品牌图同高、同垂直位置——
    // 展开态品牌盒绝对 y≈82 → 轨内 y=42;24 高 × 24 宽,左缘 16(中心 x=28)。
    if (toggleButton === undefined) {
      toggleButton = doc.createElement('button')
      toggleButton.type = 'button'
      toggleButton.setAttribute('data-maid-rail-toggle', '')
      toggleButton.setAttribute('aria-label', '展开侧边栏')
      styleButton(toggleButton)
      // 图标 36×27(主人定稿):按钮盒同步,中心 x=28 → 左缘 10;y=24(上移 1px)+ 右移 1px。
      toggleButton.style.width = '36px'
      toggleButton.style.height = '27px'
      toggleButton.style.border = 'none'
      toggleButton.style.background = 'none'
      toggleButton.style.borderRadius = '0'
      toggleButton.style.color = '#e6c77e'
      toggleButton.style.position = 'absolute'
      toggleButton.style.top = '24px'
      toggleButton.style.left = '11px'
      useWhaleIcon(toggleButton)
      toggleButton.addEventListener('click', () => {
        findButtonByLabel(doc, TOGGLE_LABELS)?.click()
      })
      controls.append(toggleButton)
    }
    // ② 新建会话钮:y=96,左缘 11。
    if (newSessionButton === undefined) {
      newSessionButton = doc.createElement('button')
      newSessionButton.type = 'button'
      newSessionButton.setAttribute('data-maid-rail-new', '')
      newSessionButton.setAttribute('aria-label', '新会话')
      newSessionButton.textContent = '+'
      styleButton(newSessionButton)
      newSessionButton.style.margin = '0'
      newSessionButton.style.position = 'absolute'
      newSessionButton.style.top = '96px'
      newSessionButton.style.left = '11px'
      newSessionButton.addEventListener('click', () => {
        findButtonByLabel(doc, NEW_SESSION_PREFIXES)?.click()
      })
      controls.append(newSessionButton)
    }
    // ③ 新建工程钮:y=142,左缘 11;转发官方「添加工作区」按钮。
    if (workspaceButton === undefined) {
      workspaceButton = doc.createElement('button')
      workspaceButton.type = 'button'
      workspaceButton.setAttribute('data-maid-rail-workspace', '')
      workspaceButton.setAttribute('aria-label', '新建工程')
      styleButton(workspaceButton)
      workspaceButton.style.margin = '0'
      workspaceButton.style.position = 'absolute'
      workspaceButton.style.top = '142px'
      workspaceButton.style.left = '11px'
      cloneIcon(workspaceButton, "button[aria-label='添加工作区'], button[aria-label^='添加工作区']", '▣')
      workspaceButton.addEventListener('click', () => {
        findButtonByLabel(doc, ['添加工作区', 'Add workspace'])?.click()
      })
      controls.append(workspaceButton)
    }
    // ④ 搜索钮:y=188,左缘 11;转发官方「搜索会话」按钮。
    if (searchButton === undefined) {
      searchButton = doc.createElement('button')
      searchButton.type = 'button'
      searchButton.setAttribute('data-maid-rail-search', '')
      searchButton.setAttribute('aria-label', '搜索会话')
      styleButton(searchButton)
      searchButton.style.margin = '0'
      searchButton.style.position = 'absolute'
      searchButton.style.top = '188px'
      searchButton.style.left = '11px'
      cloneIcon(searchButton, "button[aria-label='搜索会话'], button[aria-label^='搜索会话']", '⌕')
      searchButton.addEventListener('click', () => {
        findButtonByLabel(doc, ['搜索会话', 'Search sessions'])?.click()
      })
      controls.append(searchButton)
    }
    // ⑤ 底部设置钮:底缘 14、左缘 11。
    if (settingsButton === undefined) {
      settingsButton = doc.createElement('button')
      settingsButton.type = 'button'
      settingsButton.setAttribute('data-maid-rail-settings', '')
      settingsButton.setAttribute('aria-label', '设置')
      settingsButton.textContent = '⚙'
      styleButton(settingsButton)
      settingsButton.style.margin = '0'
      settingsButton.style.position = 'absolute'
      settingsButton.style.bottom = '14px'
      settingsButton.style.left = '11px'
      settingsButton.addEventListener('click', () => {
        doc.querySelector<HTMLElement>('[data-maid-settings-button]')?.click()
      })
      controls.append(settingsButton)
    }
    body.append(controls)
  }

  const ensureStrip = (): void => {
    if (strip !== undefined) return
    strip = doc.createElement('div')
    strip.setAttribute(STRIP_ATTR, '')
    strip.setAttribute('aria-hidden', 'true')
    strip.setAttribute('data-skin-chrome', 'rail-strip')
    strip.setAttribute('data-skin-owner', 'maid-atelier')
    placeStrip()
    buildButtons()
  }

  const placeStrip = (): void => {
    if (strip === undefined) return
    const column = doc.querySelector<HTMLElement>(COLUMN_SELECTOR)
    const width = column === null ? 0 : column.getBoundingClientRect().width
    if (width < 10) {
      // 完全隐藏:固定贴边条 + 皮肤控件(此模式无官方轨道内容)
      strip.setAttribute(STRIP_FIXED_ATTR, '')
      if (strip.parentElement !== body) body.append(strip)
      // 隐藏官方游离的新会话"+"(位置错乱),皮肤条上的 + 接管。
      const floating = findButtonByLabel(doc, NEW_SESSION_PREFIXES)
      floating?.setAttribute('data-maid-rail-floating-hidden', '')
    } else {
      // 图标轨道:列内背景,排在官方内容之前
      strip.removeAttribute(STRIP_FIXED_ATTR)
      if (column !== null && strip.parentElement !== column) column.prepend(strip)
      doc.querySelectorAll<HTMLElement>('[data-maid-rail-floating-hidden]').forEach(el => el.removeAttribute('data-maid-rail-floating-hidden'))
    }
  }

  const clearFloatingMarks = (): void => {
    doc.querySelectorAll<HTMLElement>('[data-maid-rail-floating-hidden]').forEach(el => el.removeAttribute('data-maid-rail-floating-hidden'))
  }

  // ⑥ 收起时对话标签栏让出 56px:改为纯 CSS(centerCol 左边距,见样式表)。
  // 真机教训:改写官方框架内联 grid-template-columns 会与官方 LayoutController
  // 相互覆盖,导致"点收起整栏消失/再点才出现"的严重错乱——撤回,不再碰内联。

  const sync = (): void => {
    const collapsed = doc.querySelector(COLLAPSED_SELECTOR) !== null
    if (collapsed) {
      ensureStrip()
      placeStrip()
      buildButtons()
    } else {
      strip?.remove() || (strip = undefined)
      controls?.remove() || (controls = undefined)
      toggleButton = undefined
      newSessionButton = undefined
      workspaceButton = undefined
      searchButton = undefined
      settingsButton = undefined
      clearFloatingMarks()
    }
  }

  const observer = new MutationObserver((records) => {
    const relevant = records.some(record => {
      if (record.type === 'attributes' && record.attributeName === 'data-sidebar-collapsed') return true
      for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches(COLLAPSED_SELECTOR) || node.querySelector(COLLAPSED_SELECTOR) !== null)) return true
      }
      for (const node of record.removedNodes) {
        if (node instanceof Element && (node.matches(COLLAPSED_SELECTOR) || node.querySelector(COLLAPSED_SELECTOR) !== null)) return true
      }
      return false
    })
    if (relevant) sync()
  })
  observer.observe(body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-sidebar-collapsed'],
  })
  sync()

  // 官方游离的新会话"+"(固定于标题栏,真机所见透明可点):持续隐藏——React
  // 重渲染会替换节点、丢失单次打标,定时 + 观察器双保险。
  // 真机教训(探针实锤):品牌按钮的 aria-label 也是"新建会话"——上一版误把
  // 品牌按钮当游离"+"隐藏,导致品牌图标消失(快 10 轮的 #3 真因)!
  // 现在只隐藏"fixed 定位且在品牌区之外"的新会话按钮。
  const hideFloating = (): void => {
    for (const btn of doc.querySelectorAll<HTMLElement>('button[aria-label]')) {
      const label = (btn.getAttribute('aria-label') ?? '').trim()
      if (!NEW_SESSION_PREFIXES.some(p => label.startsWith(p))) continue
      if (btn.closest("[class*='logoRow']") !== null) continue
      if (btn.closest('[data-maid-rail-controls]') !== null) continue
      const cs = getComputedStyle(btn)
      if (cs.position !== 'fixed') continue
      btn.setAttribute('data-maid-rail-floating-hidden', '')
    }
  }
  const floatObserver = new MutationObserver(() => hideFloating())
  floatObserver.observe(body, { childList: true, subtree: true })
  // 每秒兜底:缓存品牌鲸鱼 SVG(展开态槽就绪时)+ 若轨钮仍显示回落"鲸"字则
  // 换成真图标——安装期 React 未挂载导致缓存空的场景由此自愈。
  const refreshWhaleMark = (): void => {
    if (whaleSvgCache === undefined) {
      const svg = doc.querySelector("[data-slot='sidebar.brand.mark'] svg")
      if (svg !== null) whaleSvgCache = svg.outerHTML
    }
    if (toggleButton !== undefined && toggleButton.querySelector('svg') === null && whaleSvgCache !== undefined) {
      useWhaleIcon(toggleButton)
    }
  }
  const floatTimer = setInterval(() => {
    hideFloating()
    refreshWhaleMark()
  }, 1000)
  hideFloating()

  // 列宽变化(折叠动画/全屏联动)时重排模式。
  let resizeObserver: ResizeObserver | undefined
  const column = doc.querySelector<HTMLElement>(COLUMN_SELECTOR)
  if (column !== null && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (strip !== undefined) placeStrip()
    })
    resizeObserver.observe(column)
  }

  return () => {
    observer.disconnect()
    floatObserver.disconnect()
    clearInterval(floatTimer)
    resizeObserver?.disconnect()
    strip?.remove()
    strip = undefined
    controls?.remove()
    controls = undefined
    toggleButton = undefined
    newSessionButton = undefined
    workspaceButton = undefined
    searchButton = undefined
    settingsButton = undefined
    clearFloatingMarks()
  }
}
