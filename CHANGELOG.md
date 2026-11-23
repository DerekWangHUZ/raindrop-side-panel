# 更新日志

## 3.0

**前端架构、页面布局与组件体系全面推倒重做**：

- **技术栈对齐官方规范**：采用官方 [`deeplethe/solid-glass`](https://github.com/deeplethe/solid-glass) 标准技术栈（React 19 + TypeScript + Vite + Tailwind CSS 4 + `@base-ui/react` shadcn/ui + `lucide-react`），原样引入官方 `solid-glass.css`（零魔改 token、零残留 AppleMusicUI 类名与自定义 CSS 覆盖层），通过 `html.dark` 切换深浅模式。
- **侧边栏页面布局重构**：
  - 消除原本双层重复标题与内联树挤压列表的问题，改为单行顶栏 + 左侧滑出收藏夹抽屉（`Sheet`，宽屏 `>=720px` 自动停靠）。
  - 集成搜索与排序工具条（支持 `/` 与 `⌘K` 快捷键、点击书签 `Tag` 直接过滤、摘要预览开关）。
  - 当前页快存卡（`Card`）支持一键折叠；多选复选框常态隐藏节省横向空间，开启多选或悬停/选中时显现，底部浮现 `bg-popover` 批量操作栏。
  - 弹窗与操作菜单全面替换为 Base UI 原生 `Dialog`、`AlertDialog`、`Select` 与 `DropdownMenu`。
- **设置页重构**：使用官方 `Tabs` 组织「账户与连接」「外观与材质」「标题与摘要优化」三大页签，修复原 `applyThemeModeButtons` 未定义导致的运行时崩溃，并附带三档玻璃厚度预览。
- **核心逻辑零损失**：保留 `api.js`、`optimizer.js`、`page-meta.js`、`utils.mjs`、`background.js` 与所有 `chrome.storage.local` 键名，新增 Vitest 组件测试与 MV3 `dist/` CSP 契约校验。

## 2.1

**前端整体推倒重做**：两个页面的 HTML 结构、CSS、视图层渲染 JS 与 UI 契约测试全部重写，从 AppleMusicUI 音乐播放器皮肤彻底换成官方 **Solid Glass**（[deeplethe/solid-glass](https://github.com/deeplethe/solid-glass) main 分支，2026-11-23 抓取）的组件语言。功能零损失：全部元素 id、存储键、API 行为、键盘可达性保持不变。

### 结构语言（对齐官方组件）

- **书签列表 = ItemGroup + Item**：留缝的圆角薄玻璃卡片流（行间 gap 8px），每行是独立面板（`--panel` 最薄档玻璃面 + `--glass-edge` 发丝线 + `--glass-inner` 内圈 rim，10px 圆角）。音乐播放器的通栏发丝线表格（52px 行贴行 + 底边线 + `.songlist` 通栏线）整体退役。行尾操作按钮按官方 ItemActions 行为：平时隐藏，hover / 键盘聚焦所在行浮现，触摸设备常显。
- **收藏夹树 = SidebarMenuButton / SidebarMenuSub**：32px、9px 圆角行（不再是 999px 胶囊导航），chevron 折叠开关移进按钮内部槽位，子级是真嵌套 `ul.menu-sub`（缩进 + 左侧 1px 竖向发丝线导轨），层级靠结构表达；`--depth` 扁平缩进与绝对定位折叠钮退役。选中行走唯一状态清玻璃三件套。
- **保存区 = Item 卡片**：ItemMedia + 标题/描述 + 行尾实心墨面按钮；56px 胶囊（`.player` 圆帽几何）退役，圆帽内缩契约随之移除。
- **顶栏 = ghost 工具栏**：透明图标按钮 + hover `--hover`，品牌名 title1 刻度；不再铺一条区域玻璃。
- **设置页 = glass-panel 卡片 + card-row 行**：四张最薄档玻璃卡片、32px 头；行组织是官方 Item 语言（标题 headline + 描述 footnote muted + 控件右侧）。「明暗模式」改为官方**凹槽分段控件**（`--well-shade`/`--well-rim` 光反向 + 选中段唯一状态清玻璃），替换原下拉框。
- **空状态 = 官方 Empty 语言**：清玻璃图标盒 + headline 标题 + muted 描述。
- **弹层/菜单/选择条/Toast**：统一 popover 最厚档玻璃 pane（`--player-bg` + rim/发丝线/底部收光）；书签操作菜单与树行同语言（32px/9px 圆角行）。

### 材质补齐（官方 main 逐字）

- `.glass-panel` 官方定义（`--panel` 面 + rim/inner/edge/shadow 五件套）——此前 options 卡片引用它但 CSS 从未定义。
- 官方 token 入位：`--panel`、凹槽 `--well-shade`/`--well-rim`、语义色相 `--success`/`--code-inline`、唯一状态显式别名 `--glass-state`。
- 复选框官方材质：未选凹槽、选中实心墨面 pane。主按钮官方 hover（墨面变薄 10% 不换色）/active（收站立阴影）。
- 输入域聚焦只提亮边线（删 3px 外环）；计数 `tabular-nums`。
- 加载指示换官方 **dot-loader**（三点闪光 `sg-dot-flash`），旧转圈 spinner 删除；`.is-loading` 与图标互斥不变。
- 减透明降级补齐官方实色取值（`--primary-solid: 100%`、`--panel` 实色）。

### 契约测试

- 重写守门清单：侧边栏必须用官方组件词汇（item-group/item/menu-btn/menu-sub/save-card/toolbar…），设置页必须用（glass-panel/card/segmented/field-input…）；新材质锁（`.item` 引 `--panel/--glass-edge/--glass-inner` 且无逐行阴影毛玻璃、`.menu-sub` 左导轨、`.menu-btn--selected` 唯一状态三件套、`.segmented` 凹槽、行尾按钮浮现规则、无 spinner 残留）。
- 保留全部既有守门精神：id 契约、dialog/showModal、图标 sprite、禁字形、vendor 溯源与 token 锁、封面二选一逻辑、无障碍三守卫、CSP。
- 移除随旧结构退役的断言：save-pill 圆帽几何、`.card-sub` 截断盒、AppleMusicUI 类名清单。

### 组件审查修复（逐组件对照官方源码）

用户指出排序下拉仍在用浏览器原生弹层（白底白字）。复盘发现整套组件语言仍有系统性偏差，本轮按官方 `button.tsx` / `checkbox.tsx` / `dialog.tsx` / `empty.tsx` / `field.tsx` / `tabs.tsx` / `select.tsx` / `item.tsx` 逐项修复：

- **原生下拉 → 官方 Select**（P0）：6 个原生 `<select>`（排序、三个弹层收藏夹选择、设置页两个下拉）保留为隐藏数据源，新增 `ui-select.js` 渲染字段玻璃触发器 + popover 玻璃列表（top layer，弹层内不被裁剪、不被 inert）；选中行唯一状态 + 右侧勾形，方向键/Home/End/Enter/Escape/Tab/外部点击闭环。
- **按钮**（P1）：`.btn-pill` 从 1000px 胶囊改为官方 Button 几何（32px / 9px 圆角 / px 10 / text-sm / 500 / svg 16）；危险按钮从实红底白字改为官方 destructive 淡红 tint（12% 底 + danger 文字 + 28%/16% 收光）；次要按钮补 glass 变体的 contact 阴影，hover 改 `--hover`。
- **字号体系**（P1）：新增官方 Tailwind 字级 token（text-sm 14/20、text-xs 12/16、text-base 16/24，vendor 只增不改）；正文、按钮、表单、菜单、Item 标题、设置行改回 text-sm；描述/元信息 12px；品牌名 14/500；收藏夹分组标题 12/500 muted；弹窗标题 16/500。
- **复选框**（P2）：20px 圆形 → 官方 16px / 4px 圆角方形 + 可见发丝边框；未选凹槽、选中墨面材质保留；伪元素外扩命中区。
- **折叠钮**（P2）：树行展开/收起从无 tabindex 的 span 改为真实 `<button class="menu-toggle">`（`aria-expanded`），键盘可达；行结构改为 `li.menu-row`。
- **菜单高亮**（P2）：菜单行/选项行 hover 从平涂 tint 改为唯一状态清玻璃（glass-state + 顶缘光线 + 发丝线）。
- **对话框**（P2）：标题 22/700 → 官方 DialogTitle 16/500；动作区改为独立 `.dialog-footer`（顶部分隔线 + 4% 淡底 + 内边距）。
- **空状态**（P2）：图标盒 44 → 官方 Empty 的 32px；标题/描述 text-sm。
- **分段控件**（P3）：去外圈描边（官方托盘是凹槽）；选中段改官方 active tab（glass-control + contact + glass-edge 边框）；text-sm。
- **焦点环**（P3）：全局 `:focus-visible` 改用 `--focus-line`（细线 + 1px 间隙）。
- 契约测试新增 11 条锁定（官方字级 token、按钮几何、destructive tint、contact 阴影、Select 替换、复选框 16/4、折叠钮真实按钮、菜单高亮唯一状态、dialog-footer、空状态 32、focus-line），并把 `ui-select.js` 纳入禁字形扫描。

## 2.0

界面改为**直接复用** AppleMusicUI 的样式表，而不是照着气质另写一套。

- 新增 `apple-music.css`：从参考项目 `be958b4`（2026-10-29）的 `css/styles.css` 逐字 vendor（808 行）。相对原文只有 6 处可清点的改写：溯源注释、两个危险色 token、浅色 token 块加 `:not([data-theme-effective="dark"])` 并补一份等值属性选择器（首帧不闪主题）、三处浅色组件 tint 改属性选择器、`.btn-pill` 深色改属性选择器、`--accent-blue` 接上插件既有 7 色。
- 侧边栏改为参考项目组件的组合：`.sidebar` 提供浮现玻璃面板（离屏 12px / 圆角 20px / `--panel-shadow`），`.search-field`、`.nav-group`+`.nav-link`+`.nav-icon`、`.shelf-title`、`.songlist`+`.song-row`+`.song-row__img`、`.lcd-art`/`.lcd-title`/`.lcd-artist`、`.player` 胶囊、`.drawer` 弹层、`.volume-pop` 菜单材质、`.btn-pill`、`.pbtn`、`.empty-note`、`.page` 全部按参考原样使用。
- 新增 `ui-base.css`：只放参考项目没有的东西（`.hidden` 等状态类、键盘焦点、共享表单控件、`dialog` 重置、加载指示、三种无障碍偏好）。
- 侧边栏视觉：全书签列表不再通栏——所有内容都在浮起面板内，发丝分隔线随面板内缩；hover 只换 `--nav-hover` 底色。
- 列表改为参考项目的 `.song-row` 行式布局：38px 圆角 4 封面 + 标题 + `.sub` 两行文字，行尾一个 `•••` 菜单（打开 / 优化 / 编辑 / 删除）替代原先三个常驻按钮与两行摘要。
- 收藏夹改为可折叠分组，默认收起、状态存 `chrome.storage.local.collectionTreeOpen`；选择态直接用参考的 `.nav-item--selected > .nav-link`。
- 批量操作改为吸底胶囊选择条，勾选时列表不再位移；新增取消选择。
- 弹窗改为底部弹出层（`.drawer` 材质 + 上圆角 20px），支持点遮罩关闭；确认框走 `finishConfirm(false)`。
- 复选框保留常驻，改为 20px 圆形（未选描边圈、选中强调色实心加勾、半选为横线）。
- 新增 `tests/ui-contract.test.mjs`：`#id` 与图标 sprite 契约、禁用字形、**渲染层必须复用的参考类名清单**、vendor 溯源与 token 取值抽查、无内联脚本。

### 界面来源

界面样式来自姊妹项目 **AppleMusicUI**（`music.apple.com` 网页播放器的 1:1 复刻）：

- 仓库：`../AppleMusicUI`，commit `be958b4fba80a7d2e6bfbacb12d025c3641d24c3`（2026-10-29）
- `apple-music.css` 是它的 `css/styles.css` 逐字副本（808 行）。**不要手工微调**：要改就在
  `sidepanel.css` / `options.css` 里做局部覆盖，这样本文件始终能与上游 diff。
- 相对原文只有 6 处改写，全部列在文件头的注释里：溯源注释、两个危险色 token、
  浅色 token 块的选择器（插件用 `data-theme-effective`，并保留媒体查询覆盖首帧）、
  三处浅色组件 tint、`.btn-pill` 的深色分支、`--accent-blue` 接上插件的七色调色板。
- 图标 sprite 同样抄自参考项目的 `index.html`，只补了它没有的 5 个：齿轮、铅笔、闪光、垃圾桶、钥匙。

**逐字复用**（材质、字阶、圆角、间距节奏、hover 与选中态全部来自参考）：
`.sidebar` `.sidebar__scroll` `.sidebar__logo*` `.search-field` `.shelf-title` `.page-title`
`.page` `.nav-group` `.nav-item` `.nav-link` `.nav-icon` `.nav-label` `.nav-item--selected`
`.songlist` `.song-row` `.song-row__img` `.song-row__t` `.sub` `.player` `.lcd-art`
`.lcd-title` `.lcd-artist` `.drawer` `.volume-pop` `.btn-pill` `.pbtn` `.empty-note`
`.card-sub` `.detail-foot` `.drawer-edit`。

**需要覆盖几何的那几处**（参考项目里它们是桌面上的 `position: fixed` 元素，逐条注释写在
`sidepanel.css` 的「几何覆盖」一节）：`.panel`（补 `right`、放开固定宽度）、
`.save-pill` / `.selection-bar` / `.toast`（把 `.player` 改成自适应宽度）、
`.menu`（把 `.volume-pop` 从胶囊改成多行菜单）、`dialog.app-dialog.drawer`（全屏抽屉改底部弹层）。
另外中和了参考项目 `≤500px` 的移动端布局切换（它会隐藏 `.sidebar` 与 `.player`，
插件侧边栏没有那套手机外壳）。

`ui-base.css` 放参考项目没有的部分：状态类、键盘焦点、共享表单控件、`dialog` 重置、
加载指示，以及减少动态 / 减少透明 / 高对比三种无障碍偏好。

### 修正

- **列表头折行**：`#resultCount` 与「收藏夹」右侧的当前名带着参考项目 `.card-sub` 的两行截断盒（`display:-webkit-box` + `line-clamp:2`），在 320–420px 宽的侧边栏里会把「7 项」折成「7」「项」两行，收藏夹名也会跟着折行、把列表头顶到三行高。现在改回普通块并强制单行截断，工具区固定宽度，列表头恒为单行。
- **保存胶囊两端被盖住**：`.player` 原本靠 `.player__lcd` 的内边距把内容让进胶囊圆帽，面板里网页图标与保存按钮是直接子元素，贴边后戳出轮廓。按圆角几何算需要 ≥18px，现在是 20px（窄屏把封面缩到 38px、内边距 16px，靠缩小元素而不是压缩内缩来省宽度）。选择条同理。
- 保存胶囊里的占位图标原本与 favicon 同为 grid item，各占一行，导致占位图标被排到胶囊外面（被 `overflow` 裁掉，白留一个盒子）。favicon 改为绝对定位压在首字上层，有图盖住、无图露出。
- **抄参考项目时连业务语义一起抄错了**：参考项目是音乐播放器，我拿它的 `i-note`（音符）当「没有 favicon」的占位图标，书签管理器里就出现了一个音符；未连接引导也用了它的 `i-album`（专辑唱片）。现在没有 favicon 时显示**当前标签页标题首字**，未连接引导改用新加的钥匙图标；`i-note` / `i-album` 一并从 sprite 删除。测试加了一条黑名单，禁止再出现播放器语义的图标（`i-note` `i-play` `i-pause` `i-shuffle` `i-backward` `i-forward` `i-lyrics` `i-speaker` `i-album` `i-apple` `i-appmusic-app` `i-tv`）。
- **空白封面**：参考项目把 `.song-row__img` 的占位底色硬编码成深色 `#2a2a2c`（浅色主题下会显示成黑方块）；且页面图标透明、加载失败或返回 200 但无可解码数据时，行里会留下一个空框。现在封面方框始终先渲染标题首字，照片盖在上面；取不到图就把 `<img>` 移除，露出首字。
- **封面方框里出现两个图形**（根因是同一处）：曾把「标题首字」垫在照片下面，靠照片遮挡来实现兜底。真实站点图标几乎都是**透明底上的小图形**，`object-fit: cover` 把图形放大后透明区域依然透明，首字就透了出来 —— 一个格子里同时看到图标和字。现在改为**二选一**：`coverContent()` 有图就只插入 `<img>`，没有图（或图片 `error` / `naturalWidth` 为 0）才插入首字，任何时刻方框里只有一个元素。保存胶囊与书签行走同一套逻辑。
- 参考项目在 `≤500px` 时会隐藏 `.sidebar` 与 `.player`（它改用手机外壳），插件侧边栏没有那套外壳，已中和；否则窄侧栏会整体不可见。
- 参考项目的 `.pbtn` 是播放器传输键（浅色下为 Apple 红），面板没有播放器，只复用其几何，颜色换成中性文字色。
- 菜单与弹层的底色加厚：参考项目那两处是一行控件，而菜单有四行文字、弹层是整张表单，在 `backdrop-filter` 不可用的环境下必须仍然读得清。
- 测试锁死不变式：列表头单行、胶囊内边距 ≥18px（窄屏 ≥14px）、**封面方框只放一个元素**、封面失败降级首字、加载态与图标互斥、禁止播放器语义图标、封面兜底走同一套逻辑。共 49 个用例。

## 1.7

- 保存失败时通过系统通知反馈原因；保存新书签后自动切换到目标收藏夹，新条目立即可见。
- 右键保存改为在用户手势内首先调用 `sidePanel.open()`，侧边栏可靠打开；未设置 Token 时由侧边栏直接显示连接引导。
- Raindrop API 请求对 429/503 自动退避重试，幂等请求对 500/502/504 同样重试，并遵循 `Retry-After`（封顶 5 秒）。
- 批量新增、编辑、删除在部分失败时显示已完成数量，并刷新已生效部分。
- 缓存用户信息（10 分钟），常规刷新少一次 API 请求；手动刷新强制更新。
- “加载更多”只追加新卡片，不整列表重建；屏幕阅读器播报范围从书签列表缩小到结果计数。
- 批量新增输入框占位符正确显示多行示例；URL 自带 `|` 时不误判为标题分隔符。
- 显式清空 AI API 地址后保持为空，优化时给出明确报错。
- 测试迁移到 `node --test`（27 个用例）；新增 `package.json` 与 MIT 许可证。

## 1.6

- 优化改为点击 ✨ 按钮按需触发，设置页移除启用开关，只保留方式选择。
- 保存/编辑弹窗标题右侧与书签卡片均新增 ✨ 入口：弹窗优化结果回填编辑器，是否写入由「保存」决定；卡片 ✨ 直接更新该书签。
- 新建收藏时通过 `chrome.scripting` 读取当前标签页标题与 `meta description` 作为优化输入，按站点申请授权（`optional_host_permissions`）。
- 未授权时降级为仅优化书签名；仅当链接与当前标签页指向同一页面时才读取；受限页面读取失败静默降级。

## 1.5

- 新增“收藏时自动优化”：书签保存成功后自动整理书签名和简介，默认关闭，只作用于新增。
- 可选本地规则（压缩空白、剥去站点名后缀、清除简介噪声前缀）或 AI 模型（OpenAI 兼容接口，API Key 仅存本机）。
- Raindrop 保存时于后台抓取页面元数据，开启后扩展等待抓取结果再优化，最多等待约 6 秒。
- 优化始终是保存之后的补充步骤，失败不影响保存，侧边栏提示“书签已保存，但优化失败”；AI 请求 30 秒超时，返回空值时保留原有元数据。

## 1.4

- 新增结果排序：按添加时间、更新时间、标题、域名或自定义顺序，排序选择保存在本机。
- 排序控件放在书签列表标题旁，收藏夹浏览与全局搜索共用。

## 1.3

- 重构侧边栏与设置页界面：系统字体、材质层次、键盘焦点与减少动态效果支持的 Apple 风格。
- 主题色增至七种预设（含新增的灰色），移除页面渐变；修正 Token 操作布局，优化主题色选择。
- 项目新增封面图。

## 1.2

- 保存改为先打开编辑器：可编辑链接、标题、收藏夹、标签、备注和摘要；右键保存同样进入编辑器。
- 新增单条书签读取、编辑、删除（移入 Trash）与多选批量新增、移动、编辑、删除。
- 无搜索词时按当前收藏夹浏览，有搜索词时执行全局搜索；收藏夹改为树状展示，可展开或收起。
- 设置页新增主题色选择与跟随系统、固定浅色或固定深色模式；后续修正系统主题偏好的同步。

## 1.1

- 基础侧边栏：点击扩展工具栏图标打开，树状浏览 Raindrop 收藏夹及层级结构。
- 按当前收藏夹浏览与搜索书签，一键保存当前网页，右键页面或链接快捷保存。
- 设置页输入并验证 Raindrop Test Token；数据直接读写 Raindrop REST API，无自建后端。
