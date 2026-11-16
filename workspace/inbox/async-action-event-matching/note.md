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

```text
调用表 = Map()  // 调用 ID → 调用记录

function 发起调用(动作, 参数):
    id = 生成唯一 ID()
    promise, resolve = 创建 Promise 及其完成回调()

    调用表[id] = {
        状态: "执行中",
        promise,
        resolve
    }

    启动游戏动作(id, 动作, 参数)  // 完成后带回这个 ID
    return id

function 收到动作结果(id, 结果):
    记录 = 调用表[id]
    if 记录不存在 or 记录.状态 != "执行中":
        return

    记录.状态 = "已结束"
    记录.resolve(结果)  // 结果为成功或失败，重复回传不再处理

function 等待调用结果(id):
    if 调用表[id] 不存在:
        报错("未知调用")
    return 调用表[id].promise
```

Promise 保存完成状态和结果：先等待时，结果到达后唤醒等待；先完成时，后续等待直接得到已有结果。这里用结果对象表达成功或失败。

## ChapterRunner 怎么推进

```text
async function ChapterRunner(节点列表):
    调用引用 = Map()  // a、b → 调用 ID

    for 节点 in 节点列表:
        if 节点.type == "call":
            id = 发起调用(节点.动作, 节点.参数)
            if 节点有引用名:
                调用引用[节点.引用名] = id
            // 继续读取下一个节点，不等待游戏动作完成

        else if 节点.type == "gate":
            id = 调用引用[节点.等待引用]
            结果 = await 等待调用结果(id)
            if 结果是失败:
                返回流程失败
            // 成功后继续下一个节点
```

在这个场景中，a、b 分别指向两个调用记录；A 的结果只完成 A 的 Promise，gate(b) 等待的是 B 的 Promise。

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
