# DSH 环境上下文

[English](README_EN.md)

严格移植自工作区 `SillyTavern-Environment-Context`：在 DSH 原生设置面板提供“环境上下文”，采集时间、天气、地点、电量和设备信息，通过不会创建聊天消息的动态系统提示段注入。

## 从零安装

```powershell
pnpm install
pnpm run check
pnpm pack
dsh plugin --profile web add .\dsh-environment-context-0.3.2.tgz
```

重启当前 DSH Web Host，刷新 `http://127.0.0.1:3080`，点击左侧底部 **设置** → **环境上下文**。仅克隆源码不会注册设置页。包导出了 `./package.json`，确保 DSH Host 能发现客户端入口。

## 完整功能

- 时间、时区、星期分别开关。
- 天气源：Open-Meteo、MET Norway、wttr.in。
- MET Norway 或 wttr.in 失败时明确警告并回退 Open-Meteo。
- 地点：手动城市或浏览器 Geolocation 自动定位；不使用代理地址或公网 IP。
- 反向地址解析：自动、Nominatim、BigDataCloud、Photon；自动模式固定按 Nominatim → BigDataCloud → Photon 容错。
- 地址缓存键包含反向解析供应商，天气缓存键包含天气供应商和坐标，绝不混用。
- 刷新失败只复用同键旧缓存并标记 stale；电量失败不复用旧值。
- 天气状况、地点、温度、体感、湿度、风速均可分别开关。
- 电量、充电状态、设备名称、型号、平台及自定义设备名称。
- 动态注入预览、错误/警告状态、立即测试并强制刷新。
- 自动定位时才展示反向地址解析设置；手动模式只展示城市输入。

## 注入方式

DSH 中唯一满足“不创建聊天消息”的方案是官方 `systemPrompt.section()`，因此插件不再显示无意义的“注入位置”设置项。`agent.inject()` 和动态 `PromptContext` 都会形成持久会话事件，不符合本插件目标。

## 系统与浏览器接口

- 自动位置：浏览器 Geolocation API；不读取代理地址或公网 IP。
- 电量：浏览器 Battery Status API，与原插件一致；失败不复用旧值。
- 设备：DSH Host 使用 Node `os` 与 Windows CIM `Win32_ComputerSystem` / `Win32_OperatingSystem`，不使用 User-Agent；可获得计算机名、制造商、机型和系统版本。
- 设备采集的 PowerShell 子进程显式清除所有代理环境变量，有限输出、超时并由 DSH subprocess 服务管理进程树。

## 隐私

手动地点发送给 Open-Meteo Geocoding；自动坐标发送给所选天气源和反向解析源。电量与设备摘要只通过同源接口发送到当前 DSH Host 内存，Host 重启即消失，不写设置文件或聊天消息。
