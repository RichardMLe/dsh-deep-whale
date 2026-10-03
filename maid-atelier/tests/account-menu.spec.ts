// @vitest-environment jsdom
/**
 * account-menu spec(2026-10-02 新版迁移):账号菜单中的「意见反馈/退出登录」被皮肤
 * 收敛(隐藏标记,二者已迁入设置面板);菜单挂载即自动点选「设置」(单击底部按钮 =
 * 打开设置);冷却期内不重复自动点选;dispose 清理观察器。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMaidAccountMenu } from '../src/client/account-menu.ts'

let dispose: (() => void) | undefined

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-02T12:00:00Z'))
})

afterEach(() => {
  dispose?.()
  dispose = undefined
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

function mountMenu(): HTMLDivElement {
  const menu = document.createElement('div')
  // 实测:菜单容器可能不带 role,菜单项文本带快捷键后缀(如"设置 Ctrl+,")
  const make = (label: string): HTMLButtonElement => {
    const b = document.createElement('button')
    b.textContent = label
    menu.append(b)
    return b
  }
  make('设置 Ctrl+,')
  make('意见反馈')
  make('退出登录')
  document.body.append(menu)
  return menu
}

async function flush(): Promise<void> {
  await Promise.resolve()
}

const findItem = (root: Element, prefix: string): HTMLElement | undefined =>
  [...root.querySelectorAll<HTMLElement>('button, [role="menuitem"]')].find(i => (i.textContent ?? '').trim().startsWith(prefix))

describe('installMaidAccountMenu', () => {
  it('hides 意见反馈/退出登录/设置, auto-selects 设置 once per menu mount', async () => {
    dispose = installMaidAccountMenu(document.body)
    const menu = mountMenu()
    await flush()
    expect(findItem(menu, '退出登录')?.hasAttribute('data-maid-menu-hidden')).toBe(true)
    expect(findItem(menu, '意见反馈')?.hasAttribute('data-maid-menu-hidden')).toBe(true)
    const settings = findItem(menu, '设置')
    // 2026-10-02:菜单项是预挂载的真实按钮,「设置」也必须隐藏(先点选后隐藏),
    // 否则菜单一开就复现原始设置按钮。
    expect(settings?.hasAttribute('data-maid-menu-hidden')).toBe(true)
    // 首次挂载的自动点选已随 flush 发生;冷却期满后重挂,再次点选且只点一次
    menu.remove()
    vi.advanceTimersByTime(700)
    const remounted = mountMenu()
    const remountedSettings = findItem(remounted, '设置') as HTMLElement
    const clickSpy = vi.spyOn(remountedSettings, 'click')
    await flush()
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('honours the auto-select cooldown across rapid remounts', async () => {
    dispose = installMaidAccountMenu(document.body)
    const first = mountMenu()
    const firstSettings = findItem(first, '设置') as HTMLElement
    const firstSpy = vi.spyOn(firstSettings, 'click')
    await flush()
    expect(firstSpy).toHaveBeenCalledTimes(1)
    // 冷却期内重挂不重复点选
    first.remove()
    const second = mountMenu()
    const secondSettings = findItem(second, '设置') as HTMLElement
    const secondSpy = vi.spyOn(secondSettings, 'click')
    await flush()
    expect(secondSpy).not.toHaveBeenCalled()
    // 冷却期满后再次挂载恢复点选
    second.remove()
    vi.advanceTimersByTime(700)
    const third = mountMenu()
    const thirdSettings = findItem(third, '设置') as HTMLElement
    const thirdSpy = vi.spyOn(thirdSettings, 'click')
    await flush()
    expect(thirdSpy).toHaveBeenCalledTimes(1)
  })

  it('also reconciles menus nested inside a mounted container', async () => {
    dispose = installMaidAccountMenu(document.body)
    const wrapper = document.createElement('div')
    wrapper.innerHTML = '<div><button>Sign out</button><button>Feedback</button></div>'
    document.body.append(wrapper)
    await flush()
    const items = [...wrapper.querySelectorAll('button')]
    expect(items.every(i => i.hasAttribute('data-maid-menu-hidden'))).toBe(true)
  })

  it('stops reconciling after dispose', async () => {
    dispose = installMaidAccountMenu(document.body)
    dispose()
    dispose = undefined
    const menu = mountMenu()
    await flush()
    expect(findItem(menu, '退出登录')?.hasAttribute('data-maid-menu-hidden')).toBeFalsy()
  })
})
