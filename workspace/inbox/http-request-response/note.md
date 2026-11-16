> 计算机网络 / HTTP

**HTTP 通过请求与响应完成交互：客户端指定访问目标和操作，服务端返回处理状态与内容。**

## 一次请求与响应

客户端获取编号为 123 的订单，下面展示 HTTP/1.1 报文。

**请求**

```http
GET /orders/123 HTTP/1.1
Host: api.example.com
Accept: application/json

```

- 第一行包含请求方法 `GET`、资源路径 `/orders/123` 和协议版本；加上主机名，可以确定访问目标。
- 请求头 `Accept` 表示希望接收 JSON；头部之后用空行分隔正文，这次请求没有正文。

**响应**

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 26

{"id":123,"status":"paid"}
```

- 第一行表示协议版本和处理结果，`200 OK` 表示请求成功；状态码大类包括 `2xx` 成功、`3xx` 重定向或缓存协商、`4xx` 客户端请求相关错误、`5xx` 服务端错误。
- 响应头说明正文格式为 JSON、长度为 26 字节；空行后是订单数据。

请求也可以携带正文，例如创建订单时通过 `POST /orders` 提交 JSON；查询参数则常用于筛选、分页，例如 `GET /orders?page=2`。

## RESTful 与 URL

**RESTful 是按 REST 架构风格设计接口的方式；常见的 HTTP API 用 URL 标识资源，用 HTTP 方法表达操作，并遵循无状态、统一接口等约束。**

- `GET /orders/123`：获取编号为 123 的订单。
- `DELETE /orders/123`：删除该订单。
- `POST /orders`：向订单集合提交新订单。

这样不必分别设计 `/getOrder`、`/deleteOrder` 等操作名称；资源地址与操作语义保持一致，接口更容易理解和组织。遵循 HTTP 方法语义，也便于客户端和缓存按统一规则处理请求，例如复用符合缓存条件的 GET 响应。
