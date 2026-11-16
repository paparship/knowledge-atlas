任务状态与进度管理，是记录任务的执行阶段和目标进度，并根据游戏状态或事件判断任务何时完成。

## 1. 最简单的任务：采集 3 次花

玩家接取任务后，开始监听采花事件；每发生一次，计数加 1，达到 3 次就完成。

```javascript
// 接取任务时调用，先只处理这一种任务。
function acceptFlowerQuest() {
  let current = 0;
  const unsubscribe = events.on("flowerGathered", () => {
    current += 1;
    if (current === 3) {
      unsubscribe();
      onCompleted();
    }
  });
}
```

这时核心只有一个计数器和一个完成条件。

## 2. 允许放弃任务：进度之外还需要状态

玩家采了 2 次花后放弃任务，之后再采花就不应推进它；因此，需要记录任务是否仍在进行。

```text
pending ──接取──→ active ──达到目标──→ completed
                   └──放弃──→ cancelled
```

处理事件时先检查状态，只有 active 才更新进度；完成或放弃后停止监听，由统一的状态转换入口处理这些变化。

如果还需要发奖励，可以在 active 与 completed 之间加入 settling，表示目标已达成、正在结算，结算成功后再通知完成。

## 3. 增加采矿任务：把差异从流程里提出来

现在又有“采集 5 次矿石”的任务，两者都执行“匹配采集事件 → 更新计数 → 检查目标 → 完成”，差别是采集对象和目标次数。

先用简写表达规则：

```text
采花任务：累计 gather(flower) 事件，达到 3 次
采矿任务：累计 gather(ore)    事件，达到 5 次
```

采集系统统一发出 `gather(itemId)` 事件，任务系统用每个活跃任务的规则匹配；一次采花可以同时推进多个要求采花的任务。

```javascript
// 收到采集事件后，按各任务的目标更新进度。
function onGather(itemId) {
  for (const task of activeTasks) {
    if (task.targetId !== itemId) continue;
    task.current += 1;
    if (task.current >= task.required) {
      complete(task);
    }
  }
}
```

## 4. 改为“持有 3 朵花”：目标的判断方式也需要区分

如果要求的是当前背包中有 3 朵花，玩家接取前已有的花也应计入，进度便要从背包读取。

| 目标 | 接取时 | 后续更新 |
| --- | --- | --- |
| 接取后采集 3 次 | 计数置为 0 | 匹配的采集事件使计数加 1 |
| 当前持有 3 朵花 | 读取当前背包数量 | 背包变化后重新读取数量 |

于是，目标规则再增加一个判断类型：`eventCount` 表示累计事件，`inventoryCount` 表示读取持有量；任务管理器根据类型选用相应的检测逻辑。

## 5. 任务可以重复接取：分开规则与这次进度

同一个任务明天可以再次接取，“采花 3 次”的规则沿用，而这次的进度从 0 开始。

因此，将任务拆为两份数据：**任务定义**保存目标规则，**运行实例**保存本次状态和进度；定义用 questId 标识，每次接取用独立的 instanceId 标识。

任务面板读取实例展示进度，完成通知携带 instanceId；剧情适配层据此完成对应 call 的 Promise，让等待它的 gate 继续。

## 6. 最后把简写展开为 JSON

前面的简写：

```text
采花任务：接取后累计 gather(flower)，达到 3 次
这次执行：进行中，已完成 2 次
```

任务定义把“监听什么、匹配谁、达到多少”变成明确字段：

```json
{
  "questId": "gather-flowers",
  "objective": {
    "type": "eventCount",
    "event": "gather",
    "targetId": "flower",
    "required": 3
  }
}
```

对应的运行实例单独保存，可随玩家存档恢复：

```json
{
  "instanceId": "quest-run-42",
  "questId": "gather-flowers",
  "state": "active",
  "current": 2
}
```
