// asar-recon.mjs —— 官方应用 app.asar 侦察工具(可复用)
//
// 用途:迁移/适配皮肤或插件时,读取官方一手代码(S1 证据):列包、抽文件、搜规则。
// 用法:
//   node asar-recon.mjs list [过滤词]                列出 @deepseek-ai 下的包
//   node asar-recon.mjs files <包名> [过滤词]         列出包内文件(含大小)
//   node asar-recon.mjs extract <包名> <路径片段>     抽取匹配文件到 %TEMP%\dsh-asar-probe
//   node asar-recon.mjs grep <包名> <正则>           在包内 .js 里搜(打印上下文)
//
// 例:
//   node asar-recon.mjs list settings
//   node asar-recon.mjs grep dsh-client-ui-settings-models "_section\\{"
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ASAR = process.env.DSH_ASAR
  ?? 'C:/Users/11488/AppData/Local/Programs/DeepSeek Harness/resources/app.asar'
const OUT = path.join(os.tmpdir(), 'dsh-asar-probe')

function openHeader() {
  const fd = fs.openSync(ASAR, 'r')
  const head = Buffer.alloc(16)
  fs.readSync(fd, head, 0, 16, 0)
  const jsonBytes = head.readUInt32LE(12)
  const raw = Buffer.alloc(jsonBytes + 64)
  fs.readSync(fd, raw, 0, raw.length, 16)
  let header = null
  for (let cut = 0; cut < 64; cut += 1) {
    try { header = JSON.parse(raw.toString('utf8', 0, jsonBytes - cut)); break } catch { /* 继续裁 */ }
  }
  if (header === null) throw new Error('asar header 解析失败')
  fs.closeSync(fd)
  return { header, base: Math.ceil((16 + jsonBytes) / 4) * 4 }
}

const { header, base } = openHeader()
const packages = header.files?.dsh?.files?.node_modules?.files?.['@deepseek-ai']?.files ?? {}
const [mode, ...rest] = process.argv.slice(2)

function listFiles(entry, prefix, filter) {
  const out = []
  const walk = (dir, p) => {
    for (const [name, e] of Object.entries(dir.files ?? {})) {
      const cur = p ? `${p}/${name}` : name
      if (e.files !== undefined) walk(e, cur)
      else if (filter === '' || cur.includes(filter)) out.push({ cur, size: e.size, offset: Number(e.offset) })
    }
  }
  walk(entry, prefix)
  return out
}

if (mode === 'list') {
  const filter = rest[0] ?? ''
  for (const name of Object.keys(packages).filter(n => n.includes(filter))) console.log(name)
} else if (mode === 'files') {
  const [pkgName, filter = ''] = rest
  const entry = packages[pkgName]
  if (entry === undefined) { console.log('miss:', pkgName); process.exit(1) }
  for (const f of listFiles(entry, pkgName, filter)) console.log(`  ${f.cur} ${f.size}`)
} else if (mode === 'extract' || mode === 'grep') {
  const [pkgName, arg] = rest
  const entry = packages[pkgName]
  if (entry === undefined) { console.log('miss:', pkgName); process.exit(1) }
  const files = listFiles(entry, pkgName, mode === 'grep' ? '' : (arg ?? '')).filter(f => f.cur.endsWith('.js'))
  fs.mkdirSync(OUT, { recursive: true })
  const fd = fs.openSync(ASAR, 'r')
  const re = mode === 'grep' ? new RegExp(arg, 'g') : null
  let hits = 0
  for (const f of files) {
    const buf = Buffer.alloc(f.size)
    fs.readSync(fd, buf, 0, f.size, base + f.offset)
    const s = buf.toString('utf8')
    if (mode === 'extract') {
      const dest = path.join(OUT, f.cur.replace(/^dsh\/node_modules\/@deepseek-ai\//, '').replace(/\//g, '__'))
      fs.writeFileSync(dest, buf)
      console.log('ok:', f.cur, f.size)
    } else {
      let m
      while ((m = re.exec(s)) !== null && hits < 40) {
        console.log(`== ${f.cur} @${m.index}`)
        console.log(`   …${s.slice(Math.max(0, m.index - 160), m.index + 220).replace(/\s+/g, ' ')}…`)
        hits += 1
      }
    }
  }
  fs.closeSync(fd)
  if (mode === 'grep') console.log(`命中 ${hits} 处;抽取目录可用 extract 模式落盘:${OUT}`)
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 13).join('\n'))
}
