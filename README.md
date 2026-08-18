# DSH 环境上下文

[English](README_EN.md)

为 DeepSeek Harness 提供实时环境上下文：时间、天气、地点、电量和设备信息。插件在 DSH 原生设置面板中注册“环境上下文”页面，并通过动态系统提示段注入当前状态，不创建聊天消息或累积上下文节点。

## 安装

使用 DSH 官方 GitHub 插件安装格式：

```powershell
dsh plugin --profile web add --allow-build=dsh-environment-context github:liqiming-whu/dsh-environment-context#v0.3.2
```

`--allow-build` 允许 Git 源码包执行 `prepare` 构建脚本。安装后重启当前 DSH Web Host，刷新 `http://127.0.0.1:3080`，点击左侧底部 **设置** → **环境上下文**。

## 功能

- 时间、时区、星期分别开关。
- 天气源：Open-Meteo、MET Norway、wttr.in。
- MET Norway 或 wttr.in 失败时明确警告并回退 Open-Meteo。
- 地点：手动城市或浏览器 Geolocation 自动定位；不使用代理地址或公网 IP。
- 反向地址解析：Nominatim、BigDataCloud、Photon；自动模式固定按 Nominatim → BigDataCloud → Photon 容错。
- 地址缓存键包含反向解析供应商，天气缓存键包含天气供应商和坐标，避免跨源混用。
- 刷新失败只复用同键旧缓存并标记 stale；电量失败不复用旧值。
- 地点、天气状况、温度、体感、湿度、风速可分别开关。
- 电量、充电状态、系统设备名称、型号、平台及自定义设备名称。
- 动态注入预览、错误与警告状态、立即测试并强制刷新。
- 自动定位时才显示反向地址解析设置；手动模式只显示城市输入。

## 注入方式

插件使用 DSH 官方 `systemPrompt.section()` 注册单一动态系统提示段。它不会调用 `agent.inject()`，也不使用会形成持久会话事件的动态 `PromptContext`，因此聊天时间线中不会产生环境消息或逐轮累积快照。

DSH 要求模型可见输入可从请求记录重建，因此最终组装后的系统提示仍属于请求审计数据；插件不会绕过该约束。

## 系统与浏览器接口

- 自动位置：浏览器 Geolocation API，不读取代理地址或公网 IP。
- 电量：浏览器 Battery Status API；失败时明确显示不可用，不复用旧值。
- 设备：DSH Host 使用 Node `os` 与 Windows CIM `Win32_ComputerSystem`、`Win32_OperatingSystem`，不使用 User-Agent。
- 设备采集通过 DSH `ctx.subprocess` 执行；PowerShell 显式使用 UTF-8、清除代理环境变量，并设置输出上限和超时。

## 隐私

手动地点发送给 Open-Meteo Geocoding。自动坐标只发送给所选天气源和反向地址解析源。电量与设备摘要仅通过同源接口进入当前 DSH Host 内存，Host 重启即消失，不写入聊天消息。

## 开发与验证

```powershell
pnpm install
pnpm run check
pnpm pack
```

项目包含格式化、客户端注册、天气回退、反向地址解析顺序和构建产物测试。

## 许可证

[MIT](LICENSE)
