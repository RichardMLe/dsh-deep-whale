# maid-atelier · 深海女仆工坊

DeepSeek Harness Web GUI 的深海女仆工坊皮肤：双女仆背景、深海蓝蕾丝界面与 Q 版侧栏。纯展示层客户端插件——`apply()` 设置 `data-dsh-maid-atelier` 作用域、按亮/暗主题切换宫殿背景、以独立透明层挂载双女仆角色、装饰可折叠侧栏,并为加载/思考/工具运行状态预留稳定动画钩子。effect 销毁器还原全部 CSS/DOM 写入;不注入服务、不发出 Cordis 事件、不触达模型请求。

## 特性

- 双女仆工坊场景对话背景(亮/暗自动切换)
- 深海蓝、陶瓷白、长春花蓝、柔金构成的可热切换 UI 覆盖层
- Q 版侧栏角色与视口装饰、favicon
- 双女仆与宫殿背景整层挂在**对话区(centerCol)内部**:随聊天区域尺寸自适应(右/下工作台推开聊天区时背景与女仆同步收缩,不再固定于视口),左女仆贴聊天区左下、右女仆贴右下,均位于聊天记录与输入器之下;聊天态与着陆页按比例切换构图
- 素材内嵌于 client bundle(数据 URI),激活不依赖任何临时文件/远程 URL/资源服务器

## 安装

推荐连同皮肤管理器一起，从仓库一行安装（需要 pnpm ≥ 9，`#path:` 子目录语法）：

```sh
dsh plugin --profile web add 'github:Small-tailqwq/dsh-deep-whale#path:/skin-manager' && dsh plugin --profile web add 'github:Small-tailqwq/dsh-deep-whale#path:/maid-atelier'
```

PowerShell 版本（`#` 是注释起始，spec 必须单引号包裹）见仓库 README。首次安装后重启一次 DSH，然后在“设置 → 皮肤管理”中选择“深海女仆工坊”；之后切换走配置热重载。独立子包 link 仅用于本地开发。

加载即生效、卸载即复原(与皮肤中心/dsh-skin 的互斥切换兼容,`wiring.id` 为 `ui-skin-maid-atelier`)。

## 适配官方桌面版（nightly 0.2.0-rc.2）

官方桌面版自 rc.6 起重构了 Web GUI 外壳：布局改为标题栏 + 三列网格，槽位由 `data-slot`
渲染器注入，类名全部成为构建哈希。皮肤已按新契约重锚（只改皮肤、不碰官方代码），
在 Windows 桌面版实测通过（1707×1019、DPR 1.5）。

**主要适配点**

- **收起侧边栏**：官方收起态把轨宽归零、内容并入标题栏，皮肤改为自绘 56px 栏杆——
  顶部品牌鲸鱼徽记（同时是折叠/展开钮，展开态与收起态位置尺寸一致）、新建会话、新建工程、
  搜索，底部设置；底色与展开态同值 `#0a173b` 且不加叠层。
- **全屏右栏**：收起态让出 56px（`max-width:calc(100vw - 56px)` + 内容限宽），
  不再侵占收起条；收起条层级提到 70 以压住右栏。
- **标题栏金线**：整窗宽 1px 金线压在标题栏下沿，把菜单栏与内容（含同色右栏）严格分开。
- **设置面板**：宽度 `min(960px, 100vw-48px)`（官方 800px）；页面白卡自身 28px 内边距、
  首个子元素顶部内边距归零（消除"权限"行多出的 16px）；排版统一为
  主标题 18/600、区块 14/600、正文 14/400、行名 14/500、小标签 12/400。
- **底部遮罩**：宽度=宿主全宽、内窗按宿主盒对齐，与背景画作逐像素贴合。
- **官方触发按钮**：底部账号触发器与账号菜单里的「设置/意见反馈/退出登录」隐去，
  改由皮肤自绘按钮直达设置面板。

**清单**：`skin.json.dshCompatibility = 0.2.0rc2`；`skin.build.json` 由构建生成（含指纹与源码提交号）。
测试 175 项通过。迁移经验与工具见上游开发档案（`皮肤迁移-经验教训.md`、`工具/`）。

## 素材来源与许可

本皮肤整体以 **CC BY-NC-SA 4.0**(署名-非商业性使用-相同方式共享)发布,**禁止任何商业性使用**。

皮肤素材为衍生创作,署名链(详见 `NOTICE`):

1. **一创 上善**（[Pixiv](https://www.pixiv.net/users/62155430) · [Bilibili：上善无形](https://b23.tv/8h5L4xz)）—— 鲸鱼娘角色形象原作者
2. **二创 ZipZipPipe**（[Pixiv](https://www.pixiv.net/users/18604994) · [Bilibili：ZipZipPipe](https://b23.tv/Pnw6nG8)）—— 在其形象上加入 DeepSeek 元素的女仆鲸鱼娘二次设计(生成模型 GPT Image 2)
3. **三创(本皮肤)Small-tailqwq** —— DeepSeek 元素再设计

完整许可文本见 `LICENSE`;素材源文件在 `assets/`。

## 开发与构建

皮肤工程脚手架(目录模板、`tsdown.client.ts` 构建预设、`dsh-skin-new` 脚手架、皮肤中心与切换脚本)来自 [zhu1090093659/dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)(作者:Solitude)——**本仓库只分发皮肤成品(含预构建 `lib/`),不包含脚手架**。开发构建请在该仓库的 `skins/maid-atelier/` 目录进行:

```sh
cd <dsh-web-ui>/skins/maid-atelier
pnpm build          # 重新生成素材嵌入 + tsdown 构建 lib/
pnpm test           # apply.spec.ts 行为测试
```

构建产物 `lib/` 提交回本仓库即完成一次皮肤更新。

## 许可

CC BY-NC-SA 4.0。见 `LICENSE` 与 `NOTICE`。
