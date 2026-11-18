给定按时间排列的有向回执 `u → v`。只有两个方向都出现过，无序对 `{u, v}` 才完成互认。输出完成互认的对数，以及最早完成的记录位置，位置从 1 开始。没有互认时输出 `0 0`。

## 思路

用集合 `seen` 保存见过的有向对。依次读每条记录，先用 `(u, v)` 判断是否重复。若这方向首次出现，再查反向 `(v, u)`。反向已经见过，说明这是第二个方向，该无序对就在当前位置首次完成互认。按输入顺序处理，第一次计数时的位置就是最早完成位置。

以 `1→2、1→2、2→1、3→4、4→3、5→6、6→5` 为例，第 2 条是重复记录，三个互认对分别在第 3、5、7 条完成，输出 `3 3`。

## Python 实现

```python
import sys


def mutual_receipts(records):
    seen = set()
    count = earliest = 0

    for position, (u, v) in enumerate(records, start=1):
        if (u, v) in seen:
            continue  # 同方向的重复记录不改变互认状态

        if (v, u) in seen:
            count += 1
            if earliest == 0:
                earliest = position

        seen.add((u, v))

    return count, earliest


def main():
    read = sys.stdin.buffer.readline
    n = int(read())
    records = (tuple(map(int, read().split())) for _ in range(n))
    print(*mutual_receipts(records))


if __name__ == "__main__":
    main()
```

每条记录最多做常数次集合操作，平均时间复杂度为 `O(n)`，空间复杂度为 `O(n)`。
