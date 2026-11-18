React 是一个用 JavaScript 构建界面的库。组件函数根据当前数据返回一份界面描述，React 根据这份描述创建或更新页面 DOM。

## 在普通 HTML 里放一个 React 组件

把下面的内容存成 `index.html`，联网打开后，每点击一次按钮，计数就加一。

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>React 计数器</title>
</head>
<body>
  <h1>这个标题由普通 HTML 提供</h1>
  <div id="app"></div>

  <script type="module">
    import { createElement, useState } from "https://esm.sh/react@19";
    import { createRoot } from "https://esm.sh/react-dom@19/client";

    function Counter() {
      const [count, setCount] = useState(0);

      return createElement(
        "button",
        { onClick: () => setCount(current => current + 1) },
        `点击次数：${count}`
      );
    }

    const root = createRoot(document.getElementById("app"));
    root.render(createElement(Counter));
  </script>
</body>
</html>
```

`createRoot` 指定 React 管理哪块页面，`root.render` 把 `Counter` 渲染进去。组件里的 `createElement("button", …)` 描述按钮的类型、点击事件和文字，React 根据它在 DOM 中创建真正的按钮。

## React 组件怎么渲染？调用 setState 后为什么马上读到的还是旧值？

`const [count, setCount] = useState(0)` 拿到的是一对值：

- `count` 是本次渲染读到的状态值，第一次是 `0`。
- `setCount` 是修改计数状态的函数。点击按钮时，`setCount(current => current + 1)` 根据前一个值计算新值，并安排 React 重新渲染组件。

下一次运行 `Counter` 时，`count` 读到 `1`，返回的按钮描述就变成「点击次数：1」，React 随之更新页面上的按钮文字。
