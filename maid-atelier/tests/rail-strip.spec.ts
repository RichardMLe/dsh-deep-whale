// @vitest-environment jsdom
/**
 * rail-strip spec(2026-10-02):官方折叠态([data-sidebar-collapsed] 任意位置)
 * 出现 → 皮肤贴边侧边条;消失 → 撤;dispose 清理。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { installMaidRailStrip } from '../src/client/rail-strip.ts'

let dispose: (() => void) | undefined

afterEach(() => {
  dispose?.()
  dispose = undefined
  document.body.innerHTML = ''
})

async function flush(): Promise<void> {
  await Promise.resolve()
}

describe('installMaidRailStrip', () => {
  it('shows the strip while the collapsed state exists anywhere', async () => {
    dispose = installMaidRailStrip(document.body)
    const frame = document.createElement('div')
    frame.setAttribute('data-sidebar-collapsed', '')
    document.body.append(frame)
    await flush()
    expect(document.querySelector('[data-maid-rail-strip]')).not.toBeNull()
    frame.remove()
    await flush()
    expect(document.querySelector('[data-maid-rail-strip]')).toBeNull()
  })

  it('tracks the collapsed attribute toggles', async () => {
    dispose = installMaidRailStrip(document.body)
    const root = document.createElement('div')
    document.body.append(root)
    await flush()
    expect(document.querySelector('[data-maid-rail-strip]')).toBeNull()
    root.setAttribute('data-sidebar-collapsed', 'true')
    await flush()
    expect(document.querySelector('[data-maid-rail-strip]')).not.toBeNull()
    root.removeAttribute('data-sidebar-collapsed')
    await flush()
    expect(document.querySelector('[data-maid-rail-strip]')).toBeNull()
  })

  it('removes the strip on dispose', async () => {
    dispose = installMaidRailStrip(document.body)
    const frame = document.createElement('div')
    frame.setAttribute('data-sidebar-collapsed', '')
    document.body.append(frame)
    await flush()
    dispose()
    dispose = undefined
    expect(document.querySelector('[data-maid-rail-strip]')).toBeNull()
  })
})
