> 计算机网络 / HTTP

同一页面请求 A、B 两个资源。

- **HTTP/1.0**：通常为每次请求新建 TCP 连接。
- **HTTP/1.1**：默认复用连接，单条连接上的流水线响应按请求顺序返回。
- **HTTP/2**：在一条 TCP 连接上交错传输多个流，但 TCP 丢包留下的字节缺口会阻塞后续字节交付。
- **HTTP/3**：使用 QUIC，按流可靠、有序地交付数据，单个流缺数据时，其他流仍可交付已收到的数据。

手机从 Wi-Fi 切到 4G 时，IP 地址或端口可能变化。QUIC 自己维护连接 ID，用它关联连接状态，所以 IP 或端口变化后，仍可识别原连接并验证新路径，继续传输。

[HTTP/3 规范](https://www.rfc-editor.org/rfc/rfc9114.html#section-1) · [QUIC 连接迁移](https://www.rfc-editor.org/rfc/rfc9000.html#section-9)