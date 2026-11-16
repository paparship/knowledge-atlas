> 设计模式 / 观察者模式

**观察者模式建立对象之间的一对多订阅关系，当被观察对象发生变化时，通知已订阅的观察者，由它们各自作出响应。**

订单支付成功后，需要增加积分并发送消息。积分模块和消息模块提前注册回调函数，订单对象在支付成功时通知它们，具体响应逻辑由各回调负责。

**订阅就是注册回调，通知就是调用已注册的回调。**

`subscribe()` 把回调函数保存到订单对象的观察者列表中；`mark_paid()` 遍历列表，依次调用回调并传入订单 ID。下面的示例在同一个线程中同步执行。

```python
class Order:
    def __init__(self):
        self.observers = []

    def subscribe(self, observer):
        self.observers.append(observer)

    def mark_paid(self, order_id):
        print(f"订单 {order_id} 支付成功")
        for observer in self.observers:
            observer(order_id)


def add_points(order_id):
    print(f"为订单 {order_id} 增加积分")


def send_message(order_id):
    print(f"发送订单 {order_id} 的支付通知")


order = Order()
order.subscribe(add_points)
order.subscribe(send_message)

order.mark_paid("A001")
```

**预期输出**

```text
订单 A001 支付成功
为订单 A001 增加积分
发送订单 A001 的支付通知
```

**新增响应行为时，通过订阅接入，订单的通知流程无需修改。**

例如增加支付后发放优惠券的功能，只需定义 `issue_coupon(order_id)` 并调用 `order.subscribe(issue_coupon)`，无需在 `mark_paid()` 中增加专门的优惠券调用。
