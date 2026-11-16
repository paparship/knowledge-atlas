# 知识图谱

本地浏览器应用。通过 3D 图谱浏览个人理解，使用 Markdown / HTML 记录内容；外部 Agent 按工作区格式读写。

## 启动

需要 Node.js 22 或更新版本，无须安装依赖。

```powershell
cd D:\Users\ljf\projects\knowledge-atlas
node server.mjs
```

浏览器打开 http://127.0.0.1:4317 。关闭终端中的服务可按 Ctrl+C。也可双击 `start.cmd`。

更换端口：设置环境变量 `PORT`。更换数据目录：设置 `ATLAS_WORKSPACE` 为绝对路径。

## 使用

- 左侧切换全部 / 未整理 / 正式记录，搜索标题与正文。
- 拖动空白旋转图谱，滚轮缩放，Shift + 拖动节点改变位置。点击“保存布局”保存坐标和视角。
- 点击节点阅读；侧栏可放大；编辑页保存为草稿。支持多个 Markdown / HTML 内容块。
- HTML 在隔离 iframe 中运行。示例 TCP 演示可以手动发送与确认，不会自动推进。
- 关联页创建、修改、删除带说明的有向关系。关系有独立确认状态。
- 对照正式版本与草稿后确认纳入正式区。确认覆盖该节点的正式版本，历史快照保留。
- 每 2.5 秒检查外部修改。正在编辑或调整布局时保留本地状态；用左下角刷新重新载入。
- 发生版本冲突时保存被拒绝，编辑内容保留。先复制自己的修改，刷新后合并并重新保存。

## 工作区结构

| 路径 | 用途 |
| --- | --- |
| `workspace/inbox/<id>/node.json` | 未整理节点元数据 |
| `workspace/inbox/<id>/*.md`、`*.html` | 未整理正文与交互演示 |
| `workspace/confirmed/<id>/…` | 已确认节点，结构与 inbox 相同 |
| `workspace/graph.json` | 关系、3D 坐标、相机视角 |
| `workspace/assets/` | 共用附件 |
| `workspace/history/` | 应用每次写入前生成的完整快照 |

同一 ID 同时存在于 inbox 与 confirmed 时，表示“正式内容 + 待确认的新草稿”。应用默认展示草稿，版本对照页保留正式内容。

### 节点格式

`node.json` 示例：

```json
{
  "id": "tcp-window",
  "title": "TCP 滑动窗口",
  "blocks": [
    { "id": "note", "format": "markdown", "file": "note.md" },
    { "id": "demo", "format": "html", "file": "demo.html" }
  ]
}
```

- ID 使用英文字母、数字、连字符、下划线，长度 1–80。节点 ID 与目录名相同，改标题时保持 ID。
- `title` 为非空字符串；`blocks` 顺序就是显示顺序；每节点最多 40 个内容块，每块最多 2 MB。
- 内容块 ID 在节点内唯一。Markdown 文件必须为 `<块ID>.md`，HTML 必须为 `<块ID>.html`。
- `updatedAt` 是可选 ISO 时间，由应用保存时填写。
- 正文采用 UTF-8，Agent 可以直接编辑对应文件。应用暂不识别 `[[双链]]`；关系写入 graph.json。

Markdown 预览支持标题（1–3 级）、段落、无序列表、引用、粗体、行内代码、围栏代码块、HTTP(S) 链接和本地图片。表格、公式与复杂排版可用 HTML。Markdown 原始 HTML 不执行。

### 图谱格式

```json
{
  "schemaVersion": 1,
  "edges": [
    {
      "id": "edge-1",
      "source": "tcp-window",
      "target": "flow-control",
      "label": "窗口机制帮助区分两种发送限制",
      "status": "draft"
    }
  ],
  "positions": {
    "tcp-window": [0, 0, 70],
    "flow-control": [-270, -170, -40]
  },
  "camera": { "yaw": 0.12, "pitch": -0.12, "zoom": 1.35 }
}
```

- 每条关系 ID 唯一，source / target 必须是存在的节点 ID；status 为 `draft` 或 `confirmed`。
- 坐标 `[x,y,z]` 独立于正文。没有坐标的新节点会获得初始位置，保存布局后写回文件。
- yaw / pitch 为弧度；zoom 为正数。
- 关系确认与节点确认独立；确认节点不会顺带确认关联。

