执行作用域与资源清理，是把一次流程执行创建的等待、订阅和动作归到同一个管理范围，在执行结束或被替换时统一释放，并使旧回调失效。

## 1. 为什么恢复存档之外，还需要结束旧执行

沿用前面的 call / gate：

```text
call B：让 NPC 移动
gate B：等待移动完成
call C：展示对话
```

玩家在 gate B 等待时读档，新 Runner 根据存档恢复运行；旧 Runner 的 Promise、事件订阅和移动动作仍可能存在，替换一个变量不会自动清理它们。

如果旧移动完成通知继续唤醒旧 gate，就可能让新旧两个 Runner 都执行后面的对话。

因此，读档的交接顺序是：**使旧执行失效并清理它的资源 → 恢复存档 → 启动新执行。**

## 2. 为每次执行建立独立的管理范围

之前的 calls 表保存调用记录，现在将它放到每次执行自己的 run 中，并增加有效标记和清理列表。

| 数据 | 作用 |
| --- | --- |
| active | 表示这次执行是否仍可推进 |
| calls | 保存这次执行的调用与 Promise |
| cleanups | 保存取消订阅、停止动作、释放控制权的方法 |

创建资源时登记对应的清理方法，结束时由 run 统一调用；取消的等待返回取消结果，让挂起的 Runner 退出。

## 3. 接到 call / gate 伪代码中

下面以移动为例，movementSystem.start 返回本次移动的句柄，cancel 负责停止这次移动并释放它占用的控制资源。

```javascript
// 创建一次执行；calls 和清理列表都只属于这次 run。
function createRun() {
  return {
    active: true,
    calls: new Map(),
    cleanups: [],

    dispose() {
      if (!this.active) return;
      this.active = false; // 先失效，清理过程中产生的回调也不再被接受。

      for (const cleanup of this.cleanups) cleanup();
      this.cleanups = [];

      for (const call of this.calls.values()) {
        settle(call, { status: "cancelled" });
      }
    }
  };
}

// 完成或取消一次等待；已经得到结果的调用保持原结果。
function settle(call, result) {
  if (call.status !== "pending") return;
  call.status = "settled";
  call.result = result;
  call.resolve(result);
}

// 创建调用记录，再把动作交给游戏系统。
function startCall(run, action, args) {
  const callId = createUniqueId();
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  run.calls.set(callId, { status: "pending", promise, resolve });

  startGameAction(run, callId, action, args);
  return callId;
}

// 移动适配器：连接结果回调，并登记本次移动的清理方法。
function startGameAction(run, callId, action, args) {
  const movement = movementSystem.start(args, result => {
    if (!run.active) return; // 回调始终检查它所属的旧 run。
    settle(run.calls.get(callId), result);
  });

  run.cleanups.push(() => movement.cancel());
}

// Runner：执行前、await 返回后，都检查本次执行是否仍有效。
async function runChapter(run, nodes) {
  const refs = new Map();
  try {
    for (const node of nodes) {
      if (!run.active) return;

      if (node.type === "call") {
        const id = startCall(run, node.action, node.args);
        refs.set(node.ref, id);
      } else if (node.type === "gate") {
        const call = run.calls.get(refs.get(node.ref));
        const result = await call.promise;
        if (!run.active || result.status !== "completed") return;
      }
    }
  } finally {
    run.dispose(); // 正常结束或执行异常，也走同一清理入口。
  }
}
```

上面采用统一结果格式：动作成功回传 `{ status: "completed" }`，停止执行时等待收到 `{ status: "cancelled" }`。

如果接入方式是事件订阅，适配器同样把取消订阅的方法登记到清理列表：

```javascript
// 任务由任务系统维护；本次 run 持有的是完成通知的订阅。
const unsubscribe = questSystem.onCompleted(instanceId, result => {
  if (!run.active) return;
  settle(run.calls.get(callId), result);
});
run.cleanups.push(unsubscribe);
```

## 4. 读档时如何交接

```javascript
// 替换执行：先结束旧 run，再沿用存档知识点中的恢复过程。
function loadGame(save) {
  currentRun?.dispose();

  restoreWorldAndTasks(save);
  const run = createRun();
  restoreCalls(run, save.calls); // 重建 Promise、回调，并登记清理方法。
  currentRun = run;

  resumeGameSystems();
  return runChapterFrom(run, save.runner);
}
```

旧 run 失效后，取消移动、解除订阅，旧 gate 收到取消结果并退出；即使某个旧回调已经排队，它检查的仍是旧 run，不会影响新执行。

清理范围由资源归属决定：这次剧情独占的移动可以停止，任务完成订阅需要解除；任务数据、背包和 BGM 等持续状态由各自系统管理。
