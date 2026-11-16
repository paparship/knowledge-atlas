数据驱动的流程建模，是将业务流程中的动作、等待条件、分支规则和状态变化表达为结构化配置，由通用运行器解释执行，具体业务能力由代码提供。

## 从简单需求逐步扩展

以“村长请玩家送信”为例，最初只需要按顺序调用游戏能力：

```text
call 展示对话("帮我送一封信吧")
call 发放道具("信件")
```

**需要等待动作完成时，引入 gate。** 展示对话的调用返回，不代表玩家已经看完对话；发放信件前需要等待结束事件。

```text
call 展示对话("帮我送一封信吧")
gate 等待这次对话结束
call 发放道具("信件")
```

call 负责发起动作，gate 负责等待条件满足；音乐可以发起后继续执行，对话可以等待结束后继续。完成事件可能先于 gate 到达，因此运行器需要保留事件，供后续等待匹配。

**需要根据结果走不同流程时，引入 choice。** gate 等结果，choice 决定后续路径。

```text
call 展示选择("愿意帮忙吗？", ["接受", "拒绝"])
gate 等待选择结果
choice 根据结果跳转
    接受 → 发放信件
    拒绝 → 结束剧情
```

**后续需要记住发生过什么时，引入 state。** 配置描述固定规则，运行状态记录本次执行的事实；章内数据、分支结果和跨章节 Flag 按各自生命周期保存。

```text
接受分支：
    state 记录 accepted = true
    call 发放道具("信件")
```

**章节需要报告结束结果时，引入 exit。** 上层根据出口原因选择后续章节。

```text
接受分支 → exit("accepted")
拒绝分支 → exit("declined")
```

## 从简写到确定的节点配置

简写中的“这次选择”“接受分支”依赖上下文理解；运行器需要明确的动作来源、参数和跳转目标。

| 字段 | 表达的信息 | 用途 |
| --- | --- | --- |
| node_id | 节点唯一标识 | 跳转引用、错误定位、记录进度 |
| type | call、gate、choice、state、exit | 选择执行逻辑 |
| params | 动作参数、等待条件、状态或分支规则 | 明确执行内容 |
| next | 正常执行后的目标节点 | 表达顺序连接 |
| branches | 不同结果对应的目标节点 | 表达分支连接 |

章节通过 entry_points 指定起点；exit 没有后续节点。next 和分支目标引用 node_id，即可表达图的连接。当前实现也允许省略 next 时按节点列表顺序继续。

明确的键值对让运行器按规则执行、校验器检查参数与目标引用、编辑器展示连接，日志和存档也能定位到同一节点。

## JSON 示例

下面沿用项目的节点结构，动作名、参数和事件名采用教学示例；具体游戏能力由适配接口提供。

```text
询问 → 等待回答 → 根据回答分支
                    接受 → 记录状态 → accepted 出口
                    拒绝 → declined 出口
```

```json
{
  "chapter_id": "village_request",
  "title": "村长的委托",
  "description": "询问玩家是否愿意送信",
  "entry_points": [
    { "entry_id": "start", "start_node": "ask_player" }
  ],
  "nodes": [
    {
      "node_id": "ask_player",
      "type": "call",
      "params": {
        "action": "show_choice",
        "args": {
          "text": "愿意帮我送一封信吗？",
          "options": [
            { "id": "accept", "text": "接受" },
            { "id": "decline", "text": "拒绝" }
          ]
        }
      },
      "next": "wait_answer"
    },
    {
      "node_id": "wait_answer",
      "type": "gate",
      "params": { "expect": "ask_player.result" },
      "next": "route_answer"
    },
    {
      "node_id": "route_answer",
      "type": "choice",
      "params": {
        "source": "ask_player.result",
        "write_token": "answer",
        "branches": {
          "accept": "remember_acceptance",
          "decline": "end_declined"
        }
      }
    },
    {
      "node_id": "remember_acceptance",
      "type": "state",
      "params": { "write": { "accepted": true } },
      "next": "end_accepted"
    },
    {
      "node_id": "end_accepted",
      "type": "exit",
      "params": { "exit_reason": "accepted" }
    },
    {
      "node_id": "end_declined",
      "type": "exit",
      "params": { "exit_reason": "declined" }
    }
  ]
}
```
