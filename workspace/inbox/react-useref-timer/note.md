`useRef(null)` 返回一个形如 `{ current: null }` 的对象。`current` 是普通属性，可以直接读写。只要还是同一个组件实例，重新渲染时 `useRef` 就会返回同一个对象。修改 `current` 本身不会触发重新渲染。

```jsx
import { useRef, useState } from "react";

function Timer() {
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef(null);

  function start() {
    if (timerRef.current !== null) return;

    const id = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    timerRef.current = id;
  }

  function stop() {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  return (
    <div>
      <p>{seconds} 秒</p>
      <button onClick={start}>开始</button>
      <button onClick={stop}>停止</button>
    </div>
  );
}
```

1. 点击「开始」，React 调用 `start`。浏览器的 `setInterval` 启动定时器并立即返回 ID，例如 `7`，随后 `start` 把这个 ID 存进 `timerRef.current`。
2. 约一秒后，浏览器调用定时器回调。`setSeconds` 让组件重新渲染，界面变为「1 秒」。这次渲染拿到的是同一个 ref 对象，`current` 仍是 `7`。
3. 点击「停止」，新一轮渲染里的 `stop` 仍能读到 `7`，于是调用 `clearInterval(7)` 停止定时器。
