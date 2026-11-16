> 设计模式 / 单例模式

**单例模式保证一个类只有一个实例，并提供访问该实例的统一入口。**

同一进程中的多处业务代码调用 `ConfigManager()` 时，需要得到同一个对象，而不是各自创建一个实例。

类级变量 `_instance` 保存这个实例；在 `__new__` 中检查，已有就返回，没有才创建并保存。多线程下，用同一把锁保护“检查、创建、保存”整个过程。

```python
import threading

class ConfigManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
            return cls._instance


a = ConfigManager()
b = ConfigManager()
assert a is b  # 两次调用返回同一个对象
```

**创建过程**

调用 `ConfigManager()` → 进入 `__new__` → 加锁 → 检查已有实例 → 不存在则创建并保存，存在则直接复用 → 返回实例 → 执行 `__init__`。

`__new__` 决定返回哪个实例，`__init__` 负责初始化；返回已有实例时，`__init__` 仍会执行。
