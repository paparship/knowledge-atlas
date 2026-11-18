C# 中，`struct` 是值类型，变量赋值时会复制各个字段的值。`class` 是引用类型，变量赋值时会复制引用，两个变量仍指向同一个对象。

## 赋值时复制什么

```csharp
struct PointValue { public int X; }
class PointObject { public int X; }

class Program
{
    static void Main()
    {
        var value1 = new PointValue { X = 1 };
        var value2 = value1;       // 复制结构体的字段值
        value2.X = 2;

        var object1 = new PointObject { X = 1 };
        var object2 = object1;     // 复制引用，指向同一个对象
        object2.X = 2;

        System.Console.WriteLine($"{value1.X},{object1.X}"); // 1,2
    }
}
```

因此，修改 `value2.X` 只影响这份副本。修改 `object2.X` 改的是共享对象，通过 `object1.X` 也能读到新值。如果结构体的字段本身是 `List<T>` 等引用类型，赋值会复制该字段的引用，两份结构体仍共享那张列表。

## 什么时候选 struct 或 class

| 选择 | 适合表达什么 | 游戏开发中的例子 |
|---|---|---|
| `struct` | 小而独立的值，复制后应能独立使用。通常设计成不可变，避免修改副本时误以为改到了原值 | 坐标、方向、颜色 |
| `class` | 有独立身份或生命周期的对象，多个模块需要引用同一个实例并观察其状态变化 | 玩家、NPC、任务实例 |

例如，记录 NPC 出生点时，可以复制一份坐标作为初始值。任务系统和交互系统如果都要操作同一个 NPC，则持有同一个 NPC 对象的引用。
