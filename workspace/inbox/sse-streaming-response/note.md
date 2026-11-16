> 后端开发 / 流式响应

聊天应用需要在模型生成回答的过程中逐段显示文本。SSE（Server-Sent Events）由浏览器发起 HTTP 请求，后端在同一个 HTTP 响应正文中持续写入事件，数据沿这条响应从服务端单向发送到浏览器。

### 最小接口

```text
POST /chat                { prompt } → { chatId }
GET  /chat/{chatId}/events → Content-Type: text/event-stream
```

前端提交问题后，用返回的 `chatId` 建立 `EventSource` 连接。后端每收到一段模型输出，就写入一条 `data: {"delta":"你好"}` 并以空行结束事件。浏览器触发 `onmessage`，前端从 `event.data` 解析出 `delta` 并追加到当前回答。

### 结束与断线

生成完成后，后端发送带 `data:` 的 `event: done` 事件，再结束响应。前端收到 `done` 后标记回答完成，并调用 `close()`。连接意外断开时，`EventSource` 通常会自动重连。若需要断点续传，后端可为事件设置 `id`，并根据重连请求中的 `Last-Event-ID` 补发后续事件。