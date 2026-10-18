// 会话流底部遮罩(覆盖条版,2026-09-08 去放大 M2):
// 旧版把 mask-image 写在 [data-chat-flow] 整条流上,并在 window scroll(capture)上
// 同步重算——超重回合流式期间,自动滚动每帧都触发「getBoundingClientRect 强制布局
// + 整个巨型流的遮罩重绘」,是放大官方投影竞态的皮肤侧主力放大器;且几何无上界守卫,
// 异常时可坍缩成全流透明(9-01 已诊断,当时未落地)。
// 新版改为独立 56px 覆盖条:条内窗口与舞台同盒对齐(宫殿画作逐像素一致),自身带
// 渐变 mask 复刻「渐隐透出画作」的观感。无滚动监听、无流元素测量、无每帧重算——
// 布局变化(工作台推挤/窗口缩放)才重算一次,成本与对话长度无关。流式期间行级
// 增删完全不触发任何动作(S3 语义随新机制自然成立)。
const VEIL_HEIGHT = 56

const FLOW_SELECTOR = '[data-phase="active"] [data-chat-flow]'
const SCROLLER_SELECTOR = '[data-conversation-scroll]'
const PHASE_SELECTOR = '[data-phase]'
const COLUMN_SELECTOR = ":is([data-pane='conversation'], [class*='centerCol'])"
const STRIP_ATTR = 'data-skin-chrome'
const STRIP_VALUE = 'bottom-veil-strip'
const SKIN_OWNER = 'maid-atelier'
// 用户观感微调(9-08):左右各加宽 5px、上下各加宽 5px。
const VEIL_EXTRA_H = 10
const VEIL_EXTRA_V = 10
// 视图切换复查节流(9-12):宿主内突变被跳过时,200ms 静默后复查一次——
// 对话⇄轨迹切换即靠它卸载/重挂遮罩;流式期间突变连续,计时器被不断推迟,
// 复查只在突变停歇后发生一次(S3 语义不变)。
const VEIL_RECHECK_MS = 200
// 尺寸变化追加复查(2026-10-18 主人反馈:窗口放大缩小时遮罩会错误/偶尔失效)。
// 宿主自身在窗口尺寸变化后还有一段布局防抖(index 的 VIEWPORT_RESIZE_SETTLE_MS
// =120ms),我方若只在 resize 事件的当帧量一次,量到的是**过渡态**几何;
// 因此在 resize 后再补一次静置复查,拿到宿主稳定后的盒子。
const VEIL_RESIZE_SETTLE_MS = 180

/** 流是否真的在渲染:display:none/未布局 → false(jsdom 无布局,由测试 mock)。 */
function flowRendered(flow: HTMLElement): boolean {
  try {
    return flow.offsetParent !== null || flow.getClientRects().length > 0
  } catch {
    return false
  }
}

