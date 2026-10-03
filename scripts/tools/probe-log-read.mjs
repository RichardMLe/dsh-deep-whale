// probe-log-read.mjs —— 客户端探针日志读取工具(可复用)
//
// 背景:皮肤/插件在真机页面上取证时,常把 JSON 探针数据 POST 给宿主,由宿主按行
// 追加到日志文件;单行超过宿主上限时客户端会按 2500 字符分片,行首写成
//   [<reason> <i>/<N>] <片段>
// 本工具把这些分片按时间顺序重组回完整 JSON,并按需只打印关心的键。
//
// 用法:
//   node probe-log-read.mjs [日志路径] [--tail 3] [--key settingsPanel]
// 默认日志:鲸鱼娘GAL/05-开发档案/watchdog.log
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const positional = args.filter(a => !a.startsWith('--'))
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? dflt : args[i + 1]
}
const logPath = positional[0]
  ?? path.join('C:/Users/11488/Documents/deepseek_harness/杂项/鲸鱼娘GAL/05-开发档案/watchdog.log')
const tail = Number(flag('tail', 3))
const onlyKey = flag('key', null)

const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/)
const captures = []
let current = null
for (const line of lines) {
  const m = line.match(/^(\d{4}-\d\d-\d\dT[^ ]+) \[(\w+) (\d+)\/(\d+)\] (.*)$/)
  if (m === null) continue
  const index = Number(m[3])
  const total = Number(m[4])
  if (index === 1) {
    if (current !== null) captures.push(current)
    current = { at: m[1], reason: m[2], pieces: [] }
  }
  if (current !== null) current.pieces[index - 1] = m[5]
  if (index === total && current !== null) {
    captures.push(current)
    current = null
  }
}
if (current !== null) captures.push(current)
console.log(`日志:${logPath}\n重组捕获:${captures.length} 条\n`)

let shown = 0
for (const c of captures.slice().reverse()) {
  const json = c.pieces.filter(Boolean).join('')
  let payload = null
  try { payload = JSON.parse(json) } catch {
    console.log(`==== ${c.reason} @${c.at} 解析失败(${json.length} 字符,可能分片不全)`)
    continue
  }
  if (onlyKey !== null && (payload[onlyKey] === undefined || payload[onlyKey] === null)) continue
  console.log(`==== ${c.reason} @${c.at} ====`)
  if (onlyKey !== null) console.log(JSON.stringify(payload[onlyKey], null, 1))
  else console.log(JSON.stringify(payload, null, 1).slice(0, 4000))
  shown += 1
  if (shown >= tail) break
}
if (shown === 0) console.log('(无可展示捕获:检查 --key 或日志时间范围)')
