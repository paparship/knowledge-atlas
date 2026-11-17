执行作用域与资源清理，是为一次业务执行明确资源的归属和有效期，在业务结束时停止相关工作、解除外部引用，并阻止过期结果继续影响系统。

## 1. 业务结束，为什么旧代码还能执行

事件订阅、定时器、异步动作都有一个共同点：注册回调后，其他系统会保存这个函数，等待以后调用；函数又可能通过闭包引用创建它时的对象。

例如，旧 Runner 正在等待移动完成：

```javascript
// 仍是前文的 startGameAction，属于这一次 Runner。
function startGameAction(callId, action, args) {
  if (action === "move") {
    movementSystem.moveTo(args.npcId, args.target, () => {
      onActionResult(callId, { ok: true });
    });
  }
}

// 替换变量，不会移除移动系统保存的旧回调。
currentRunner = createRunner();
```

最后一行改变了 currentRunner 的指向，移动系统保存的回调仍然关联着旧对象：

```text
移动系统 → 完成回调 → 旧 onActionResult → 旧 calls 与等待
currentRunner → 新 Runner
```

移动完成后，回调仍能完成旧调用的 Promise，唤醒旧 gate，并继续执行后面的节点。页面关闭后请求回调继续更新页面、预览结束后定时器继续刷新，也属于同一类问题。

## 2. 垃圾回收与业务收尾负责不同的事情

垃圾回收根据对象是否仍然可达决定能否回收；上面的移动系统仍持有回调，因此旧 Runner 仍然可达。Promise 和循环引用也遵循这个规则，失去全部外部可达路径后可以被回收。

业务代码则需要决定“这次执行是否还应该继续”：页面已经离开、剧情已经替换，这些意图要通过取消、退订或失效标记明确传递。

这涉及两个结果：**解除不再需要的引用，允许资源释放；停止过期的工作，避免旧结果继续修改状态。**

## 3. 三个需要一起考虑的设计问题

| 问题 | 设计方式 | 例子 |
| --- | --- | --- |
| 资源归谁管理？ | 创建时明确所属执行，并登记释放方法 | Runner 订阅移动完成事件，同时保存取消订阅函数 |
| 业务结束时如何收尾？ | 统一停止所属工作、解除订阅，并结束等待 | 读档前停止旧移动，让旧 gate 收到取消结果后退出 |
| 结果已经在回来的路上怎么办？ | 回调入口和 await 之后检查执行是否仍有效 | 旧移动的回调迟到，也无法推进旧 Runner |

取消底层工作可以减少无用执行，检查有效性可以阻止迟到结果生效；两者分别处理资源消耗和执行正确性。

## 4. 在原有 call / gate 上增加生命周期管理

沿用前文的 startCall、startGameAction、onActionResult、waitForCall 和 runChapter，以及 `{ ok: true }` 的结果格式；只用 createRunner 将它们和 calls 包在同一次执行中，新增 active、cleanups 和 dispose。

下面展开移动这一条分支：moveTo 额外返回本次动作的取消句柄，cancel 负责停止该动作并释放它保存的回调。

```javascript
// 每次创建 Runner，都有独立的 calls 和函数闭包。
function createRunner() {
  const calls = new Map();
  let active = true;
  const cleanups = [];

  // 与前文一致：登记调用，再交给动作适配层。
  function startCall(action, args) {
    const callId = createUniqueId();
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    calls.set(callId, { status: "pending", promise, resolve });
    startGameAction(callId, action, args);
    return callId;
  }

  // 沿用原来的分发入口，只增加本次动作的清理登记。
  function startGameAction(callId, action, args) {
    if (action === "move") {
      const movement = movementSystem.moveTo(
        args.npcId, args.target,
        () => onActionResult(callId, { ok: true })
      );
      cleanups.push(() => movement.cancel());
    }
  }

  // 沿用结果回传入口，新增本次执行有效性检查。
  function onActionResult(callId, result) {
    if (!active) return;
    const call = calls.get(callId);
    if (!call || call.status !== "pending") return;
    call.status = "settled";
    call.result = result;
    call.resolve(result);
  }

  // gate 仍然等待 calls 中对应的 Promise。
  function waitForCall(callId) {
    return calls.get(callId).promise;
  }

  // 先使旧执行失效，再结束等待、释放所属动作和订阅。
  function dispose() {
    if (!active) return;
    active = false;
    for (const call of calls.values()) {
      if (call.status !== "pending") continue;
      call.status = "settled";
      call.result = { ok: false, error: "cancelled" };
      call.resolve(call.result);
    }
    for (const cleanup of cleanups) {
      try { cleanup(); }
      catch (error) { reportCleanupError(error); }
    }
    cleanups.length = 0;
  }

  // 仍按 call / gate 推进，仅在执行前和 await 后检查 active。
  async function runChapter(nodes) {
    const refs = new Map();
    try {
      for (const node of nodes) {
        if (!active) return;
        if (node.type === "call") {
          const callId = startCall(node.action, node.args);
          if (node.ref) refs.set(node.ref, callId);
        } else if (node.type === "gate") {
          const result = await waitForCall(refs.get(node.ref));
          if (!active || !result.ok) return result;
        }
      }
    } finally {
      dispose();
    }
  }

  return { runChapter, dispose };
}

// 读档替换执行时，先结束旧 Runner，再按存档流程恢复新执行。
currentRunner.dispose();
currentRunner = createRunner();
```

旧回调调用的仍是旧 Runner 内部的 onActionResult，检查的是旧 active；旧 gate 被取消结果唤醒后，也会在 await 后退出。新 Runner 有自己独立的 calls 和 active。

清理范围取决于所有权：Runner 可以取消自己发起的移动、解除自己的任务订阅；任务系统和音频系统维护的持续状态，由各自的生命周期管理。
