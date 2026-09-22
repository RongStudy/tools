// Vite ?worker 后缀导入：返回 Worker 构造函数
// Chrome target 用它在扩展包内启动 Monaco 的各语言 Worker
declare module '*?worker' {
  const WorkerFactory: {
    new (): Worker
  }
  export default WorkerFactory
}
