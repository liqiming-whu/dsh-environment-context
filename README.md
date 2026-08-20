# DSH 环境上下文

[English](README_EN.md)

为 DeepSeek Harness 提供实时环境上下文：时间、天气、地点、电量和设备信息。插件在 DSH 原生设置面板中注册“环境上下文”页面，并通过动态系统提示段注入当前状态，不创建聊天消息或累积上下文节点。

## 安装

使用 DSH 官方 GitHub 插件安装格式（不指定版本号，默认安装仓库最新版）：

```powershell
dsh plugin --profile web add --allow-build=dsh-environment-context github:liqiming-whu/dsh-environment-context --trust-lockfile
```

`--allow-build` 允许 Git 源码包执行 `prepare` 构建脚本；`--trust-lockfile` 跳过 lockfile 供应链校验（新发布不足 24 小时的版本会触发 pnpm 的 `minimumReleaseAge` 拦截，你的 pnpm 不接受该选项时可去掉）。安装后重启当前 DSH Web Host，刷新 `http://127.0.0.1:3080`，点击左侧底部 **设置** → **环境上下文**。

> [!WARNING]
> **请按需开启：动态环境注入可能降低提示词缓存命中率。** 时间、天气、地点、电量和设备信息会随快照、刷新、浏览器语言或设置变化，导致最终系统提示前缀发生变化；即使对话内容不变，也可能减少模型服务的前缀/提示词缓存复用，增加延迟，并可能影响缓存计费优惠。对稳定性优先的编码、文档和长会话任务，建议保持关闭；推荐仅在确实需要实时环境氛围的 RP（角色扮演）场景中开启。

## 功能

- 自动读取浏览器首选语言：语言字符串以 `zh` 开头（例如 `zh-CN`、`zh-TW`、`zh_CN`）时使用中文，其余语言使用英文；配置 `locale` 仅作为浏览器语言不可用时的回退。
- 设置页标题、字段、选项、提示和状态文案与上述语言规则同步切换。
- 时间、时区、星期分别开关。
- 天气源：Open-Meteo、MET Norway、wttr.in；自动模式严格按 Open-Meteo → MET Norway → wttr.in 顺序容错，手动选择某个提供方时只请求该提供方。
- 天气状况、风向和地点请求与注入语言一致。
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

### 双语注入示例

浏览器首选语言以 `zh` 开头（例如 `zh-CN`、`zh-TW` 或 `zh_CN`）时：

```text
【现实环境信息】
当前时间：2026年8月19日 17:36:49
时区：Asia/Shanghai
星期：星期三
地点：<当前地点>
天气：小毛毛雨
温度：34.4°C（体感：38.7°C）
湿度：52%
风速：8.2 km/h 东北
电量：100%
充电状态：充电中
设备信息：
设备名称：<设备名称>
设备型号：<设备型号>
平台：Microsoft Windows 11
```

浏览器首选语言不是中文（例如 `en-US`、`ja-JP` 或 `fr-FR`）时统一注入英文：

```text
[Current environment]
Local time: Aug 19, 2026, 5:36:49 PM
Time zone: Asia/Shanghai
Weekday: Wednesday
Location: <Current location>
Weather: Light drizzle
Temperature: 34.4°C (feels like 38.7°C)
Humidity: 52%
Wind: 8.2 km/h NE
Battery: 100%
Charging: yes
Device:
Name: <Device name>
Model: <Device model>
Platform: Microsoft Windows 11
```

语言会随浏览器提交的最新环境快照更新。地点、天气状况和风向按语言分别请求并使用独立缓存，避免中英文缓存混用。

## 系统与浏览器接口

- 自动位置：浏览器 Geolocation API，不读取代理地址或公网 IP。
- 电量：浏览器 Battery Status API；失败时明确显示不可用，不复用旧值。
- 设备：DSH Host 使用 Node `os` 与 Windows CIM `Win32_ComputerSystem`、`Win32_OperatingSystem`，不使用 User-Agent。
- 设备采集通过 DSH `ctx.subprocess` 执行；PowerShell 显式使用 UTF-8、清除代理环境变量，并设置输出上限和超时。

## 隐私

手动地点发送给 Open-Meteo Geocoding。自动坐标发送给手动选定的天气/反向地址解析源；启用自动模式时会严格按文档顺序逐个请求，成功后停止。电量与设备摘要仅通过同源接口进入当前 DSH Host 内存，Host 重启即消失，不写入聊天消息。

## 开发与验证

```powershell
pnpm install
pnpm run check
pnpm pack
```

项目包含格式化、客户端注册、天气回退、反向地址解析顺序和构建产物测试。

## 许可证

[MIT](LICENSE)
