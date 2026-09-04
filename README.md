# Raindrop Side Panel

一个面向 Chrome / Chromium 的 Manifest V3 扩展，把 Raindrop.io 书签管理放进浏览器 Side Panel。

## 功能

- 使用 `chrome.sidePanel` 在浏览器侧边栏中显示
- 树状浏览收藏夹，并自由展开或收起子收藏夹
- 无搜索词时按当前收藏夹浏览，有搜索词时执行全局搜索
- 保存当前网页前手动编辑链接、标题、收藏夹、标签、备注和摘要
- 页面或链接右键 → “保存到 Raindrop…”后打开编辑器
- 单条书签读取、编辑、删除
- 多选书签后批量新增、移动、编辑和删除
- 设置页选择预设主题色，以及跟随系统、固定浅色或固定深色模式
- 所有书签数据直接读写 Raindrop REST API；无自建后端

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
- 右键保存和“保存当前页”都会先打开编辑器，默认带入当前页面或链接信息。
- 批量新增每行支持 `URL` 或 `标题 | URL`，可统一设置收藏夹、标签和备注。
- 批量编辑只修改勾选的字段；未勾选字段保持原值。
- 删除操作会将书签移入 Raindrop Trash，不提供永久删除入口。

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

需要浏览器支持 Chrome Side Panel API。第二版使用 `chrome.sidePanel.open()` 从右键菜单打开编辑器，因此需要 Chrome 116+ 或实际提供对应 API 的 Chromium 浏览器。

## 项目结构

```text
manifest.json          MV3 清单
background.js          Side Panel 行为、右键菜单、待保存草稿
api.js                 Raindrop REST API 封装
utils.mjs              批量输入、分组和主题常量
theme.js               主题状态与实时应用
sidepanel.html/css/js  侧边栏 UI、树状收藏夹、书签管理
options.html/css/js    Test Token 与外观设置
icons/                 扩展图标
```