export function installMaidBottomVeil(body: HTMLElement): () => void {
  const doc = body.ownerDocument
  let strip: HTMLDivElement | null = null
  let stripInner: HTMLDivElement | null = null
  let appliedHost: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let observedScroller: HTMLElement | null = null
  let observedHost: HTMLElement | null = null
  let observedColumn: HTMLElement | null = null
  let mutationObserver: MutationObserver | null = null
  let recheckTimer: ReturnType<typeof setTimeout> | null = null
  let widthRetryTimer: ReturnType<typeof setTimeout> | null = null
  let resizeSettleTimer: ReturnType<typeof setTimeout> | null = null

  const removeStrip = (): void => {
    strip?.remove()
    strip = null
    stripInner = null
    appliedHost = null
  }

  const apply = (): void => {
    const flow = body.querySelector<HTMLElement>(FLOW_SELECTOR)
    // 放宽(真机反馈:部分对话如"仿真数据构造"遮罩始终缺失):阶段根存在即挂
    // 遮罩——流缺失/未渲染时退回阶段根的滚动容器;仅当阶段根也不存在才撤。
    const phaseRoot = body.querySelector<HTMLElement>(PHASE_SELECTOR)
    if (phaseRoot === null) {
      removeStrip()
      return
    }
    const rendered = flow !== null && flowRendered(flow)
    const scroller = rendered
      ? flow.closest<HTMLElement>(SCROLLER_SELECTOR)
      : phaseRoot.querySelector<HTMLElement>(SCROLLER_SELECTOR)
    // 覆盖条宿主 = 阶段根([data-phase],皮肤 CSS 令其 position:relative);
    // 缺失时退回滚动容器父级。画作窗口内层按「会话列」盒对齐,与舞台(inset 0
    // + cover)逐像素一致;列缺失时退回宿主盒。
    const host = phaseRoot ?? scroller?.parentElement ?? null
    if (scroller === null || host === null) {
      removeStrip()
      return
    }
    if (strip === null) {
      strip = document.createElement('div')
      strip.setAttribute(STRIP_ATTR, STRIP_VALUE)
      strip.dataset.skinOwner = SKIN_OWNER
      stripInner = document.createElement('div')
      strip.append(stripInner)
    }
    if (strip.parentElement !== host) host.append(strip)

    const scrollerRect = scroller.getBoundingClientRect()
    const hostRect = host.getBoundingClientRect()
    // 退化尺寸守卫(2026-10-18):窗口缩放/视图切换的过渡帧里宿主可能量到 0,
    // 此时写几何会把覆盖条压成一条线或挪到屏外,且后续没有触发器纠正。
    // 跳过写入,保留上一次有效几何,等 resize 静置复查再算。
    if (hostRect.width < 8 || hostRect.height < 8) {
      appliedHost = host
      return
    }
    // 覆盖条 = 滚动视口底部 56px(宿主坐标)。位置只随布局变化,与滚动无关。
    // 上下各加宽 VEIL_EXTRA_V/2:上沿上移、总高增加。
    const top = Math.max(0, scrollerRect.bottom - hostRect.top - VEIL_HEIGHT - VEIL_EXTRA_V / 2)
    if (strip.style.top !== `${top}px`) strip.style.top = `${top}px`
    strip.style.height = `${VEIL_HEIGHT + VEIL_EXTRA_V}px`
    // 宽度 = 转录内容真实宽度(实测行盒最宽者)+ 余量;居中于宿主。
    // 收窄 = 不盖两侧女仆立绘(历轮真机:全宽裁切会盖住立绘的脚);
    // 内层窗口按「宿主/舞台」盒对齐——宫殿画作 cover 于宿主,裁片与背景逐像素一致。
    let contentWidth = 680
    try {
      const declared = getComputedStyle(host).getPropertyValue('--dsh-chat-content-width').trim()
      const parsed = parseFloat(declared)
      if (Number.isFinite(parsed) && parsed > 0) contentWidth = parsed
    } catch {
      // 回落默认
    }
    let measured = 0
    for (const row of flow?.querySelectorAll<HTMLElement>('[data-chat-flow]') ?? []) {
      const w = row.getBoundingClientRect().width
      if (w > measured && w < hostRect.width + 1) measured = w
    }
    const stripWidth = Math.min(hostRect.width, (measured > 0 ? measured : contentWidth) + VEIL_EXTRA_H + 10)
    const stripLeft = Math.max(0, (hostRect.width - stripWidth) / 2)
    strip.style.width = `${stripWidth}px`
    strip.style.left = `${stripLeft}px`
    strip.style.right = 'auto'
    // 切换会话/流式挂载后行盒要更久才布局(真机反馈):周期性重测,
    // 每 800ms 一次、最多 15 次,行宽就绪即校正并停止。
    if (measured === 0) {
      let retryCount = 0
      const retryMeasure = (): void => {
        retryCount += 1
        if (strip === null || appliedHost !== host) return
        let retried = 0
        for (const row of flow?.querySelectorAll<HTMLElement>('[data-chat-flow]') ?? []) {
          const w = row.getBoundingClientRect().width
          if (w > retried && w < hostRect.width + 1) retried = w
        }
        if (retried > 0) {
          const w2 = Math.min(hostRect.width, retried + VEIL_EXTRA_H + 10)
          strip.style.width = `${w2}px`
          strip.style.left = `${Math.max(0, (hostRect.width - w2) / 2)}px`
          return
        }
        if (retryCount < 15) widthRetryTimer = setTimeout(retryMeasure, 800)
      }
      widthRetryTimer = setTimeout(retryMeasure, 800)
    }

    if (stripInner !== null) {
      // 内层窗口 = 宿主(舞台 inset 0 + cover 即宿主盒)——不是"会话列"!
      // 历轮"不契合/放大残留"的真因 = 对齐到了列盒:列 ≠ 宿主时画作比例错位。
      // 覆盖条在宿主内 [stripLeft, top] → 窗口左移 stripLeft、上移 top 即精确裁片。
      const innerLeft = -stripLeft
      const innerTop = -top
      const innerWidth = Math.max(1, hostRect.width)
      const innerHeight = Math.max(1, hostRect.height)
      if (stripInner.style.left !== `${innerLeft}px`) stripInner.style.left = `${innerLeft}px`
      if (stripInner.style.top !== `${innerTop}px`) stripInner.style.top = `${innerTop}px`
      stripInner.style.width = `${innerWidth}px`
      stripInner.style.height = `${innerHeight}px`
    }
    appliedHost = host

    // 观察器重建(2026-10-18):此前只建一次并绑死首个 scroller/host,宿主换节点后
    // 新元素不再被观察,窗口尺寸变化也就收不到信号。改为按当前目标重建,
    // 并额外观察会话列(侧栏展开/收起会改变列宽,但 scroller 的盒子未必变)。
    const column = scroller.closest<HTMLElement>(COLUMN_SELECTOR) ?? host
    if (typeof ResizeObserver !== 'undefined'
      && (resizeObserver === null || observedScroller !== scroller || observedHost !== host || observedColumn !== column)) {
      resizeObserver?.disconnect()
      resizeObserver = new ResizeObserver(() => apply())
      resizeObserver.observe(scroller)
      resizeObserver.observe(host)
      if (column !== host) resizeObserver.observe(column)
      observedScroller = scroller
      observedHost = host
      observedColumn = column
    }
  }

  apply()

  const onViewportResize = (): void => {
    apply()
    // 宿主布局防抖(≈120ms)之后补一次静置复查,取稳定后的盒子。
    if (resizeSettleTimer !== null) clearTimeout(resizeSettleTimer)
    resizeSettleTimer = setTimeout(() => {
      resizeSettleTimer = null
      apply()
    }, VEIL_RESIZE_SETTLE_MS)
  }
  window.addEventListener('resize', onViewportResize)
  window.visualViewport?.addEventListener('resize', onViewportResize)

  // 静默复查(9-12):宿主内突变被跳过时排定一次;流式期间的连续突变不断推迟它,
  // 停歇 200ms 后才真正执行——对话⇄轨迹切换(chat-flow 卸载/重挂)由此收敛。
  const scheduleRecheck = (): void => {
    if (recheckTimer !== null) return
    recheckTimer = setTimeout(() => {
      recheckTimer = null
      const flow = body.querySelector<HTMLElement>(FLOW_SELECTOR)
      if (flow === null || !flowRendered(flow)) {
        removeStrip()
        return
      }
      if (strip === null || appliedHost !== flow.closest<HTMLElement>(PHASE_SELECTOR)) apply()
    }, VEIL_RECHECK_MS)
  }

  // 只关心流的挂载/卸载与宿主替换(切换覆盖条显隐);行级增删——流式期间每帧
  // 大批到达——直接跳过,不做任何查询/写入(S3:流式完全让位)。
  mutationObserver = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type !== 'childList') continue
      const target = record.target instanceof Element ? record.target : null
      if (target !== null && appliedHost !== null && (target === appliedHost || appliedHost.contains(target))) {
        // 宿主自身或其内部的所有变更(流式行增删/视图切换/flow 显隐):不即时查询,
        // 只排一次静默复查——停歇后统一判定遮罩去留(S3:流式完全让位)。
        scheduleRecheck()
        continue
      }
      if (target !== null
        && target.closest(SCROLLER_SELECTOR) === null
        && target.closest(PHASE_SELECTOR) === null
        && target.closest(COLUMN_SELECTOR) === null) continue
      const flow = body.querySelector<HTMLElement>(FLOW_SELECTOR)
      if (flow === null) {
        removeStrip()
        return
      }
      if (strip === null || appliedHost !== flow.closest<HTMLElement>(PHASE_SELECTOR)) apply()
      return
    }
  })
  mutationObserver.observe(body, { childList: true, subtree: true })

  return () => {
    if (recheckTimer !== null) clearTimeout(recheckTimer)
    recheckTimer = null
    if (widthRetryTimer !== null) clearTimeout(widthRetryTimer)
    widthRetryTimer = null
    if (resizeSettleTimer !== null) clearTimeout(resizeSettleTimer)
    resizeSettleTimer = null
    window.removeEventListener('resize', onViewportResize)
    window.visualViewport?.removeEventListener('resize', onViewportResize)
    resizeObserver?.disconnect()
    observedScroller = null
    observedHost = null
    observedColumn = null
    mutationObserver?.disconnect()
    removeStrip()
  }
}
