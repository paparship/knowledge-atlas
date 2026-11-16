> 设计模式 / 模板方法模式

**模板方法模式在父类中定义处理流程的固定步骤，将部分步骤交给子类实现，使子类能够定制具体行为而保持整体流程一致。**

生成报表时，流程固定为“读取数据 → 汇总 → 输出”。父类的 `generate()` 组织完整流程，CSV 和 Excel 子类分别实现 `read_data()`，提供不同的读取方式。

```python
from abc import ABC, abstractmethod


class Report(ABC):
    # 模板方法：定义完整流程
    def generate(self):
        amounts = self.read_data()
        total = sum(amounts)
        print(f"销售总额：{total} 元")

    # 留给子类实现的步骤
    @abstractmethod
    def read_data(self):
        pass


class CsvReport(Report):
    def read_data(self):
        print("读取 CSV 文件")
        return [100, 200, 300]  # 模拟读取结果


class ExcelReport(Report):
    def read_data(self):
        print("读取 Excel 文件")
        return [400, 500]  # 模拟读取结果


CsvReport().generate()
ExcelReport().generate()
```

**预期输出**

```text
读取 CSV 文件
销售总额：600 元
读取 Excel 文件
销售总额：900 元
```
