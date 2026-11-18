`key` 是列表项在同一组兄弟元素中的稳定标识。列表插入、删除或重排时，React 用它匹配前后两次渲染中的列表项，让每一行的组件状态跟随对应的数据。

## 例子：在 B 行写下的草稿

列表最初有 A、B 两行，每个 `Row` 自己保存输入框的草稿。在 B 行输入“周五交稿”，再点击按钮把 X 插到最前面。

```jsx
import { useState } from "react";

function Row({ name }) {
  const [draft, setDraft] = useState("");
  return (
    <li>
      <label>
        {name} <input value={draft} onChange={e => setDraft(e.target.value)} />
      </label>
    </li>
  );
}

export default function App() {
  const [items, setItems] = useState([{ id: "A" }, { id: "B" }]);
  const hasX = items.some(item => item.id === "X");

  return (
    <>
      <button disabled={hasX} onClick={() => setItems([{ id: "X" }, ...items])}>
        在顶部插入 X
      </button>
      <ul>
        {items.map(item => <Row key={item.id} name={item.id} />)}
      </ul>
    </>
  );
}
```

| key 的取法 | 插入前，B 行的 key | 插入后，谁沿用这个 key | 草稿显示在哪 |
| --- | --- | --- | --- |
| 数据 ID | `"B"` | 第三行 B | B 的输入框 |
| 数组下标 | `1` | 第二行 A | A 的输入框 |

用下标时，插入前后 `key={1}` 都指第二行。React 复用这个 `Row`，它收到的名字从 B 变成了 A，内部的 `draft` 却仍然是“周五交稿”。