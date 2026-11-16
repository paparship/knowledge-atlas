Web Worker 是浏览器提供的后台线程机制，可以在独立的 JavaScript 执行环境中处理任务，与页面主线程并行执行。

## 解决什么问题

页面主线程同时承担 JavaScript 执行、用户交互和布局等工作；耗时计算长时间占用主线程，会让点击响应、滚动和画面更新卡顿。Worker 将这类计算移到后台，让主线程继续处理页面。

Worker 不能直接操作 DOM；主线程与 Worker 通过消息交换数据，页面更新由主线程完成。

## 基本用法

`onmessage` 表示“收到消息时执行的函数”：主线程的 `worker.onmessage` 接收 Worker 发回的消息，Worker 内的 `self.onmessage` 接收主线程发来的消息。

主线程创建 Worker、发送任务并接收结果：

```javascript
// main.js
const worker = new Worker("./worker.js");

worker.onmessage = (event) => {
  document.querySelector("#result").textContent = event.data;
};

worker.postMessage([10, 20, 30]);
```

Worker 在后台线程计算，再把结果发回来：

```javascript
// worker.js
self.onmessage = (event) => {
  const sum = event.data.reduce((total, n) => total + n, 0);
  self.postMessage(sum);
};
```

页面中预先放置 `<div id="result"></div>`，加载主线程脚本后显示 `60`；这两个脚本通过网站服务加载。

## 优势场景

浏览器加载大型 3D 场景时，需要解析大份 JSON 并整理模型数据：在主线程连续处理，会让加载动画和用户操作停住；可以由 Worker 获取、解析并整理数据，再将结果交回主线程，主线程分批构建场景。
