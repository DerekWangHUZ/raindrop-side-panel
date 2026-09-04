# Raindrop Side Panel

一个面向 Chrome / Chromium 的 Manifest V3 扩展，把 Raindrop.io 书签管理放进浏览器 Side Panel。

## 功能

- 使用 `chrome.sidePanel` 在浏览器侧边栏中显示
- 点击扩展工具栏图标直接打开侧边栏
- 浏览 Raindrop 收藏夹及其层级结构
- 按当前收藏夹搜索书签
- 一键保存当前网页
- 右键页面或链接 → “保存到 Raindrop”
- 设置页输入并验证 Raindrop Test Token
- 所有书签数据直接读写 Raindrop REST API；无自建后端

## 安装（开发者模式）

1. 解压本项目。
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

Test Token 可长期使用，但可以被撤销。如果你主动撤销或重新生成 Token、删除对应开发者应用，或 Raindrop 将其作废，原 Token 会失效。

本扩展将 Token 存储在 `chrome.storage.local`，不会同步到其他设备，也不会把 Token 发送到 `api.raindrop.io` 以外的服务器。

## 主要 API

- `GET /rest/v1/user`：验证 Token / 获取用户收藏夹分组
- `GET /rest/v1/collections`：根收藏夹
- `GET /rest/v1/collections/childrens`：子收藏夹
- `GET /rest/v1/raindrops/{collectionId}`：浏览与搜索书签
- `POST /rest/v1/raindrop`：新增书签

## 保存目标逻辑

- 当前选中普通收藏夹：保存到该收藏夹。
- 当前选中“未分类”：保存到未分类。
- 当前选中“全部书签”：保存到未分类，因为“全部书签”不是实际收藏夹。
- 右键快捷保存沿用侧边栏最后选择的收藏夹；如果从未选择过收藏夹，则保存到未分类。
- 如果之前选择的收藏夹已经被删除，扩展会自动回退到“全部书签”，实际保存目标为“未分类”。

## Side Panel 位置

扩展使用 Chromium 提供的 `chrome.sidePanel`。Side Panel 显示在左侧还是右侧由浏览器自身的侧边栏设置决定，扩展不能强制指定位置。

## 兼容性

需要浏览器支持 Chrome Side Panel API（`chrome.sidePanel`）。Chrome 114+ 或其他实际提供该 API 的 Chromium 浏览器均可尝试加载。

## 项目结构

```text
manifest.json          MV3 清单
background.js          Side Panel 行为、右键菜单、后台快速保存
api.js                 Raindrop REST API 封装
sidepanel.html/css/js  侧边栏 UI
options.html/css/js    Test Token 设置与验证
icons/                 扩展图标
```
