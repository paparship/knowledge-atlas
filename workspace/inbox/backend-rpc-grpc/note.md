> 后端开发 / 服务间通信

**RPC（远程过程调用）是一种将另一进程或服务中的功能表达为方法调用的通信方式，由通信机制传递参数并返回执行结果。**

**gRPC 是实现 RPC 的开发框架，提供运行时库及配套代码生成工具；通常使用 Protocol Buffers 定义接口和消息，通过 HTTP/2 传输。**

## 起点：两个已有仓库

电商项目有两个后端仓库：Java 订单服务负责下单，Go 库存服务负责库存管理。现在要让订单服务在下单时调用库存服务的 `Reserve` 方法，为订单预留商品数量。

## ① 写一份双方共用的接口定义

创建 `inventory.proto`，约定方法、请求参数和返回值，两个仓库使用同一版本：

```protobuf
syntax = "proto3";

package inventory;

service Inventory {
  rpc Reserve(ReserveRequest) returns (ReserveResponse);
}

message ReserveRequest {
  string order_id = 1;
  string product_id = 2;
  int32 quantity = 3;
}

message ReserveResponse {
  bool success = 1;
  string reason = 2;
}
```

## ② 两个仓库分别生成本语言的代码

各仓库安装对应语言的 gRPC、Protobuf 依赖，并在构建中配置代码生成。生成工具是 Protobuf 编译器 `protoc` 和对应语言的 gRPC 插件，它们读取同一份 `.proto`，输出各自语言的代码。

| 仓库 | 生成后用到的代码 | 用途 |
| --- | --- | --- |
| Go 库存服务 | 请求与响应类型、服务端接口、注册代码 | 实现并对外提供 Reserve 方法 |
| Java 订单服务 | 请求与响应类型、客户端 Stub | 构造请求，调用远端 Reserve 方法 |

Stub 是生成的客户端调用入口，它把本地的方法调用转换为 gRPC 请求。

## ③ Go 仓库：实现方法并启动服务

库存服务编写满足生成接口的实现，在 `Reserve` 中检查并预留库存，返回 `ReserveResponse`；然后创建 gRPC 服务器、注册这个实现，监听例如 `50051` 端口。

生成代码处理通信接入，库存团队编写实际的库存业务逻辑。

## ④ Java 仓库：连接地址并调用方法

订单服务配置库存服务地址，例如 `inventory-service:50051`，创建连接通道和客户端 Stub；下单时构造请求并调用它。

下面展示调用位置，`stub` 是已创建的客户端：

```java
ReserveRequest request = ReserveRequest.newBuilder()
    .setOrderId("order-123")
    .setProductId("product-456")
    .setQuantity(2)
    .build();

ReserveResponse response = stub.reserve(request);
```

## ⑤ 运行后的执行过程

```text
用户下单
  → Java 订单代码调用 stub.reserve(request)
  → gRPC 将参数编码，通过网络发送
  → Go 服务端 gRPC 解码并调用库存团队实现的 Reserve
  → 库存代码处理后返回结果
  → gRPC 将结果传回并解码为 Java 的 ReserveResponse
```
