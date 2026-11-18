TypeScript 在 JavaScript 上增加了**静态类型检查**：开发者可以声明参数、变量等值的类型，编辑器和编译器据此在运行前发现类型不匹配的用法。

```typescript
function double(n: number) {
  return n * 2
}

const result = double(3) // 值为 6，TS 推断 result 的类型为 number
double("3")              // 类型错误：传入了字符串，参数要求 number
```

这里显式写出的类型只有参数的 `number`。TS 根据乘法表达式推断出函数返回数字，因此调用方也知道 `result` 是数字。

生成 JavaScript 时，参数上的 `: number` 会被移除。原生 JS 执行同样的乘法时，会把字符串 `"3"` 转为数字并算出 `6`；TS 提前指出的是调用与函数声明之间的不一致。