协程是一段可以暂停、随后从暂停处继续的执行过程。暂停时会保留执行位置和局部状态，等待的结果就绪后再接着执行。

| 概念 | 怎样暂停和恢复 | 怎样利用 CPU |
|---|---|---|
| 线程 | 操作系统负责调度，可暂停正在运行的线程，之后恢复它的执行现场 | 多个线程可以在不同 CPU 核上同时执行 |
| 协程 | 在所属线程上运行，通常在 `await` 等暂停点交出执行权，由运行时安排恢复 | 同一线程可以交替推进多个协程，一段长时间占用线程的计算会让其他协程等待 |

## JavaScript 中等待网络请求

```javascript
async function loadProfile() {
  console.log("1. 发起请求");
  const response = await fetch("/api/profile");
  console.log("3. 收到响应头，继续执行");

  const profile = await response.json();
  console.log("4. 读取到资料", profile);
}

loadProfile().catch(console.error);
console.log("2. 继续执行外层代码");
```

请求成功且正文是有效 JSON 时，输出顺序是 **1 → 2 → 3 → 4**。

- **Promise 表示异步结果**。调用 `fetch()` 会立即得到一个 Promise。浏览器收到响应头后，这个 Promise 兑现，结果是 `Response` 对象。读取 JSON 正文也会返回一个 Promise。
- **async/await 表达暂停和恢复**。`loadProfile()` 先同步运行到第一个 `await`，然后暂停。外层代码继续执行并输出 2，等结果就绪后，函数再从 `await` 后接着运行。
- **事件循环安排何时继续**。Promise 兑现后，恢复 `loadProfile()` 的工作进入微任务队列。当前同步代码执行完后，浏览器处理这些微任务，函数才会继续输出 3，第二个 `await` 也按同样方式恢复。
