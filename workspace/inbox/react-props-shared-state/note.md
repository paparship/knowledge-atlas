父组件通过 props 把数据或函数传给子组件；当两个兄弟组件需要读写同一份状态时，把状态放在它们最近的共同父组件中，这叫**状态提升**。

## 例子：一个组件显示计数，另一个组件负责按钮

下面是一个完整的 `App.jsx`。父组件 `App` 保存计数，两个子组件分别接收一个数字和一个函数。

```jsx
import { useState } from "react";

function Display({ count }) {
  return <p>当前计数：{count}</p>;
}

function AddButton({ onAdd }) {
  return <button onClick={onAdd}>加 1</button>;
}

export default function App() {
  const [count, setCount] = useState(0);

  function handleAdd() {
    setCount(n => n + 1);
  }

  return (
    <div>
      <Display count={count} />
      <AddButton onAdd={handleAdd} />
    </div>
  );
}
```

首次渲染时，`<Display count={count} />` 把数字 `0` 传给 `Display`；`<AddButton onAdd={handleAdd} />` 把函数 `handleAdd` 传给 `AddButton`，子组件用名字 `onAdd` 接收它。

点击「加 1」时，React 调用按钮的 `onClick` 处理函数，也就是父组件定义的 `handleAdd`。它更新 `App` 的状态，下一次渲染时 `Display` 收到的 `count` 变成 `1`，页面显示「当前计数：1」。