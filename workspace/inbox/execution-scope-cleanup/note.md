执行作用域与资源清理，是为一次业务执行明确资源的归属和有效期，在业务结束时停止相关工作、解除外部引用，并阻止过期结果继续影响系统。

## 1. 业务结束，为什么旧代码还能执行

事件订阅、定时器、异步动作都有一个共同点：注册回调后，其他系统会保存这个函数，等待以后调用；函数又可能通过闭包引用创建它时的对象。

例如，旧 Runner 正在等待移动完成：

```javascript
// 参数 runner 捕获的是这一次执行对应的对象。
function startMove(runner, target) {
  movementSystem.moveTo(target, () => {
    runner.finishCall("B");
  });
}

startMove(currentRunner, target);
currentRunner = new Runner();
```

最后一行改变了 currentRunner 的指向，移动系统保存的回调仍然关联着旧对象：

```text
移动系统 → 完成回调 → 旧 Runner → 调用记录与等待
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

## 4. 用一个执行作用域把它们组织起来

scope 保存本次执行的有效标记，以及结束时需要调用的清理函数；下面继续用“移动完成后，gate 才继续”的例子。

```javascript
// 管理一次执行拥有的资源；清理失败时也继续释放其他资源。
function createScope() {
  return {
    active: true,
    cleanups: [],

    dispose() {
      if (!this.active) return;
      this.active = false;
      const cleanups = this.cleanups;
      this.cleanups = [];
      for (const cleanup of cleanups) {
        try { cleanup(); }
        catch (error) { reportCleanupError(error); }
      }
    }
  };
}

// call：先登记等待和订阅，再启动移动。
function startMove(scope, callId, target) {
  let resolve;
  const promise = new Promise(done => { resolve = done; });

  // 结束作用域时，让仍挂起的 gate 能够退出。
  scope.cleanups.push(() => resolve({ status: "cancelled" }));

  const unsubscribe = movementSystem.onFinished(callId, () => {
    if (!scope.active) return;
    resolve({ status: "completed" });
  });
  scope.cleanups.push(unsubscribe);

  const movement = movementSystem.start(callId, target);
  scope.cleanups.push(() => movement.cancel());
  return promise;
}

// gate：等待返回后再检查有效性，决定是否继续剧情。
async function runChapter(scope) {
  try {
    const promise = startMove(scope, createUniqueId(), target);
    const result = await promise;
    if (!scope.active || result.status === "cancelled") return;
    showNextDialogue();
  } finally {
    scope.dispose();
  }
}

// 替换执行时，先结束旧作用域，再创建新作用域。
currentScope.dispose();
currentScope = createScope();
```

先将 active 设为 false，使清理过程中或之后到达的回调失效；结束等待、取消订阅和停止动作，则使旧执行能够收尾。Promise 只接受第一次完成结果，已经完成的等待保持原结果，await 后的有效性检查仍会阻止旧流程继续。

清理范围取决于所有权：Runner 可以取消自己发起的移动、解除自己的任务订阅；任务系统和音频系统维护的持续状态，由各自的生命周期管理。
