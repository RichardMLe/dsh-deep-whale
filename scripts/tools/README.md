# scripts/tools · 维护工具箱

迁移 / 适配 / 排查时反复用到的脚本。纯 Node 或 Python(仅测图脚本需要 Pillow),
无第三方依赖;路径按本机默认写死处均可用环境变量覆盖。

| 脚本 | 用途 | 典型用法 |
|---|---|---|
| `asar-recon.mjs` | **官方源码侦察**:列包 / 列文件 / 抽取 / 正则检索桌面端 `app.asar` 里的官方前端包 | `node asar-recon.mjs list settings`<br>`node asar-recon.mjs grep dsh-client-ui-settings-models "_section\\{"` |
| `build-verify.mjs` | **构建一致性校验**:源码 / 构建产物 / profile 实际加载副本三处比对,并支持断言脚手架已清除 | `node build-verify.mjs "padding:28px" --absent "diag-probe"` |
| `probe-log-read.mjs` | **探针日志读取**:客户端把 JSON POST 给宿主、宿主逐行落盘并按 2500 字符分片,本脚本按时间重组分片 | `node probe-log-read.mjs --tail 5 --key settingsPanel` |
| `measure-shot.py` | **截图像素测量**:沿指定行列打印颜色突变点、给出近白区块边界(务必用已知参照物换算比例) | `python measure-shot.py 截图.png --row 300 --col 700` |
| `measure-corner-art.py` | **角饰素材测量**:量出贴图里金线的位置与粗细,供 CSS offset / 线宽取值 | `python measure-corner-art.py assets/maid-sidebar-corner-v1.webp` |
| `skin-css-audit.mjs` | **样式自查 / 排版审计**:列出皮肤里涉布局的关键规则;统计官方各设置页字号字重 | `node skin-css-audit.mjs self`<br>`node skin-css-audit.mjs fonts %TEMP%/dsh-asar-probe` |

## 三条纪律

1. **先读官方源码**(`asar-recon`)再动样式——官方原文是判断"谁的责任、该改哪一层"的唯一硬证据;
2. **改完必跑** `build-verify`——"改了没生效"在本项目出现过多次(没改文件 / 窗口跑旧构建 / 改在另一份源码上);
3. **副像素微调上限 2~3 轮**——超出后先问「我真正要控制的是几个**设备**像素」,`目标设备像素 ÷ DPR = CSS 值`(DPR 1.5 时 1 设备像素 = 0.667 CSS px)。

经验与决策记录见 `.agents/notes/implemented/`(本地开发笔记,不入库)。
