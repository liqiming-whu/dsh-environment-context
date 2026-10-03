# DSH Environment Context

[简体中文](README.md)

Real-time time, weather, location, battery, and system-device context for DeepSeek Harness. The plugin contributes a native **Environment Context** settings page and injects one dynamic system-prompt section without creating chat messages or accumulating context nodes.

## Compatibility

Built for **DSH 0.2.0-rc.2**. User settings are volatile fields on the plugin `Config`; the Host reads them through the plugin entry during every prompt assembly, so **a saved setting takes effect on the next model request with no new conversation and no plugin restart**. Installing or updating the plugin itself still requires restarting `dsh web` / the desktop app and hard-refreshing the page. Versions 0.3.x and earlier target the DSH 0.1.x settings interface and do not work on 0.2.

## Install

Use the standard DSH GitHub plugin form (no version pin — installs the latest from the repository):

```powershell
dsh plugin --profile web add --allow-build=dsh-environment-context github:liqiming-whu/dsh-environment-context --trust-lockfile
```

`--allow-build` permits the Git source package to run its `prepare` build; `--trust-lockfile` skips the lockfile supply-chain verification (versions published less than 24 hours ago trip pnpm's `minimumReleaseAge` gate — drop it if your pnpm does not accept the flag). The desktop app uses the profile name `desktop` (`web` for `dsh web`); replace `--profile` to match how you run DSH. Restart DSH, refresh the address `dsh web` prints, and open **Settings → Environment Context**.

> [!WARNING]
> **Enable this plugin selectively: dynamic environment injection can reduce prompt-cache hit rates.** Time, weather, location, battery, and device values change across snapshots, refreshes, browser locales, and settings, changing the final system-prompt prefix even when the conversation itself is unchanged. This can reduce prefix/prompt-cache reuse, add latency, and may affect cache-related pricing benefits depending on the model provider. For stability-first coding, documentation, and long-running sessions, keep it disabled; we recommend enabling it only for RP (role-play) scenarios that genuinely need live environmental atmosphere.

## Features

- Automatic browser-language detection: preferred-language strings beginning with `zh` (including `zh-CN`, `zh-TW`, and `zh_CN`) use Chinese; every other language uses English. The configured `locale` is only a fallback when the browser language is unavailable.
- The settings-page title, fields, options, help text, and status messages follow the same Chinese/English rule.
- Independent toggles for time, time zone, and weekday.
- Open-Meteo, MET Norway, and wttr.in. Auto mode fails over strictly in this order: Open-Meteo → MET Norway → wttr.in; an explicitly selected provider is used alone.
- Language-aligned weather conditions, wind directions, and location requests.
- Manual city or browser Geolocation; no proxy-address or public-IP geolocation.
- Nominatim, BigDataCloud, and Photon reverse geocoding with ordered automatic fallback.
- Address caches keyed by reverse-geocoding provider and language; weather caches keyed by provider, coordinates, and language.
- Failed refreshes reuse only a matching stale cache and mark it stale; battery failures never reuse an old value.
- Independent location, condition, temperature, feels-like, humidity, and wind toggles.
- Browser battery, charging state, Host system name/model/platform, and a custom device name.
- Native settings, conditional fields, live injection preview, status diagnostics, and force-refresh testing.

## Injection and privacy

The plugin uses DSH's official `systemPrompt.section()`. It does not call `agent.inject()` or register dynamic `PromptContext`, so no environment message appears or accumulates in the chat timeline. DSH still records the assembled model-visible system request for replay and audit.

That section is registered with `interpolate: false`: snapshot text (place names, weather wording, a custom device name) is never resolved as a `{{variable}}`, so external data cannot be mistaken for a prompt variable.

### Bilingual injection examples

When the browser's preferred language begins with `zh`, such as `zh-CN`, `zh-TW`, or `zh_CN`:

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

For every non-Chinese browser language, such as `en-US`, `ja-JP`, or `fr-FR`:

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

The language follows the latest environment snapshot submitted by the browser. Location, weather condition, and wind direction requests use language-specific cache keys, preventing Chinese and English data from being mixed.

Coordinates are sent to explicitly selected weather and reverse-geocoding services. In either auto mode, providers are tried one at a time in the documented order and stop after the first success. Battery and device summaries remain in same-origin Host process memory and disappear on Host restart.

## Development

```powershell
pnpm install
pnpm run check
pnpm pack
```

Beyond formatting, client registration, weather failover, reverse-geocoding order, and build-output checks, the tests cover the DSH 0.2 settings migration: they reproduce the Host form projection with `@deepseek-ai/dsh-settings`' own `volatileForm` / `projectForm` / `plainConfig`, decode it the way the browser does, call the real `ctx.settings.update()` against a **real Loader entry** (the production `Entry._commitVolatile` in-place commit, asserted through its `loader/volatile-update` event, with the next assembly rendering the new value while the plugin is applied exactly once; only the profile YAML persistence and root-Include reconcile are stubbed), drive the real `systemPrompt` service, and load the shipped browser bundle through the `ModuleLoader` protocol (asserting it imports nothing but `react`, registers `settings.section`, keeps `interpolate: false`, and never interpolates snapshot text).

## License

[MIT](LICENSE)
