// @vitest-environment jsdom
/**
 * settings-button spec(2026-10-02):皮肤在 sidebar.footer.action 槽旁自绘
 * 「设置」按钮;点击转发官方按钮(官方菜单自动点选设置);被官方重渲染移除后
 * 观察器放回;dispose 清理。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installMaidSettingsButton } from '../src/client/settings-button.ts'

let dispose: (() => void) | undefined

afterEach(() => {
  dispose?.()
  dispose = undefined
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

async function flush(): Promise<void> {
  await Promise.resolve()
}

function mountFooter(): { outlet: HTMLElement; official: HTMLButtonElement; foot: HTMLElement } {
  const foot = document.createElement('div')
  const outlet = document.createElement('div')
  // 真实锚 = sidebar.settings(ui-settings-general 注册;footer.action 为空列表槽)
  outlet.setAttribute('data-slot', 'sidebar.settings')
  // 官方触发器被中间容器包裹,且带 aria-haspopup(账号菜单)
  const wrapper = document.createElement('div')
  const official = document.createElement('button')
  official.textContent = '账号名'
  official.setAttribute('aria-haspopup', 'menu')
  wrapper.append(official)
  outlet.append(wrapper)
  foot.append(outlet)
  document.body.append(foot)
  return { outlet, official, foot }
}

describe('installMaidSettingsButton', () => {
  it('places a labelled 设置 button beside the footer slot', async () => {
    dispose = installMaidSettingsButton(document.body)
    const { foot } = mountFooter()
    await flush()
    const skin = foot.querySelector<HTMLElement>('[data-maid-settings-button]')
    expect(skin).not.toBeNull()
    expect(skin?.textContent).toBe('设置')
    expect(skin?.parentElement).toBe(foot)
  })

  it('forwards clicks to the official footer button', async () => {
    dispose = installMaidSettingsButton(document.body)
    const { foot, official } = mountFooter()
    await flush()
    const spy = vi.spyOn(official, 'click')
    const skin = foot.querySelector<HTMLElement>('[data-maid-settings-button]')
    skin?.click()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('re-places the button if the official re-render drops it', async () => {
    dispose = installMaidSettingsButton(document.body)
    const { foot } = mountFooter()
    await flush()
    const skin = foot.querySelector<HTMLElement>('[data-maid-settings-button]')
    expect(skin).not.toBeNull()
    skin?.remove()
    await flush()
    expect(foot.querySelector<HTMLElement>('[data-maid-settings-button]')).not.toBeNull()
  })

  it('removes the button on dispose', async () => {
    dispose = installMaidSettingsButton(document.body)
    mountFooter()
    await flush()
    dispose()
    dispose = undefined
    expect(document.querySelector('[data-maid-settings-button]')).toBeNull()
  })
})
