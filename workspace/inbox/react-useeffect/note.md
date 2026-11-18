**useEffect 让 React 组件与外部系统保持同步。** 组件首次渲染并提交到页面后，React 执行你传入的函数；之后若某次提交的依赖值发生变化，React 先调用上一次返回的清理函数，再执行本次函数。组件从页面移除时，React 调用最后一次的清理函数。

## 例子：切换聊天室

同一个 `roomId` 决定两件事：页面应该显示哪个房间，以及浏览器应该接收哪个房间的消息。前者直接写在组件返回的页面里；后者需要调用浏览器 API 打开和关闭频道，写在 Effect 里。

下面用浏览器自带的 `BroadcastChannel` 做一个同源标签页之间的聊天室。把代码存为 HTML，通过本地 Web 服务在两个标签页打开同一地址，同时打开控制台。

```html
<!doctype html>
<meta charset="utf-8">
<div id="app"></div>

<script type="module">
  import { createElement, useState, useEffect } from "https://esm.sh/react@19";
  import { createRoot } from "https://esm.sh/react-dom@19/client";

  function ChatRoom() {
    const [roomId, setRoomId] = useState("大厅");

    useEffect(() => {
      const channel = new BroadcastChannel(roomId);
      channel.onmessage = event => console.log(roomId, event.data);
      channel.postMessage("有人进入房间");

      return () => channel.close();
    }, [roomId]);

    function switchRoom() {
      setRoomId(roomId === "大厅" ? "组队" : "大厅");
    }

    return createElement("div", null,
      createElement("p", null, "当前房间：" + roomId),
      createElement("button", { onClick: switchRoom }, "切换房间")
    );
  }

  createRoot(document.getElementById("app")).render(createElement(ChatRoom));
</script>
```

点击第一个标签页的按钮时，`switchRoom` 只把状态改为“组队”。React 先把页面上的“当前房间”更新为“组队”；提交后发现依赖 `[roomId]` 已变，就调用旧的 `channel.close()` 退出大厅，再执行新的 Effect 加入组队频道。此时第二个标签页仍在大厅；等它也切到组队，第一个标签页的控制台就会收到“组队 有人进入房间”。