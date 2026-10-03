// @vitest-environment jsdom
/**
 * brand-toggle spec(2026-10-02):点品牌图标 = 收起/展开侧边栏(旧版行为),
 * 不再新建会话;转发点击官方折叠钮(aria-label 收起/打开侧边栏,en 同义)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installMaidBrandToggle } from '../src/client/brand-toggle.ts'

let dispose: (() => void) | undefined

afterEach(() => {
  dispose?.()
  dispose = undefined
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function mountBrandAndToggle(): { brand: HTMLElement; toggle: HTMLButtonElement } {
  const brandButton = document.createElement('button')
  brandButton.id = 'brand-button'
  const mark = document.createElement('span')
  mark.setAttribute('data-slot', 'sidebar.brand.mark')
  brandButton.append(mark)
  document.body.append(brandButton)
  const toggle = document.createElement('button')
  toggle.setAttribute('aria-label', '收起侧边栏')
  document.body.append(toggle)
  return { brand: brandButton, toggle }
}

describe('installMaidBrandToggle', () => {
  it('turns a brand click into a sidebar toggle, cancelling the default', () => {
    dispose = installMaidBrandToggle(document.body)
    const { brand, toggle } = mountBrandAndToggle()
    const toggleSpy = vi.spyOn(toggle, 'click')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    brand.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(toggleSpy).toHaveBeenCalledTimes(1)
  })

  it('also catches clicks on the brand button padding (non-slot area)', () => {
    dispose = installMaidBrandToggle(document.body)
    const { brand, toggle } = mountBrandAndToggle()
    const toggleSpy = vi.spyOn(toggle, 'click')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    brand.dispatchEvent(event)
    expect(toggleSpy).toHaveBeenCalledTimes(1)
  })

  it('leaves unrelated clicks alone', () => {
    dispose = installMaidBrandToggle(document.body)
    const { toggle } = mountBrandAndToggle()
    const other = document.createElement('button')
    other.textContent = '普通按钮'
    document.body.append(other)
    const toggleSpy = vi.spyOn(toggle, 'click')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    other.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(toggleSpy).not.toHaveBeenCalled()
  })

  it('stops intercepting after dispose', () => {
    dispose = installMaidBrandToggle(document.body)
    dispose()
    dispose = undefined
    const { brand, toggle } = mountBrandAndToggle()
    const toggleSpy = vi.spyOn(toggle, 'click')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    brand.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(toggleSpy).not.toHaveBeenCalled()
  })
})
