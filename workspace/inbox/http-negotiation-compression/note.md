> 计算机网络 / HTTP

**内容协商让服务端根据客户端的能力和偏好选择资源的表示形式，压缩则通过减少传输字节数降低传输开销。**

## 内容协商：同一资源，选择适合客户端的表示

同一张图片可以提供 WebP 和 JPEG 两种格式。客户端 A 支持两者，客户端 B 只支持 JPEG，服务端便可以分别返回 WebP 和 JPEG。

客户端在请求中通过 `Accept` 声明可接受的格式，服务端从自己能够提供的表示中选择，并通过响应头 `Content-Type` 说明实际返回的格式；这个选择在一次请求与响应中完成。

## 响应压缩：传输前压缩，接收后还原

HTML、JavaScript、JSON 等文本通常有较多重复内容，压缩能减少传输量。gzip 和 Brotli（`br`）都是无损压缩方式，解压后可以还原原始内容。

浏览器在请求中声明支持的压缩方式：

```http
Accept-Encoding: gzip, br
```

服务端选择 gzip 压缩 JSON 正文后，响应包含：

```http
Content-Type: application/json
Content-Encoding: gzip
Vary: Accept-Encoding
```

- `Content-Type` 说明内容是 JSON，`Content-Encoding` 说明传输时采用 gzip 编码；浏览器自动解压，业务代码照常读取 JSON。
- `Vary: Accept-Encoding` 告诉缓存按请求中的压缩能力区分响应版本。

## 工程上如何使用压缩

**选择压缩方式时，权衡传输大小、压缩耗时和兼容性。**

- gzip 支持广泛，常用于兼容兜底；Brotli 对 Web 文本通常能压得更小，较高压缩级别也会增加压缩耗时。
- 静态文件可以在构建时预压缩：生成 `app.js` 时，同时生成 `app.js.gz` 或 `app.js.br`，部署到服务器；请求到来时，服务器按客户端能力发送对应文件并设置 `Content-Encoding`，复用同一份压缩结果。
- 动态响应随请求生成，通常由服务端、网关或 CDN 实时压缩，需要兼顾 CPU 成本和响应延迟。

## 请求正文也可以压缩

客户端上传较大的 JSON 时，可以先压缩正文，再通过请求头 `Content-Encoding: gzip` 告知服务端；双方需要约定支持这种编码，由服务端解压后解析 JSON。

浏览器通过 `fetch` 提交 JSON 或表单时，通常由前端代码主动完成请求正文压缩。JPEG、ZIP 等已经压缩的数据，再次压缩的收益通常较小。
