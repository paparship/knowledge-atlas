在一个整数序列里，如果某个内部元素严格处于当前左右邻居之间，就可以删除它。重复删除，直到没有可删元素，输出剩余长度和元素。题目保证删除顺序不影响最后结果。

## 思路

从左向右扫描，用栈保存已经稳定的前缀。读到新元素 `x` 时，前缀内部的邻接关系还没变，只有「栈顶下方、栈顶、x」这个末尾三元组需要检查。若三者严格递增或严格递减，就弹出中间的栈顶，再用新的栈顶检查，最后将 `x` 入栈。相等时达不到严格不等式，因此保留。

例如处理 `[1, 3, 5, 4, 2]`：

| 读到 | 操作 | 当前栈 |
|---|---|---|
| 1、3 | 还凑不成三元组 | `[1, 3]` |
| 5 | `1 < 3 < 5`，弹出 3，再压入 5 | `[1, 5]` |
| 4 | 5 不在 1 和 4 之间 | `[1, 5, 4]` |
| 2 | `5 > 4 > 2`，弹出 4，再压入 2 | `[1, 5, 2]` |

## Python 实现

```python
import sys


def stabilize(values):
    stack = []

    for x in values:
        # x 是右邻居，栈顶是中间值，栈顶下方是左邻居
        while len(stack) >= 2:
            left, middle = stack[-2], stack[-1]
            if not (left < middle < x or left > middle > x):
                break
            stack.pop()
        stack.append(x)

    return stack


def main():
    read = sys.stdin.buffer.readline
    t = int(read())
    output = []

    for _ in range(t):
        n = int(read())
        values = map(int, read().split())
        stable = stabilize(values)
        output.append(str(len(stable)))
        output.append(" ".join(map(str, stable)))

    sys.stdout.write("\n".join(output) + "\n")


if __name__ == "__main__":
    main()
```

每个元素入栈一次，最多出栈一次。单组数据的时间和空间复杂度都是 `O(n)`。
