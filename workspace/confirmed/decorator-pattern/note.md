> 设计模式 / 装饰器模式

**装饰器模式通过具有相同接口的包装对象，为原对象增加功能，并通过逐层包装组合这些功能。**

**附加功能各实现一次，按需求组合，避免为每种组合定义一个子类。**

文件写入可以附加压缩、Base64 编码、日志等功能。若为“压缩写入”“编码写入”“压缩并编码写入”等组合分别定义子类，新增功能时就需要维护更多组合类；装饰器把每种附加功能独立封装，由调用方选择并组合。

## 最小示例

每一层都提供 `write(data)`，处理数据后交给下一层，最里面的 `FileWriter` 负责写文件。

```python
import base64
import gzip


class FileWriter:
    def __init__(self, path):
        self.path = path

    def write(self, data):
        with open(self.path, "wb") as file:
            file.write(data)


class Base64Writer:
    def __init__(self, writer):
        self.writer = writer

    def write(self, data):
        self.writer.write(base64.b64encode(data))


class GzipWriter:
    def __init__(self, writer):
        self.writer = writer

    def write(self, data):
        self.writer.write(gzip.compress(data))


# 只写文件
plain = FileWriter("plain.txt")

# 压缩后写文件
compressed = GzipWriter(FileWriter("compressed.gz"))

# 压缩 → Base64 编码 → 写文件
combined = GzipWriter(Base64Writer(FileWriter("compressed.b64")))
combined.write("需要保存的内容".encode("utf-8"))
```

## 与代理模式的区别

- 代理模式关注对原对象的访问，例如权限代理检查权限后才调用文档的读取方法。
- 装饰器模式关注附加功能的扩展与组合，例如给文件写入叠加压缩和编码。

两者都可以通过包装对象实现；方法执行前后记录日志这类行为，可以根据设计意图用于代理或装饰器。
