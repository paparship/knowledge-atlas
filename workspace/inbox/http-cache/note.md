> 计算机网络 / HTTP

**HTTP 缓存通过保存并复用响应，减少重复传输；服务端通过响应头规定缓存的新鲜期，并提供用于验证内容是否变化的标识。**

## 第一次请求：保存内容与缓存信息

浏览器获取配置文件：

```http
GET /config.json HTTP/1.1
Host: example.com

```

服务器返回：

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 17
Cache-Control: max-age=3600
ETag: "v1"

{"theme":"light"}
```

浏览器保存正文以及这些缓存信息：

- `Cache-Control: max-age=3600`：响应的新鲜期为 3600 秒，即一小时；缓存仍新鲜时，再次需要该资源通常可以直接复用，省去网络请求。
- `ETag: "v1"`：服务器为这份资源的版本提供的标识，由浏览器保存，用于后续验证；示例用 `"v1"` 表示一个版本。

## 缓存过期：通过条件请求验证版本

缓存过期后，浏览器再次需要该资源时，带上之前保存的标识：

```http
GET /config.json HTTP/1.1
Host: example.com
If-None-Match: "v1"

```

**`If-None-Match` 表示：如果当前资源的版本标识与请求提供的标识不匹配，就返回资源内容。**

### 内容未变：复用原正文

当前版本仍为 `"v1"`，服务器返回：

```http
HTTP/1.1 304 Not Modified
Cache-Control: max-age=3600
ETag: "v1"

```

`304` 响应省去正文传输，浏览器使用已有正文，并根据响应中的缓存信息更新缓存。

### 内容已变：接收新正文

当前版本变为 `"v2"`，服务器返回：

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 16
Cache-Control: max-age=3600
ETag: "v2"

{"theme":"dark"}
```

浏览器用新正文、版本标识和缓存规则替换原有缓存。
