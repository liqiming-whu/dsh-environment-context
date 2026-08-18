# DSH 环境上下文

[English](README_EN.md)

严格移植自工作区 `SillyTavern-Environment-Context`：在 DSH 原生设置面板提供“环境上下文”，采集时间、天气、地点、电量和设备信息，通过不会创建聊天消息的动态系统提示段注入。

## 从零安装

```powershell
pnpm install
pnpm run check
pnpm pack
dsh plugin --profile web add .\dsh-environment-context-0.2.0.tgz
```

重启当前 DSH Web Host，刷新 `http://127.0.0.1:3080`，点击左侧底部 **设置** → **环境上下文**。仅克隆源码不会注册设置页。包导出了 `./package.json`，确保 DSH Host 能发现客户端入口。

## 完整功能

- 时间、时区、星期分别开关。
- 天气源：Open-Meteo、MET Norway、wttr.in。
- MET Norway 或 wttr.in 失败时明确警告并回退 Open-Meteo。
- 地点：手动城市或浏览器 Geolocation 自动定位；自动定位缓存默认 10 分钟。
- 反向地址解析：自动、Nominatim、BigDataCloud、Photon；自动模式固定按 Nominatim → BigDataCloud → Photon 容错。
- 地址缓存键包含反向解析供应商，天气缓存键包含天气供应商和坐标，绝不混用。
- 刷新失败只复用同键旧缓存并标记 stale；电量失败不复用旧值。
- 天气状况、地点、温度、体感、湿度、风速均可分别开关。
- 电量、充电状态、设备名称、型号、平台及自定义设备名称。
- 动态注入预览、错误/警告状态、立即测试并强制刷新。
- 自动定位时才展示反向地址解析设置；手动模式只展示城市输入。

## 与 SillyTavern 的唯一不可等价项

SillyTavern 提供 `setExtensionPrompt()` 的系统区、临时聊天深度和作者注释三种位置。DSH 的架构约束是“模型可见即必须可从会话日志重建”：

- `agent.inject()` 和动态 `PromptContext` 会形成持久会话事件，不符合“不污染聊天历史”。
- DSH 没有不落盘的临时聊天深度或作者注释接口。
- 因此插件保留相关配置字段用于配置兼容，但设置页只允许 **系统提示词区域**；实际使用官方 `systemPrompt.section()`。这是 DSH 中唯一同时满足可重放约束和不创建聊天消息的方案，不伪造其他模式。

## 浏览器与桌面端替代接口

- 自动位置：Web Geolocation API。`localhost` 属安全上下文；首次使用会请求授权。桌面壳若禁用定位权限则无法获取，没有可信的 Host 通用替代接口。
- 电量：Battery Status API。Chromium/桌面壳可能不提供，此时明确显示不可用；不会调用平台私有 API 或伪造值。
- 设备：User-Agent Client Hints，回退 User-Agent。Web 标准无法读取用户设置的真实设备名，使用自定义名称或平台通用名称。
- 网络：全部为浏览器 HTTPS/CORS 请求，与原酒馆插件相同，不启动子进程。

## 隐私

手动地点发送给 Open-Meteo Geocoding；自动坐标发送给所选天气源和反向解析源。电量与设备摘要只通过同源接口发送到当前 DSH Host 内存，Host 重启即消失，不写设置文件或聊天消息。
