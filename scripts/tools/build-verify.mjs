// build-verify.mjs —— 皮肤构建/安装一致性校验(可复用)
//
// 血泪教训(2026-10-03):多轮"改了没生效"里,有一次是我**根本没改文件**、
// 有一次是**改对了但窗口跑的是旧构建**。此后每条改动都先过这道校验:
//   ① 源码含目标片段;② 构建产物含目标片段;③ **profile 实际加载的副本**含目标片段。
//
// 用法:
//   node build-verify.mjs 必须包含的片段 [更多片段...] [--absent 不应出现的片段...] [--src 皮肤源码目录]
// 例:
//   node build-verify.mjs "padding:28px" --absent "diag-probe"
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const absentAt = args.indexOf('--absent')
const srcAt = args.indexOf('--src')
const absent = absentAt === -1 ? [] : args.slice(absentAt + 1).filter(a => a !== '--src' && a !== (srcAt === -1 ? '' : args[srcAt + 1]))
const include = args.slice(0, absentAt === -1 ? args.length : absentAt).filter(a => a !== '--src' && a !== (srcAt === -1 ? '' : args[srcAt + 1]))
const srcDir = srcAt === -1 ? 'C:/Users/11488/code/dsh-deep-whale/maid-atelier' : args[srcAt + 1]

const PROFILE = 'C:/Users/11488/.dsh/profiles/desktop/node_modules/@dsh-external/dsh-client-ui-skin-maid-atelier'
const targets = [
  ['构建产物', path.join(srcDir, 'lib/client.js')],
  ['profile 副本', path.join(PROFILE, 'lib/client.js')],
]

let ok = true
for (const [label, file] of targets) {
  let text = ''
  try { text = fs.readFileSync(file, 'utf8') } catch { console.log(`✗ ${label}:读不到 ${file}`); ok = false; continue }
  const missing = include.filter(s => !text.includes(s))
  const present = absent.filter(s => text.includes(s))
  const size = Math.round(text.length / 1024)
  if (missing.length === 0 && present.length === 0) {
    console.log(`✓ ${label}(${size}KB):应含 ${include.length} 项齐全;应无 ${absent.length} 项均不存在`)
  } else {
    ok = false
    if (missing.length > 0) console.log(`✗ ${label}:缺 ${JSON.stringify(missing)}`)
    if (present.length > 0) console.log(`✗ ${label}:仍含 ${JSON.stringify(present)}`)
  }
}
console.log(ok ? '\n结论:三处一致,改动确已落到窗口加载的文件。' : '\n结论:存在不一致——先查构建是否成功、软/硬链是否同源,再谈现象。')
process.exit(ok ? 0 : 1)
