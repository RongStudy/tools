# Forge Go 启动器

此目录是独立的 Go 1.26 module，仅依赖标准库。前端仍由仓库根目录的 Vite 配置构建，不需要修改页面或路由代码。

## 目录职责

| 目录 | 职责 |
| --- | --- |
| `cmd/forge` | 解析启动参数，监听退出信号，调用服务 |
| `internal/app` | HTTP 监听、启动信息与限时优雅退出 |
| `internal/web` | `/tools/` 路由、静态文件响应与 HTTP 测试 |
| `internal/web/static` | `go:embed` 资源与嵌入完整性检查 |
| `internal/web/static/site` | 自动复制的 Web 构建快照，仅 `.gitkeep` 提交 Git |

## 构建和运行

在仓库根目录执行：

```bash
npm ci
npm run build:go
```

默认输出五种目标到 `dist/bin`：macOS ARM64/x64、Windows ARM64/x64、Linux x64。单目标构建示例：

```bash
npm run build:go -- --target darwin/arm64
./dist/bin/forge-darwin-arm64 -addr 127.0.0.1:8080
```

浏览器打开 `http://127.0.0.1:8080/tools/`，按 Ctrl+C 退出。`-addr` 支持 `host:port`，例如端口 `0` 自动选择空闲端口并打印实际地址。默认使用固定端口，以保持浏览器草稿的访问来源稳定。

分发时只需对应平台的可执行文件。资源通过 `go:embed` 直接读取，不解压到运行目录；运行时不依赖 Node.js、Go 或源码。核心工具可离线使用，远程 Lottie URL 等外部资源仍需网络。草稿保存在浏览器中，更换域名或端口会使用另一份本地存储。

构建脚本 `scripts/build-go.mjs` 先执行现有 `build:web`，再清理并复制 `dist/web` 到 embed 目录，最后以 `CGO_ENABLED=0` 交叉编译。无需在本机安装其他平台的 C 工具链。Go 的静态文件处理复用 Web 构建生成的各工具 `index.html`，缺失文件返回 404，禁止目录列表。

## 验证

在此目录执行：

```bash
gofmt -l .
go vet ./...
go test -race ./...
```

HTTP 单元测试使用内存文件系统，首次构建前也可执行。直接 `go run ./cmd/forge` 前必须执行一次根目录的 `npm run build:go` 来准备资源；前端更新后也应重新执行该命令。

GitHub Actions 并行执行 Web 构建、Chrome 扩展构建和 Go 检查。Pages 部署与 Go 启动器共用 Web 构建产物。Go 检查通过后，五个平台通过矩阵并行编译，分别上传 `forge-darwin-arm64`、`forge-darwin-amd64`、`forge-windows-amd64`、`forge-windows-arm64` 和 `forge-linux-amd64`。每个下载 ZIP 包含对应的可执行文件。产物未经平台签名。
