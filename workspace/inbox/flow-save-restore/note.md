存档与恢复，是将继续运行所需的状态数据持久化，读档时还原这些数据、重建运行中的关联，再从保存的执行位置继续。

## 1. 先保存剧情执行到哪里

沿用采花任务的场景：

```text
节点 1：call 切换 BGM
节点 2：call 启动采花任务，引用记为 flowerQuest
节点 3：gate 等待 flowerQuest
节点 4：call 展示感谢对话
```

玩家已经采集 2 次花，剧情停在节点 3。存档需要记住当前节点、剧情变量和游戏世界状态，读档后从节点 3 继续，前面的节点已经产生的效果随各系统的数据恢复。

如果是在两个 call 之间存档，例如 BGM 已切换、任务尚未启动，就把节点 2 保存为接下来要执行的位置。

## 2. 前面的 call 还在运行：保存它与等待节点的关联

剧情已经离开“启动任务”的节点，但采花任务仍在进行，所以执行位置之外，还需要保存调用记录：

```text
flowerQuest → 调用 C1 → 任务实例 Q1
               ↓            ↓
           等待完成       进行中，2/3
```

运行时，gate 等待的是 C1 的 Promise；存档保存 C1 的标识、动作类型、关联实例、状态和结果，读档时据此创建新的 Promise。

同一段剧情也可以先发起任务 A、B，再依次等待它们，因此调用记录和任务实例都可以有多条。

## 3. 各系统恢复自己的状态，剧情恢复调用关联

不同 call 的恢复职责可以分开：

| 调用 | 持久化的数据 | 读档后的处理 |
| --- | --- | --- |
| 切换 BGM | 音频系统保存当前曲目、音量、循环设置 | 音频系统恢复播放，剧情无需重放这个 call |
| 启动任务 | 任务系统保存实例状态与进度；剧情保存调用与实例的关联 | 恢复任务实例，再为对应 call 重建结果等待 |
| NPC 移动并等待到达 | 移动系统保存位置、目标及动作标识；剧情保存调用关联 | 从恢复的位置继续移动，到达后完成对应调用 |

是否需要等待结果，与是否需要保存状态，是两个独立问题：BGM 无需阻塞剧情，但仍需要恢复它的持续状态。

## 4. 用任务例子串起读档顺序

这里的“恢复 call”是重新接入已有任务，接取时创建实例，恢复时关联实例。

```text
恢复世界数据和任务实例：Q1 仍为进行中，进度 2/3
    ↓
恢复调用 C1：创建新 Promise，接上 Q1 的完成通知
    ↓
恢复任务检测：重新监听采花事件
    ↓
Runner 从节点 3 继续：gate 等待 C1 的新 Promise
```

如果 Q1 在存档中已经完成，就用保存的结果完成 C1 的 Promise；gate 会取得这个结果并继续。

下面的伪代码展开任务这一种调用的恢复过程：

```javascript
const save = {
  world: { /* 背包、位置、音频等系统的数据 */ },
  quests: [
    { instanceId: "Q1", questId: "collect-flowers",
      state: "active", progress: 2 }
  ],
  calls: [
    { callId: "C1", action: "startQuest",
      instanceId: "Q1", status: "pending" }
  ],
  runner: {
    nodeId: "wait-flowers",
    refs: { flowerQuest: "C1" }
  }
};

// 任务系统先还原实例数据，事件检测稍后开启。
function restoreQuests(records) {
  for (const record of records) {
    questInstances.set(record.instanceId, { ...record });
  }
}

// 剧情侧重建调用记录及 Promise。
function restoreCalls(records) {
  for (const record of records) {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    const call = { ...record, promise, resolve };
    calls.set(record.callId, call);

    const finish = result => {
      call.status = "settled";
      call.result = result;
      resolve(result);
    };

    if (record.status === "settled") {
      finish(record.result);
    } else {
      attachQuestResult(record.instanceId, finish);
    }
  }
}

// 任务适配器连接已有实例的结果，不改变任务进度。
function attachQuestResult(instanceId, finish) {
  const quest = questInstances.get(instanceId);
  if (quest.state === "completed") {
    finish(quest.result);
  } else {
    questSystem.onceCompleted(instanceId, finish);
  }
}

// 读档入口：先恢复数据与回调，再允许游戏继续运行。
async function loadGame(save) {
  restoreWorld(save.world);
  restoreQuests(save.quests);
  restoreCalls(save.calls);
  questSystem.resumeDetection();
  await runChapterFrom(save.runner.nodeId, save.runner.refs);
}

// Runner 到达 gate 时，等待重建后的调用记录。
async function executeGate(node, refs) {
  return await calls.get(refs[node.ref]).promise;
}
```

玩家再采一次花，任务系统将 Q1 的进度更新为 3，保存完成状态与结果，并发出完成通知；上面登记的 finish 随之完成 C1 的 Promise，剧情继续到感谢对话。

## 5. 保存时保持数据一致

一次存档统一采集剧情、任务、背包等状态；触发原因决定何时保存，保存内容由各系统的存档数据组成。

例如发放物品时，背包变化与“本次发放已完成”的执行记录需要在同一份一致的快照里；可以在这一轮相关状态更新结束后取快照，再写入存储，避免读档后重复发放。
