# DSH 环境上下文

为 DeepSeek Harness 注入当前时间、时区、星期、天气、地点、浏览器电量和设备信息，并在 DSH 设置中提供独立面板。

## 注入设计

插件注册一个动态 `systemPrompt.section()`：每次模型请求组装时读取 Host 内存中的最新浏览器快照，并合并 Host 侧缓存的 Open-Meteo 天气。它不会调用 `agent.inject()`、不会创建 `user/message`、不会注册 `PromptContext`，所以不会在聊天时间线中追加或逐轮累积环境消息。浏览器快照只驻留进程内存，插件卸载或 Host 重启即消失。

DSH 强制“模型可见即可从会话日志重建”。因此最终请求的系统提示仍属于请求审计信息；插件不能在不破坏 DSH 可重放与审计约束的情况下把模型可见文本从日志彻底抹除。当前方案是在官方约束下污染最小的方案：**单一系统段、每请求覆盖、无聊天节点、无历史快照累积**。

## 功能

- 当前本地时间、时区、星期（按浏览器时区）
- 手动城市定位与 Open-Meteo 当前天气（免 Key，带缓存和 stale 标记）
- Battery Status API 电量与充电状态（浏览器支持时）
- User-Agent Client Hints / UA 平台和型号
- 设置面板：总开关、字段开关、地点、刷新间隔、输出语言、立即刷新
- 浏览器状态通过同源内存端点发送，不写入设置文件和聊天记录

## 安装

```powershell
dsh plugin --profile web add D:\\DSH_workspace\\dsh-environment-context
```

重启当前 DSH Web Host 并刷新 `http://127.0.0.1:3080`。开发客户端改动需要在 DSH checkout 同时运行 `pnpm run dev:web` 才能由现有 HMR 接收器自动更新；否则重新构建插件并刷新页面。

Git 安装应固定 commit；源码安装需要允许该包的 `prepare` 构建脚本。发布 tarball 已包含 `lib/`，无需用户构建。

## 开发

```bash
pnpm install
pnpm run check
pnpm run build
pnpm pack
```

## 隐私

手动地点会发送给 Open-Meteo Geocoding；坐标和天气由 Host 请求 Open-Meteo。电量与设备摘要只从浏览器发送到同源 DSH Host 内存，不发送到天气服务。远程浏览器受 DSH 设置 RPC 的 loopback 限制，设置面板可能只读。
