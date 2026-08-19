# DSH Environment Context

[简体中文](README.md)

Real-time time, weather, location, battery, and system-device context for DeepSeek Harness. The plugin contributes a native **Environment Context** settings page and injects one dynamic system-prompt section without creating chat messages or accumulating context nodes.

## Install

Use the standard DSH GitHub plugin form (no version pin — installs the latest from the repository):

```powershell
dsh plugin --profile web add --allow-build=dsh-environment-context github:liqiming-whu/dsh-environment-context --trust-lockfile
```

`--allow-build` permits the Git source package to run its `prepare` build; `--trust-lockfile` skips the lockfile supply-chain verification (versions published less than 24 hours ago trip pnpm's `minimumReleaseAge` gate — drop it if your pnpm does not accept the flag). Restart the existing DSH Web Host, refresh `http://127.0.0.1:3080`, and open **Settings → Environment Context**.

## Features

- Automatic browser-language detection: Chinese language tags normalized to `zh` receive Chinese context; every other locale receives English context. The configured `locale` is only a fallback when the browser language is unavailable.
- Independent toggles for time, time zone, and weekday.
- Open-Meteo, MET Norway, and wttr.in, with explicit Open-Meteo fallback and language-aligned conditions, wind directions, and location requests.
- Manual city or browser Geolocation; no proxy-address or public-IP geolocation.
- Nominatim, BigDataCloud, and Photon reverse geocoding with ordered automatic fallback.
- Address caches keyed by reverse-geocoding provider and language; weather caches keyed by provider, coordinates, and language.
- Failed refreshes reuse only a matching stale cache and mark it stale; battery failures never reuse an old value.
- Independent location, condition, temperature, feels-like, humidity, and wind toggles.
- Browser battery, charging state, Host system name/model/platform, and a custom device name.
- Native settings, conditional fields, live injection preview, status diagnostics, and force-refresh testing.

## Injection and privacy

The plugin uses DSH's official `systemPrompt.section()`. It does not call `agent.inject()` or register dynamic `PromptContext`, so no environment message appears or accumulates in the chat timeline. DSH still records the assembled model-visible system request for replay and audit.

### Bilingual injection examples

When the browser's preferred language canonicalizes to Chinese, such as `zh-CN` or `cmn-CN`:

```text
【现实环境信息】
当前时间：2026年8月19日 17:36:49
时区：Asia/Shanghai
星期：星期三
地点：武汉 / 湖北 / 中国
天气：小毛毛雨
温度：34.4°C（体感：38.7°C）
湿度：52%
风速：8.2 km/h 东北
电量：100%
充电状态：充电中
设备信息：
设备名称：MECHREVO
设备型号：MECHREVO YAOSHI Series
平台：Microsoft Windows 11 家庭版 中文版
```

For every non-Chinese browser language, such as `en-US`, `ja-JP`, or `fr-FR`:

```text
[Current environment]
Local time: Aug 19, 2026, 5:36:49 PM
Time zone: Asia/Shanghai
Weekday: Wednesday
Location: Wuhan / Hubei / China
Weather: Light drizzle
Temperature: 34.4°C (feels like 38.7°C)
Humidity: 52%
Wind: 8.2 km/h NE
Battery: 100%
Charging: yes
Device:
Name: MECHREVO
Model: MECHREVO YAOSHI Series
Platform: Microsoft Windows 11 Home
```

The language follows the latest environment snapshot submitted by the browser. Location, weather condition, and wind direction requests use language-specific cache keys, preventing Chinese and English data from being mixed.

Coordinates are sent only to the selected weather and reverse-geocoding services. Battery and device summaries remain in same-origin Host process memory and disappear on Host restart.

## Development

```powershell
pnpm install
pnpm run check
pnpm pack
```

## License

[MIT](LICENSE)
