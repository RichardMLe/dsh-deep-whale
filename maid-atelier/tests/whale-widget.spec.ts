// @vitest-environment jsdom
/**
 * whale-widget spec(2026-10-02):皮肤客户端注入挂件脚本(宿主路由
 * /dsh-whale/widget.js),dispose 移除;脚本自带去重。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { installMaidWhaleWidget } from '../src/client/whale-widget.ts'

let dispose: (() => void) | undefined

afterEach(() => {
  dispose?.()
  dispose = undefined
  document.head.innerHTML = ''
})

describe('installMaidWhaleWidget', () => {
  it('appends the widget script with defer and skin owner marks', () => {
    dispose = installMaidWhaleWidget(document.body)
    const s = document.head.querySelector('script[src="/dsh-whale/widget.js"]') as HTMLScriptElement | null
    expect(s).not.toBeNull()
    expect(s?.defer).toBe(true)
    expect(s?.getAttribute('data-skin-owner')).toBe('maid-atelier')
  })

  it('removes the script on dispose', () => {
    dispose = installMaidWhaleWidget(document.body)
    dispose()
    dispose = undefined
    expect(document.head.querySelector('script[src="/dsh-whale/widget.js"]')).toBeNull()
  })
})
