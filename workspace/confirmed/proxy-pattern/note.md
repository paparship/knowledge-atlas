> 设计模式 / 代理模式

**代理模式为一个对象提供具有相同接口的代理对象，由代理控制对原对象的访问。**

读取内部文档时，业务通过文档代理调用 `read()`。代理先检查用户权限，通过后再调用真实文档对象的 `read()`；文档对象负责读取内容，代理负责权限控制。

```python
class Document:
    def __init__(self, content):
        self.content = content

    def read(self):
        return self.content


class DocumentProxy:
    def __init__(self, document, user):
        self.document = document
        self.user = user

    def read(self):
        if not self.user["can_read"]:
            raise PermissionError("没有读取权限")

        return self.document.read()


document = Document("内部文档内容")
user = {"name": "小明", "can_read": True}

# 业务通过代理读取文档
reader = DocumentProxy(document, user)
print(reader.read())  # 内部文档内容
```

**调用过程**

业务调用代理的 `read()` → 代理检查权限 → 有权限则调用真实文档的 `read()` 并返回内容，无权限则抛出权限异常。
