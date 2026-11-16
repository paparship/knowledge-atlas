> Web 开发 / 客户端与服务端交互方式

**WebSocket 是在持久连接上双向传递消息的协议，连接建立后，客户端和服务端都可以主动发送消息。**

以小明和小红进入同一个聊天室为例。

## ① 浏览器与服务器建立连接

小明打开聊天页面，前端创建连接：

```javascript
const socket = new WebSocket("wss://chat.example.com/ws");
```

`wss://` 表示通过 TLS 保护的 WebSocket 连接。以常见的 HTTP/1.1 握手为例，浏览器先发送请求，要求把连接升级为 WebSocket；服务器接受后返回 `101 Switching Protocols`，后续双方在这条连接上按 WebSocket 协议传递消息。

小红打开页面时，也建立自己的连接。服务器分别维护两人的连接，并由业务逻辑识别用户、登记其加入的聊天室。

## ② 小明发送消息

连接建立后，小明点击发送，前端通过已有连接发送一条消息：

```javascript
socket.send(JSON.stringify({
    type: "chat",
    roomId: "room-1",
    text: "你好"
}));
```

服务器收到消息后，检查小明是否属于这个聊天室，再找到聊天室成员的连接，将聊天消息分别发送给他们。

`type`、`roomId`、`text` 是应用自己约定的消息字段，WebSocket 负责承载文本或二进制消息。

## ③ 小红接收消息

小红的页面提前注册消息处理函数：

```javascript
socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    console.log(message.text); // 你好
});
```

服务器通过小红已经建立的连接主动发送消息，浏览器触发 `message` 事件，前端再把内容显示到聊天列表。

```text
小明浏览器 ──聊天消息──→ 服务器 ──聊天消息──→ 小红浏览器
             已有连接              已有连接
```

后续聊天继续复用各自的连接，每条消息直接发送，无需逐条重新发起 HTTP 请求。

## ④ 断线后恢复交互

网络切换或设备休眠可能使连接中断，应用通过连接状态、错误事件及心跳超时检测异常；浏览器原生 WebSocket 由应用代码负责安排重连。

重新连接后，业务重新确认用户身份和聊天室订阅；若需要补齐断线期间的消息，可以携带最后收到的消息 ID，向服务器请求遗漏内容。
