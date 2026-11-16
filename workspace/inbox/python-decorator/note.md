> Python / 装饰器语法

Python 的 `@` 用于把函数或类交给装饰器处理，再将返回值绑定到原来的名字；当装饰器返回增加了功能、保持调用接口的包装函数时，就体现了装饰器模式的思路。

```python
from functools import wraps


def log(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        print("开始执行")
        result = func(*args, **kwargs)
        print("执行完成")
        return result
    return wrapper


@log
def greet(name):
    return f"你好，{name}"


# @log 相当于在定义原函数后执行 greet = log(greet)
print(greet("小明"))
```

**预期输出**

```text
开始执行
执行完成
你好，小明
```
