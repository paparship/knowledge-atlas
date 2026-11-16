> 设计模式 / 责任链模式

**责任链模式将多个处理器连接成链，使请求沿链传递，由各处理器决定处理请求、继续传递或终止流程。**

普通接口需要“认证 → 限流”，管理接口需要“认证 → 管理员权限检查 → 限流”。各项检查独立实现，再按接口需求组装成不同的链，复用检查逻辑；调用方只需把请求交给链的入口。

每个处理器检查通过后交给下一步，不通过就直接返回错误，后续处理器不再执行。

```python
class Handler:
    def __init__(self, next_handler=None):
        self.next_handler = next_handler

    def handle(self, request):
        if self.next_handler:
            return self.next_handler.handle(request)
        return "允许进入业务处理"


class Authentication(Handler):
    def handle(self, request):
        if request["user"] is None:
            return "拒绝：未登录"
        return super().handle(request)


class AdminPermission(Handler):
    def handle(self, request):
        if not request["user"]["is_admin"]:
            return "拒绝：需要管理员权限"
        return super().handle(request)


class RateLimit(Handler):
    def handle(self, request):
        if request["over_limit"]:
            return "拒绝：请求过于频繁"
        return super().handle(request)


# 组装两条不同的处理链
normal_api = Authentication(RateLimit())
admin_api = Authentication(AdminPermission(RateLimit()))

request = {
    "user": {"name": "小明", "is_admin": False},
    "over_limit": False,
}

print(normal_api.handle(request))
print(admin_api.handle(request))
```

**预期输出**

```text
允许进入业务处理
拒绝：需要管理员权限
```
**与装饰器模式的区别**：
责任链重点组织请求的流转规则——每一步判断自己处理、继续传递还是结束；装饰器重点组织能力的叠加——通过包装组合出需要的功能。
