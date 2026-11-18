寻路是从地图里找一条起点到终点的路径。可以把每个可走的格子当作节点，把上下左右能走的一步当作边。算法的区别在于每一步优先检查哪个格子。

| 算法 | 下一步扩展谁 | 适用场景与取舍 |
|---|---|---|
| BFS | 先入队的格子先扩展，因此按步数向外一层层搜索 | 每步代价相同时找最少步数，例如普通格子地图。在有泥地等不同路费的地图上，步数最少的路可能更贵 |
| Dijkstra | 从起点走到这里的已知最低代价 `g` 最小的格子先扩展 | 路费不同且非负，例如地形耗时不同。只关心走到当前格子的成本，各方向都可能扩展。继续搜完也能得到同一起点到各可达点的距离 |
| A* | `g + h` 最小的格子先扩展，`h` 是从当前格子到终点的估计代价 | 终点已知且有合适的估计时，例如角色走向地图上的目标点。估计越能反映剩余距离，通常越能少搜无关区域 |

## 用同一张地图比较

从 S 到 G，只能上下左右移动。进入普通格花 1，进入泥地花 5。**BFS 直穿泥地，用 6 步、代价 26。Dijkstra 和 A* 从下方绕开泥地，用 8 步、代价 8。**

A* 用曼哈顿距离估计剩余代价。比如离终点横向差 3 格、纵向差 1 格，至少要走 4 步，每步至少花 1，所以估计值为 4。地图上的墙和泥地可能让实际代价更高，这个估计仍是下界，因此这里的 A* 能找到最低代价路径。把估计值设成 0，就得到 Dijkstra。

## Python 实现

BFS 用普通队列，格子第一次入队就记下前驱。Dijkstra 和 A* 共用一套最小堆搜索，发现更便宜的走法时会更新代价和前驱，并重新入堆。旧记录稍后出堆时会被跳过。三个算法都在终点从队列或堆中取出后回溯路径。

```python
from collections import deque
from heapq import heappop, heappush

# # 是墙，M 是泥地，其余格子的进入代价都是 1
grid = [
    ".........",
    "..#...#..",
    ".SMMMMMG.",
    ".........",
    ".###.....",
    ".........",
]
start, goal = (2, 1), (2, 7)  # (行, 列)，从 0 开始


def neighbors(cell):
    """列出上下左右可走的格子。"""
    row, col = cell
    for dr, dc in [(-1, 0), (0, 1), (1, 0), (0, -1)]:
        r, c = row + dr, col + dc
        if 0 <= r < len(grid) and 0 <= c < len(grid[0]):
            if grid[r][c] != "#":
                yield r, c


def enter_cost(cell):
    row, col = cell
    return 5 if grid[row][col] == "M" else 1


def build_path(parent, goal):
    """从终点沿前驱回到起点，再反转。"""
    path = []
    cell = goal
    while cell is not None:
        path.append(cell)
        cell = parent[cell]
    return path[::-1]


def bfs(start, goal):
    queue = deque([start])
    parent = {start: None}  # 记录前驱，同时标记已经入队的格子
    while queue:
        cell = queue.popleft()
        if cell == goal:
            return build_path(parent, goal)

        for nxt in neighbors(cell):
            if nxt in parent:
                continue
            parent[nxt] = cell
            queue.append(nxt)
    return []


def shortest_path(start, goal, estimate):
    """estimate 返回从指定格子到终点的预估代价。"""
    best = {start: 0}      # 已找到的最低实际代价 g
    parent = {start: None}
    heap = [(estimate(start, goal), 0, start)]  # (优先级, g, 格子)

    while heap:
        _, cost, cell = heappop(heap)
        if cost != best[cell]:
            continue      # 这个格子后来找到了更便宜的路径
        if cell == goal:
            return build_path(parent, goal)

        for nxt in neighbors(cell):
            new_cost = cost + enter_cost(nxt)
            if nxt in best and new_cost >= best[nxt]:
                continue
            best[nxt] = new_cost
            parent[nxt] = cell
            priority = new_cost + estimate(nxt, goal)
            heappush(heap, (priority, new_cost, nxt))
    return []


def dijkstra(start, goal):
    return shortest_path(start, goal, lambda cell, goal: 0)


def manhattan(cell, goal):
    row, col = cell
    goal_row, goal_col = goal
    return abs(row - goal_row) + abs(col - goal_col)


def astar(start, goal):
    return shortest_path(start, goal, manhattan)


for name, search in [("BFS", bfs), ("Dijkstra", dijkstra), ("A*", astar)]:
    path = search(start, goal)
    if path:
        print(name, len(path) - 1, sum(map(enter_cost, path[1:])), path)
    else:
        print(name, "无可达路径")
```

动画里的浅蓝格已经发现、等待扩展。深蓝格已经处理，橙框标出当前格，紫色显示最终路径。可以先比较走出来的路，再逐步看每种算法优先扩展哪里。
