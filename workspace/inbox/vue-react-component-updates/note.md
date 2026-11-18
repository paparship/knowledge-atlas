Vue 是一个用组件构建用户界面的 JavaScript 框架。以“点击按钮，计数加一”为例，Vue 常用模板把页面绑定到响应式数据，React 常用 JSX 描述当前状态对应的界面。

## Vue 3：修改模板使用的响应式数据

```html
<!-- Counter.vue -->
<script setup>
import { ref } from 'vue'

const count = ref(0)

function increment() {
  count.value++
}
</script>

<template>
  <button @click="increment">计数：{{ count }}</button>
</template>
```

`@click` 把点击事件绑定到 `increment`。脚本用 `count.value` 修改数值，模板里的 `{{ count }}` 会自动读取这个值；Vue 在渲染时追踪到这项依赖，数值变化后就会更新按钮文字。

## React：更新状态，重新执行组件函数

```jsx
// Counter.jsx
import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  function increment() {
    setCount(n => n + 1)
  }

  return <button onClick={increment}>计数：{count}</button>
}
```

`onClick` 把点击事件绑定到 `increment`。调用 `setCount` 后，React 重新执行 `Counter()`，这次 `useState` 给出的 `count` 是 1，React 根据新的 JSX 把按钮文字更新为“计数：1”。