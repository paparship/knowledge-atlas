执行作用域与资源清理，是为一次业务执行明确资源的归属和有效期，在执行结束时释放所属资源，并阻止旧回调继续推进流程。

## 1. 从之前的 call / gate 代码开始

前面已经有五个函数，以及一张调用记录表：

```text
runChapter：读取节点
  call → startCall：创建调用记录，放入 calls
           → startGameAction：把动作交给游戏系统
               → 完成回调 → onActionResult：完成 calls 中对应的 Promise
  gate → waitForCall：取出 calls 中对应的 Promise 并等待
```

这些函数共同使用同一张 calls 表。最初只展示一段执行时，可以直接把它们写在一起；现在考虑读档后启动新执行，就需要让新旧两次执行各有自己的 calls。

## 2. 把这组函数和数据放进 createRunner

createRunner 的作用是创建一套独立的执行数据和操作它的函数，返回给外部使用；这里把这一套称为一个 Runner。

先只做这个包装，内部仍然是前面的调用过程：

```javascript
function createRunner() {
  const calls = new Map(); // 每次调用 createRunner 都新建一张表。

  // 创建调用记录，再发起动作。
  function startCall(action, args) {
    const callId = createUniqueId();
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    calls.set(callId, { status: "pending", promise, resolve });
    startGameAction(callId, action, args);
    return callId;
  }

  // 仍由动作适配层分发；这里展开移动分支。
  function startGameAction(callId, action, args) {
    if (action === "move") {
      movementSystem.moveTo(args.npcId, args.target, () => {
        onActionResult(callId, { ok: true });
      });
    }
  }

  // 使用本次 createRunner 创建的 calls。
  function onActionResult(callId, result) {
    const call = calls.get(callId);
    if (!call || call.status !== "pending") return;
    call.status = "settled";
    call.result = result;
    call.resolve(result);
  }

  function waitForCall(callId) {
    return calls.get(callId).promise;
  }

  // 按原来的 call / gate 规则推进。
  async function runChapter(nodes) {
    const refs = new Map();
    for (const node of nodes) {
      if (node.type === "call") {
        const callId = startCall(node.action, node.args);
        if (node.ref) refs.set(node.ref, callId);
      } else if (node.type === "gate") {
        const result = await waitForCall(refs.get(node.ref));
        if (!result.ok) return result;
      }
    }
  }

  return { runChapter };
}

let currentRunner = createRunner();
currentRunner.runChapter(nodes);
```

内部函数可以使用外层的 calls，这是闭包建立的关联：第一次 createRunner 创建的函数访问第一张表，第二次创建的函数访问第二张表。

## 3. 替换 Runner 后，旧执行为什么还在

假设旧执行已经发起移动，正停在 gate 等待，此时创建新 Runner：

```javascript
currentRunner = createRunner();
```

这只改变了 currentRunner 的指向，之前 moveTo 收到的回调仍保存在移动系统中；那个回调使用的仍是旧的 onActionResult，旧函数又引用旧 calls。

```text
移动系统
  → 保存的完成回调
    → 旧 onActionResult
      → 旧 calls 中的 Promise
        → 旧 runChapter 在 await 之后的继续执行

currentRunner → 新 runChapter → 新 calls
```

因此，旧移动完成后，仍可能唤醒旧 gate，执行它后面的节点。需要保留的可能是旧函数和执行上下文，而不一定是原来返回的 Runner 对象外壳。

垃圾回收依据可达性回收内存，业务代码则需要明确“这次执行已经结束”：外部系统仍然持有回调时，相关状态仍可达；即使内存最终能释放，迟到的回调也可能在此之前产生错误的业务效果。

## 4. 在同一套代码上增加清理机制

现在给 createRunner 内部增加两个变量：active 表示本次执行是否有效，cleanups 保存资源的释放方法。

```javascript
// 与 calls 放在同一个 createRunner 内部。
let active = true;
const cleanups = [];
```

startGameAction 保留原来的分发和回调，只增加取消句柄的登记；这里约定 moveTo 返回的 cancel 会停止本次移动并释放其回调。

```javascript
function startGameAction(callId, action, args) {
  if (action === "move") {
    const movement = movementSystem.moveTo(
      args.npcId, args.target,
      () => onActionResult(callId, { ok: true })
    );
    cleanups.push(() => movement.cancel());
  }
}

// 原来的 onActionResult 入口新增一行检查，其余逻辑不变。
function onActionResult(callId, result) {
  if (!active) return;
  const call = calls.get(callId);
  if (!call || call.status !== "pending") return;
  call.status = "settled";
  call.result = result;
  call.resolve(result);
}
```

再提供一个统一的 dispose，结束这次执行：

```javascript
function dispose() {
  if (!active) return;
  active = false; // 先失效，清理时产生的回调也会被忽略。

  // 让正在等待的 gate 得到取消结果，退出旧执行。
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
```

runChapter 在每次执行节点前检查 active，在 gate 的 await 返回后也检查 active；正常结束和异常退出都通过 finally 调用 dispose。

```javascript
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

// createRunner 最后的返回值增加清理入口。
return { runChapter, dispose };
```

外部替换执行时，先清理，再创建新执行：

```javascript
currentRunner.dispose();
currentRunner = createRunner();
// 随后按存档恢复调用记录与节点位置。
```

旧回调检查旧 active，新回调检查新 active；旧等待得到取消结果后退出，新执行继续使用自己的 calls。

## 5. 可以复用的设计经验

- **创建时明确归属与释放方式**：订阅事件时保留取消订阅函数，启动动作时保留取消句柄，统一登记到所属执行。
- **业务结束时主动收尾**：释放所属资源，并让挂起的等待能够结束；共享的任务系统、音频系统由各自的生命周期管理。
- **接收异步结果时检查有效性**：取消底层工作减少无用执行，有效性检查阻止已经排队的旧结果生效。

页面请求、事件订阅、后台任务和编辑器预览也适用同一个原则：业务有效期结束时，显式结束它拥有的工作。
