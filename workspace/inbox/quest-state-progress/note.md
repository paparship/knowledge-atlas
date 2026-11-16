任务状态与进度管理，是把任务目标定义为配置，为每次接取保存独立的运行状态，并根据游戏状态或事件更新进度、判定完成。

## 从一个采集任务开始

村民要求玩家在接取任务后采集 3 次花，完成后继续对话。

任务系统需要回答三件事：目标是什么、这次任务进行到哪里、什么事件会推进它。

### 1. 分开保存任务定义与运行实例

任务定义描述规则；运行实例记录玩家这次执行的状态。

```javascript
// 配置：这类任务的目标是什么。
const definition = {
  questId: "gather-flowers",
  objective: {
    type: "eventCount",
    event: "flowerGathered",
    targetId: "flower",
    required: 3
  }
};

// 实例：本次接取产生的进度，作为存档数据。
const instance = {
  instanceId: "quest-run-42",
  questId: "gather-flowers",
  state: "active",
  current: 0
};
```

任务再次接取时，沿用同一份定义，创建新的实例；完成通知也携带 instanceId，关联到这次执行。

### 2. 由目标类型决定如何计算进度

| 目标语义 | 激活时 | 后续更新 |
| --- | --- | --- |
| 当前持有 3 朵花 | 读取背包当前数量 | 背包变化后重新读取数量 |
| 接取后采集 3 次花 | 计数从 0 开始 | 每次匹配的采集事件使计数加 1 |

第一种是状态判定，进度来自物品系统；第二种是事件累计，进度保存在任务实例中。

以第二种为例，采集系统发出事件，任务系统按事件类型和目标匹配活跃任务，再更新对应实例：

```javascript
// 采集系统完成一次采集后发出事件。
events.emit("flowerGathered", { targetId: "flower" });

// 任务模块初始化时登记处理器；只推进匹配的活跃实例。
events.on("flowerGathered", event => {
  for (const instance of activeInstances.values()) {
    const goal = definitions.get(instance.questId).objective;
    if (goal.type !== "eventCount") continue;
    if (goal.event !== "flowerGathered") continue;
    if (goal.targetId !== event.targetId) continue;

    instance.current = Math.min(instance.current + 1, goal.required);
    notifyProgress(instance); // 任务面板据此更新进度。

    if (instance.current === goal.required) {
      completeQuest(instance);
    }
  }
});

// 完成任务：先落下终态，再通知外部。
function completeQuest(instance) {
  instance.state = "completed";
  activeInstances.delete(instance.instanceId);
  notifyCompleted({ instanceId: instance.instanceId });
}
```

### 3. 用状态机规定任务何时能推进

最小生命周期是：

```text
pending ──接取──→ active ──目标达成──→ completed
                   │
                   └──放弃──→ cancelled
```

只有 active 实例参与目标检测和进度更新；状态转换统一由任务管理器处理，面板、剧情和游戏系统通过接口请求变化。

若任务需要交付物品或发放奖励，可以加入 settling：目标达成后进入结算，交付和奖励处理成功后再进入 completed。

### 4. 通过完成通知接回剧情

```text
剧情 call → 接取任务 → 创建 active 实例
                         ↓
采集系统 → 采集事件 → 匹配目标 → 更新进度 1 → 2 → 3
                         ↓
                 completed(instanceId)
                         ↓
剧情适配层 → 完成对应 call 的 Promise → gate 恢复 → 继续对话
```

任务系统负责目标判定与生命周期，剧情系统负责前后流程；任务面板和引导系统订阅进度、状态变化，更新各自的展示。
