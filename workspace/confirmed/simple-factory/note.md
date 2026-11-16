> 设计模式 / 简单工厂

**工厂模式通过专门的创建接口封装对象的创建逻辑，将对象的创建与使用分离。**

后台上传、定时导入、第三方接口都需要读取 CSV 或 Excel 文件；CSV 解析器需要编码、分隔符，Excel 解析器需要工作表、跳过行数等配置。

如果各入口自行创建解析器，就会重复维护类型判断和初始化配置。简单工厂把“选择哪种对象、如何创建它”集中在一处，调用方拿到对象后，按统一接口使用它。

**最小示例**

假设已有 `CsvParser` 和 `ExcelParser`，都提供 `parse(path)`，返回表格数据；下面只展示创建逻辑和业务入口。

```python
class ParserFactory:
    @staticmethod
    def create(kind):
        if kind == "csv":
            return CsvParser(encoding="utf-8-sig", delimiter=",")
        if kind == "excel":
            return ExcelParser(sheet="销售记录", skip_rows=2)
        raise ValueError(f"不支持的类型：{kind}")


# 后台上传：读取后入库
def upload_import(file):
    parser = ParserFactory.create(file.kind)
    save_to_database(parser.parse(file.path))


# 定时导入：读取后生成日报
def scheduled_import(file):
    parser = ParserFactory.create(file.kind)
    generate_daily_report(parser.parse(file.path))
```

**创建方式变化时，只需修改工厂，调用方不用改。**

例如，Excel 解析器换成 `NewExcelParser(schema=load_schema())`，并保持相同的 `parse(path)` 接口，只需修改工厂中的创建代码，各导入入口继续使用原来的业务流程。

## 拓展：工厂方法

**把创建解析器的方法留给子类，客户就能扩展自己的格式，复用 SDK 的导入流程，无需修改 SDK 或等待它发版。**

沿用文件导入场景：现在把导入功能打包成 SDK（供其他项目安装使用的开发工具包），同时提供父类 `ImportJob` 和现成的 `CsvImportJob`、`ExcelImportJob`。父类实现“读取 → 校验 → 入库”，子类实现工厂方法 `create_parser()`，决定创建哪种解析器。

### SDK 提供的代码

沿用上面的解析器，`validate_rows` 和 `save_to_database` 也由 SDK 提供。

```python
from abc import ABC, abstractmethod


class ImportJob(ABC):
    @abstractmethod
    def create_parser(self):
        pass

    def run(self, path):
        parser = self.create_parser()
        rows = parser.parse(path)
        validate_rows(rows)
        save_to_database(rows)


class CsvImportJob(ImportJob):
    def create_parser(self):
        return CsvParser(encoding="utf-8-sig", delimiter=",")


class ExcelImportJob(ImportJob):
    def create_parser(self):
        return ExcelParser(sheet="销售记录", skip_rows=2)
```

### 客户如何使用和扩展

普通文件直接使用 SDK 自带的子类：

```python
from import_sdk import CsvImportJob, ExcelImportJob

CsvImportJob().run("销售记录.csv")
ExcelImportJob().run("销售记录.xlsx")
```

客户有自己的加密 `.abc` 文件时，在自己的项目里增加解析器和导入子类；`decrypt_abc` 是客户已有的解密函数，返回与其他解析器一致的表格数据。

```python
from import_sdk import ImportJob
from company_crypto import decrypt_abc


class AbcParser:
    def __init__(self, key):
        self.key = key

    def parse(self, path):
        with open(path, "rb") as file:
            return decrypt_abc(file.read(), self.key)


class AbcImportJob(ImportJob):
    def __init__(self, key):
        self.key = key

    def create_parser(self):
        return AbcParser(key=self.key)


# company_key 由客户应用提供
AbcImportJob(key=company_key).run("销售记录.abc")
```

执行时，父类的 `run()` 调用客户实现的 `create_parser()`，用 `AbcParser` 读取文件，再继续执行 SDK 的校验和入库；内置子类和客户新增的子类共用同一套导入流程。

## 拓展：抽象工厂

**抽象工厂把一组配套对象的创建封装在同一个工厂中，选择工厂就选择了整套产品。**

前面的工厂只创建解析器这一类对象；界面组件库则同时需要按钮和菜单两类对象，每类又有 Windows、macOS 两套实现。页面选定 Windows 工厂，就获得 Windows 按钮和菜单；换成 Mac 工厂，就整套切换为 macOS 组件。

统一的工厂接口 `UIFactory` 规定每种工厂都必须实现 `create_button()` 和 `create_menu()`；Python 的抽象类机制使漏实现任何一个方法的子类无法实例化。

```python
from abc import ABC, abstractmethod


# 两套配套组件：每套都有按钮和菜单
class WindowsButton:
    def render(self):
        print("显示 Windows 风格按钮")


class WindowsMenu:
    def render(self):
        print("显示 Windows 风格菜单")


class MacButton:
    def render(self):
        print("显示 macOS 风格按钮")


class MacMenu:
    def render(self):
        print("显示 macOS 风格菜单")


# 统一工厂接口：要求每种工厂提供相同的创建入口
class UIFactory(ABC):
    @abstractmethod
    def create_button(self):
        pass

    @abstractmethod
    def create_menu(self):
        pass


class WindowsFactory(UIFactory):
    def create_button(self):
        return WindowsButton()

    def create_menu(self):
        return WindowsMenu()


class MacFactory(UIFactory):
    def create_button(self):
        return MacButton()

    def create_menu(self):
        return MacMenu()


# 页面通过同一个工厂取得整套组件
def show_page(factory):
    button = factory.create_button()
    menu = factory.create_menu()
    button.render()
    menu.render()


show_page(WindowsFactory())  # Windows 按钮 + Windows 菜单
show_page(MacFactory())      # macOS 按钮 + macOS 菜单
```

这里有两类产品（按钮、菜单）和两个产品族（Windows、macOS）：统一接口约定创建入口，具体工厂负责返回同一产品族的组件，页面无需分别判断按钮和菜单使用哪种实现。
