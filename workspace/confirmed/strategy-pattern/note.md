> 设计模式 / 策略模式

**策略模式将一组可替换的算法分别封装，通过统一接口供业务使用，使算法能够独立于使用它的业务代码变化。**

订单结算需要计算应付金额，可以采用原价或九折规则。结算流程把计算交给传入的计价策略，同一个结算实例可以在不同调用中使用不同策略。

```python
class OriginalPrice:
    def calculate(self, amount):
        return amount


class TenPercentOff:
    def calculate(self, amount):
        return amount * 9 // 10


class Checkout:
    def settle(self, amount, strategy):
        return strategy.calculate(amount)


checkout = Checkout()

# 金额单位为分；九折计算舍去不足一分的部分
checkout.settle(20000, OriginalPrice())  # 20000：原价
checkout.settle(20000, TenPercentOff())  # 18000：九折
```

**变化集中在策略，结算流程保持一致。**

新增优惠规则时，增加一个提供 `calculate(amount)` 的策略并传给结算方法，`Checkout` 的计算调用无需修改。策略既可以在创建业务对象时传入，也可以像示例一样，在每次方法调用时传入。

**工厂模式与策略模式关注不同职责。**

- 工厂模式：组织对象的选择与创建，集中管理创建过程的差异。
- 策略模式：组织可替换的业务行为，让业务通过统一接口使用不同算法。

两者可以组合：工厂负责创建计价策略，结算对象负责使用策略计算金额。
