> Web 基础 / 会话与浏览器存储

**网站通过服务端会话保存用户的业务状态，通过浏览器存储携带会话标识、保存偏好和本地数据。**

## Session：服务端保存会话状态

Session 将同一用户的多次请求关联起来，保存用户 ID、登录状态等会话数据；浏览器通过 Cookie 携带 Session ID。

以登录为例：

- 登录成功后，服务端创建会话，并生成对应的 Session ID。
- 服务端通过响应头 `Set-Cookie: session_id=abc123; Path=/`，让浏览器保存会话标识。
- 后续请求通过请求头 `Cookie: session_id=abc123` 携带标识，服务端据此找到会话，识别用户并进行权限判断。

## Cookie：随请求携带少量数据

Cookie 保存在浏览器中，由服务端响应或网页代码设置；浏览器按域名、路径及安全规则，将符合条件的 Cookie 自动附在请求中。

例如，用户切换中文后，服务端设置语言偏好，有效期为 30 天：

```http
Set-Cookie: language=zh; Max-Age=2592000; Path=/
```

再次访问该站点时，请求携带 `Cookie: language=zh`，服务端据此返回中文页面。Cookie 适合保存会话标识、偏好等少量数据，每条容量通常约 4 KB。

## localStorage：前端使用的键值存储

localStorage 按键保存字符串，网页代码负责读写，数据可以跨页面关闭和重新打开保留。

同样是保存语言偏好，使用 localStorage 时，由前端读取数据并切换界面语言：

```javascript
// 用户选择中文时保存
localStorage.setItem("language", "zh");

// 下次打开页面时读取，供页面渲染使用
const language = localStorage.getItem("language") ?? "en";
```

## IndexedDB：保存结构化数据的本地数据库

IndexedDB 支持对象、Blob 和 File 等数据，提供索引查询和事务，适合较大量的本地记录与附件。

例如离线笔记应用，将笔记正文、标签和图片附件保存在 IndexedDB 中，按笔记 ID 或标签查询；联网后，由应用代码把需要同步的数据发送到服务端。