### HTML 与附件

HTML 可以包含内联 CSS 和 JavaScript，适合自包含演示。iframe 允许脚本，但无同源权限、顶层导航、弹窗、表单提交或网络请求权限；不加载 CDN 与外部脚本。依赖应以内联形式提供。

附件放在 `workspace/assets/`，文件名使用字母、数字、下划线、连字符和点。支持 PNG / JPEG / GIF / WebP / MP4 / PDF。Markdown 图片写为 `![说明](/assets/example.png)`；HTML 可使用本地图片与视频（同服务 `/assets/…` URL）。当前通过文件系统加入附件。

## 外部 Agent 约定

1. 先读取已有节点及 graph.json，保留未知或无关内容。
2. 新内容写入 inbox。修改正式节点时，将该节点复制到 inbox 后修改草稿。
3. 正式目录与关系的 confirmed 状态由用户在界面确认；Agent 不代替用户确认。
4. 新关联写为 draft。删除节点前检查关系引用，优先通过应用操作完成删除。
5. 写文件采用“临时文件写完再重命名”；新节点先写正文，最后写 node.json。
6. 修改前重新读取目标。直接文件写入应与应用编辑错开；应用版本校验无法为任意外部进程提供事务锁。
7. 应用会验证数据后展示；引用错误或缺失文件会提示读取失败，保留上次成功载入的界面。

外部写入会自动刷新。应用历史只记录应用写入前的快照；Agent 直接修改之前需自行备份，或使用下述 API。

## 本地 API

`GET /api/state` 返回 draft / confirmed / graph 和当前 `revision`。正文在 API 中展开为 `blocks[].content`。

`POST /api/action` 使用 JSON 请求，每次写入携带刚读取的 revision：

```json
{
  "revision": "GET /api/state 返回的 revision",
  "action": "saveNode",
  "node": {
    "id": "example",
    "title": "新的理解",
    "blocks": [{ "id": "note", "format": "markdown", "content": "# 我目前的理解\n\n待整理内容。" }]
  }
}
```

操作包括 saveNode、approveNode、deleteNode、saveEdge、deleteEdge、saveLayout、restoreNode。approveNode 是用户确认动作，Agent 按上述约定使用 saveNode。

| action | 参数（另须 revision） |
| --- | --- |
| saveNode | node：id、title、blocks（id / format / content） |
| approveNode / deleteNode | id |
| saveEdge | edge：id / source / target / label / status |
| deleteEdge | id |
| saveLayout | positions、camera |
| restoreNode | id、history（历史文件名，恢复为草稿） |

`GET /api/history` 返回历史文件名，`GET /api/history-entry?name=…` 返回快照。HTTP 409 表示版本已变化，需要读取新状态并合并。服务只绑定 127.0.0.1，拒绝跨来源写入。

## 开发与验证

```powershell
node --test tests/*.test.mjs
```

入口是 server.mjs；界面在 public/；示例生成器是 scripts/seed.mjs。前端用 Canvas 透视投影实现 3D 旋转与选取，当前适用于个人小型图谱。Markdown 使用内置轻量渲染器。

自带 7 个节点、4 条关系，全部为示例草稿；正式区初始为空。运行 seed.mjs 会补充缺失示例，不覆盖已有同名节点或 graph.json。

历史快照包含完整正文，会随操作增长，可在备份后自行整理。初版采用单机文件数据，多个文件的写入不是数据库事务；退出前保存内容，重要数据可定期备份整个 workspace。

## 公开浏览版（GitHub Pages）

公开版从 `docs/state.json` 读取知识库快照，无需启动 Node 服务；本地版本继续用于编辑。

更新本地内容后，在 PowerShell 执行 `./scripts/publish.ps1`，会导出当前草稿、正式内容、关系与布局，提交并推送到 GitHub；Pages 随后自动发布。

只构建快照：`node scripts/build-pages.mjs`。公开版不包含工作区历史快照。GitHub Pages 发布源为 main 分支的 /docs 目录。
