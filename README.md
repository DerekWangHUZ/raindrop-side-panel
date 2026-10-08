# Raindrop Side Panel

![Raindrop Side Panel 项目封面](assets/project-cover.png)

一个面向 Chrome / Chromium 的 Manifest V3 扩展，把 Raindrop.io 书签管理放进浏览器 Side Panel。

## 功能

- 使用 `chrome.sidePanel` 在浏览器侧边栏中显示
- 树状浏览收藏夹，并自由展开或收起子收藏夹
- 无搜索词时按当前收藏夹浏览，有搜索词时执行全局搜索
- 支持按添加时间、更新时间、标题、域名和自定义顺序排序，排序选择保存在本机
- 保存当前网页前手动编辑链接、标题、收藏夹、标签、备注和摘要
- 页面或链接右键 → “保存到 Raindrop…”后打开编辑器
- 可选的“收藏时自动优化”：保存成功后自动整理书签名和简介，支持本地规则或 AI 模型
- 单条书签读取、编辑、删除
- 多选书签后批量新增、移动、编辑和删除
- 设置页选择七种预设主题色（含灰色），以及跟随系统、固定浅色或固定深色模式
- 采用简洁的系统字体、材质层次、键盘焦点和减少动态效果支持的 Apple 风格界面
- 所有书签数据直接读写 Raindrop REST API；无自建后端

## 版本

- `v1`：基础侧边栏浏览、收藏夹和快速保存。
- `v2`：可编辑保存、单条/批量书签管理、全局搜索和主题设置。
- `v3`：重构侧边栏与设置页界面，修正 Token 操作布局，优化主题色选择，新增灰色主题并移除页面渐变。
- `v4`：新增结果排序，可在收藏夹浏览和全局搜索中切换并记住排序方式。
- `v5`：新增“收藏时自动优化”，可选本地规则或 AI 模型重写书签名和简介，默认关闭。

## 安装（开发者模式）

1. 下载并解压本项目或 Release 中的 ZIP。
2. 打开浏览器的扩展管理页面（通常为 `chrome://extensions`）。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”，选择本项目目录。
5. 打开扩展“详细信息” → “扩展程序选项”，或者在侧边栏中点击设置按钮。
6. 粘贴 Raindrop **Test Token** 并点击“验证并保存”。
7. 将扩展固定到工具栏；点击图标即可打开 Side Panel。

## Test Token

本扩展使用 **Raindrop Test Token** 认证。

获取方法：

1. 打开 Raindrop.io 设置。
2. 进入“集成 → 开发者”。
3. 创建开发者应用。
4. 创建并复制 **Test token**。
5. 在扩展设置页粘贴并验证。

API 请求使用 Bearer 认证：

```http
Authorization: Bearer <token>
```

Token 存储在 `chrome.storage.local`，不会同步到其他设备，也不会发送到 `api.raindrop.io` 以外的服务器。

## 保存与批量操作

- 当前选中普通收藏夹：保存到该收藏夹。
- 当前选中“未分类”：保存到未分类。
- 当前选中“全部书签”：保存到未分类，因为“全部书签”不是实际收藏夹。
- 右键保存和“保存当前页”都会先打开编辑器，默认带入当前页面或链接信息；收藏夹选择位于批量操作之前。
- 批量新增每行支持 `URL` 或 `标题 | URL`，可统一设置收藏夹、标签和备注。
- 批量编辑只修改勾选的字段；未勾选字段保持原值。
- 删除操作会将书签移入 Raindrop Trash，不提供永久删除入口。

## 收藏时自动优化

在设置页的“收藏时自动优化”中开启后，书签保存成功会再自动整理一次**书签名**和**简介**。该功能默认关闭（用该区块的复选框开关），只作用于新增；编辑已有书签和批量新增不会触发。

Raindrop 在保存时于后台抓取页面元数据，因此简介往往要等几秒才出现。开启后扩展会等待抓取结果再优化，最多等待约 6 秒。

### 本地规则（默认推荐）

纯前端规则，不联网、不产生费用、即时完成：

- 书签名：压缩多余空白，去掉首尾的 `-`、`|`、`_`、`·`、`:` 等分隔符
- 书签名：剥掉结尾或开头的站点名，例如 `Deno 2.0 released | Hacker News` → `Deno 2.0 released`
- 书签名：站点名按域名判断，并内置少量常见品牌写法（`Stack Overflow`、`Hacker News`、`少数派` 等）
- 简介：去掉 `Share this:`、`Advertisement` 等前缀噪声
- 简介：与标题完全相同时视为无效并清空
- 书签名与简介都按 Raindrop 上限截断（1000 字符）

规则刻意保守：像 `E-commerce Growth | Example`、`AWS re:Invent 2024` 这类标题不会被改写，以免削掉标题本身的信息。两段式域名（如 `example.com`）只按完整域名匹配，不会把裸的 “Example” 当作站点名删掉。

### AI 模型

调用你指定的 OpenAI 兼容接口（`{API 地址}/chat/completions`）重写书签名和简介，可指定模型与简介语言。

- API Key 只保存在本机 `chrome.storage.local`
- 只在你开启优化并收藏时才会发出请求
- 填写 API 地址后点击“授权访问”，浏览器会向该站点授予网络权限（`optional_host_permissions`）
- 未开启或未授权时不会产生任何请求

### 失败处理

优化始终是保存之后的补充步骤：书签**先**保存成功，优化再单独进行。因此优化失败不会导致保存失败，侧边栏只会提示“书签已保存，但优化失败”。AI 请求设有 30 秒超时；AI 返回空标题或空简介时会保留页面原有的值，不会清空元数据。

## 主要 API

- `GET /rest/v1/user`：验证 Token / 获取收藏夹分组
- `GET /rest/v1/collections`：根收藏夹
- `GET /rest/v1/collections/childrens`：子收藏夹
- `GET /rest/v1/raindrops/{collectionId}`：按收藏夹或全局浏览、搜索书签
- `GET /rest/v1/raindrop/{id}`、`PUT /rest/v1/raindrop/{id}`、`DELETE /rest/v1/raindrop/{id}`：单条书签管理
- `POST /rest/v1/raindrop`、`POST /rest/v1/raindrops`：单条或批量新增
- `PUT /rest/v1/raindrops/{collectionId}`、`DELETE /rest/v1/raindrops/{collectionId}`：批量更新或删除

批量写操作不能使用 `collectionId=0` 作为来源，因此全局搜索结果会按书签原收藏夹分组执行。批量新增遵循 Raindrop API 的单次最多 100 条限制，超过 100 条时自动分批提交。

## 兼容性

需要浏览器支持 Chrome Side Panel API。右键菜单使用 `chrome.sidePanel.open()` 打开编辑器，因此需要 Chrome 116+ 或实际提供对应 API 的 Chromium 浏览器。

## 项目结构

```text
manifest.json          MV3 清单
background.js          Side Panel 行为、右键菜单、待保存草稿
api.js                 Raindrop REST API 封装
optimizer.js           自动优化：设置读写、元数据等待、AI 调用
utils.mjs              批量输入、分组、主题常量与优化规则
theme.js               主题状态与实时应用
sidepanel.html/css/js  侧边栏 UI、树状收藏夹、书签管理
options.html/css/js    Test Token、外观与自动优化设置
tests/verify.mjs        纯函数校验（node tests/verify.mjs）
icons/                 扩展图标
```

## 测试

```bash
node tests/verify.mjs
```
