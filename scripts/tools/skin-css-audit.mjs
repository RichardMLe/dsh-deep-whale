// skin-css-audit.mjs —— 皮肤样式表自查/官方排版审计(可复用)
//
// 用途:
//   ① 审自己的皮肤:把样式表里"设置了布局关键属性"的规则挑出来(内边距/宽高/
//      z-index/层级契约),迁移后逐条复核,避免误伤官方布局;
//   ② 审官方:在 asar 抽出的设置包/侧栏包里统计各页字号字重,定统一规范前先有表。
//
// 用法:
//   node skin-css-audit.mjs self  [样式表路径]
//   node skin-css-audit.mjs fonts <抽取目录>      例:node skin-css-audit.mjs fonts %TEMP%/dsh-asar-probe
import fs from 'node:fs'
import path from 'node:path'

const [mode, arg] = process.argv.slice(2)

if (mode === 'fonts') {
  const dir = arg ?? path.join(process.env.TEMP ?? '/tmp', 'dsh-asar-probe')
  const files = fs.readdirSync(dir).filter(f => /settings|sidebar/i.test(f) && f.endsWith('.js'))
  for (const file of files) {
    const s = fs.readFileSync(path.join(dir, file), 'utf8')
    const rows = new Map()
    const re = /\.([A-Za-z0-9_]+)\{([^}]*)\}/g
    let m
    while ((m = re.exec(s)) !== null) {
      const body = m[2]
      if (!/font-size|font-weight/.test(body)) continue
      if (rows.has(m[1])) continue
      const size = (body.match(/font-size:([^;]+)/) ?? [, '-'])[1]
      const weight = (body.match(/font-weight:([^;]+)/) ?? [, '-'])[1]
      rows.set(m[1], `${size.trim()} / ${weight.trim()}`)
    }
    if (rows.size === 0) continue
    console.log(`==== ${file}`)
    for (const [cls, v] of rows) console.log(`   ${cls.padEnd(28)} ${v}`)
  }
} else {
  const cssPath = arg ?? 'C:/Users/11488/code/dsh-deep-whale/maid-atelier/src/client/maid-atelier.module.css'
  const css = fs.readFileSync(cssPath, 'utf8')
  const rules = css.split(/\n(?=body\[|html\[|@)/)
  const interesting = /(padding|margin|width|height|z-index|position)\s*:/
  let n = 0
  for (const rule of rules) {
    const head = rule.slice(0, rule.indexOf('{') === -1 ? 120 : rule.indexOf('{')).replace(/\s+/g, ' ').trim()
    if (head === '' || !interesting.test(rule)) continue
    const selector = head.slice(0, 90)
    if (/settings|sidebar|rail|rightbar|frame|window/i.test(selector)) {
      console.log(`— ${selector}`)
      n += 1
    }
    if (n > 60) break
  }
  console.log(`\n共列出 ${n} 条布局相关规则（设置/侧栏/收起条/右栏/框架/窗口）——迁移后逐条复核。`)
}
