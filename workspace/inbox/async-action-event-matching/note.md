异步动作与事件匹配，是为每次动作调用建立独立的结果记录，通过调用 ID 将完成事件与等待节点关联，使流程在指定动作完成后继续执行。

## 场景与执行流程

守卫 A 走到门口，守卫 B 走到玩家旁边，两人同时移动；B 到位后开始对话。

```text
节点 1：call A 移动，调用引用记为 a
节点 2：call B 移动，调用引用记为 b
节点 3：gate 等待 b
节点 4：call B 开始对话
```

ChapterRunner 按顺序读取节点：call 发起动作后继续，gate 等待对应动作完成后继续。

## 用调用 ID 和 Promise 保存一次执行

调用表使用 Map，按调用 ID 保存状态、Promise 及其完成回调；配置中的 a、b 则映射到本次执行生成的 ID。

```javascript
const calls = new Map(); // callId → 调用记录

// 创建调用记录并发起游戏动作，返回调用 ID，不等待动作完成。
function startCall(action, args) {
  const callId = createUniqueId();
  let resolve;
  const promise = new Promise(done => { resolve = done; });

  calls.set(callId, {
    status: "pending",
    promise,
    resolve
  });

  startGameAction(callId, action, args);
  return callId;
}

// 将动作交给对应游戏系统，在动作或任务完成时回传结果。
function startGameAction(callId, action, args) {
  if (action === "move") {
    movementSystem.moveTo(args.npcId, args.target, () => {
      onActionResult(callId, { ok: true });
    });
  } else if (action === "dialogue") {
    dialogueSystem.show(args.npcId, args.text, () => {
      onActionResult(callId, { ok: true });
    });
  } else if (action === "startQuest") {
    // 任务系统从激活时开始统计采集事件，达到目标后调用 onComplete。
    questSystem.start(args.questId, {
      onComplete: () => onActionResult(callId, { ok: true })
    });
  } else {
    onActionResult(callId, { ok: false, error: "Unknown action" });
  }
}

// 接收动作结果，按调用 ID 完成对应的 Promise，唤醒等待者。
function onActionResult(callId, result) {
  const call = calls.get(callId);
  if (!call || call.status !== "pending") return;

  call.status = "settled";
  call.resolve(result); // result: { ok, value?, error? }
}

// 返回指定调用的 Promise，供 gate 等待或取得已完成的结果。
function waitForCall(callId) {
  const call = calls.get(callId);
  if (!call) throw new Error("Unknown call ID");
  return call.promise;
}

// 等待背包数量满足条件；已有物品也计入，不依赖某次动作调用。
function waitForInventory(itemId, count) {
  return new Promise(resolve => {
    const check = () => {
      if (inventorySystem.getCount(itemId) >= count) {
        unsubscribe();
        resolve({ ok: true });
      }
    };

    const unsubscribe = inventorySystem.onChange(check);
    check(); // 登记监听后立即检查，已有 3 朵花就直接完成。
  });
}

```

Promise 保存完成状态和结果：先等待时，结果到达后唤醒等待；先完成时，后续等待直接得到已有结果。这里用结果对象表达成功或失败。

## ChapterRunner 怎么推进

```javascript
// 顺序执行节点：call 发起动作后继续，gate 等待对应动作成功后继续。
async function runChapter(nodes) {
  const refs = new Map(); // 配置里的 a、b → 本次调用 ID

  for (const node of nodes) {
    if (node.type === "call") {
      const callId = startCall(node.action, node.args);
      if (node.ref) refs.set(node.ref, callId);
      // 发起动作后，继续读取下一节点
    } else if (node.type === "gate") {
      let result;
      if (node.condition?.type === "inventory") {
        // 状态型 gate：直接检查背包，不需要前置 call。
        result = await waitForInventory(
          node.condition.itemId, node.condition.count
        );
      } else {
        // 调用型 gate：等待 move、dialogue 或 startQuest 的结果。
        result = await waitForCall(refs.get(node.ref));
      }
      if (!result.ok) return result;
      // 等待成功后，继续下一节点
    }
  }
}
```

在这个场景中，a、b 分别指向两个调用记录；A 的结果只完成 A 的 Promise，gate(b) 等待的是 B 的 Promise。

同一个 Runner 可以接入下面两种节点配置：

```javascript
// 背包已有 3 朵花即可继续，包括剧本启动前获得的花。
const inventoryNodes = [
  {
    type: "gate",
    condition: { type: "inventory", itemId: "flower", count: 3 }
  },
  {
    type: "call", action: "dialogue",
    args: { npcId: "villager", text: "你带够花了。" }
  }
];

// collect-3-flowers 的任务规则：激活后采集 3 次花。
// 进度统计由任务系统负责，剧情等待任务完成回调。
const questNodes = [
  {
    type: "call", action: "startQuest", ref: "flowerQuest",
    args: { questId: "collect-3-flowers" }
  },
  { type: "gate", ref: "flowerQuest" },
  {
    type: "call", action: "dialogue",
    args: { npcId: "villager", text: "采集任务完成了。" }
  }
];

// 分别作为两段独立流程运行：runChapter(inventoryNodes) 或 runChapter(questNodes)。
```

## 三种完成时序

**① 进入 gate 后，A 先完成，B 后完成**

```text
Runner：发起 A → 发起 B → gate(b) 等待
A 到位：完成 A 的 Promise → gate(b) 仍然等待
B 到位：完成 B 的 Promise → gate(b) 放行 → 开始对话
```

**② 进入 gate 后，B 先完成，A 后完成**

```text
Runner：发起 A → 发起 B → gate(b) 等待
B 到位：完成 B 的 Promise → gate(b) 放行 → 开始对话
A 到位：完成 A 的 Promise
```

开始对话时 A 可以仍在移动，因为流程只要求等待 B。

**③ B 已经完成，Runner 才执行到 gate**

例如 B 已在目标位置，启动动作时立即回传成功：

```text
Runner：登记 B 的调用记录 → 启动 B 移动
B 到位：立即完成 B 的 Promise
Runner：执行 gate(b) → 取得已有结果 → 开始对话
```

因此，调用记录要在启动动作前建立，完成结果保留在对应的 Promise 中，供 gate 读取。

