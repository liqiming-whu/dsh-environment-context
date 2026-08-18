export interface EnvironmentSnapshot {
  capturedAt: string
  timeZone?: string
  location?: { label: string; latitude?: number; longitude?: number }
  weather?: { condition?: string; temperature?: number; feelsLike?: number; humidity?: number; windSpeed?: number; windDirection?: string; fetchedAt?: string; stale?: boolean }
  battery?: { percentage: number; charging: boolean }
  device?: { name?: string; model?: string; platform?: string }
}

export interface FormatOptions {
  locale: string
  includeTime: boolean
  includeTimezone: boolean
  includeWeekday: boolean
  includeWeather: boolean
  includeBattery: boolean
  includeDevice: boolean
}

export function sanitizeInline(value: unknown, max = 160): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function validateSnapshot(value: unknown): EnvironmentSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const capturedAt = sanitizeInline(raw.capturedAt, 40)
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) return null
  return JSON.parse(JSON.stringify(value)) as EnvironmentSnapshot
}

function number(value: unknown): string {
  const n = Number(value)
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
}

export function formatEnvironment(snapshot: EnvironmentSnapshot | null, options: FormatOptions, now = new Date()): string {
  if (!snapshot) return ''
  const zh = options.locale.toLowerCase().startsWith('zh')
  const lines = [zh ? '【现实环境信息】' : '[Current environment]']
  const zone = sanitizeInline(snapshot.timeZone || '')
  if (options.includeTime) lines.push(`${zh ? '当前时间' : 'Local time'}：${new Intl.DateTimeFormat(options.locale, { dateStyle: 'medium', timeStyle: 'medium', timeZone: zone || undefined }).format(now)}`)
  if (options.includeTimezone && zone) lines.push(`${zh ? '时区' : 'Time zone'}：${zone}`)
  if (options.includeWeekday) lines.push(`${zh ? '星期' : 'Weekday'}：${new Intl.DateTimeFormat(options.locale, { weekday: 'long', timeZone: zone || undefined }).format(now)}`)
  if (options.includeWeather) {
    if (snapshot.location?.label) lines.push(`${zh ? '地点' : 'Location'}：${sanitizeInline(snapshot.location.label)}`)
    const weather = snapshot.weather
    if (weather?.condition) lines.push(`${zh ? '天气' : 'Weather'}：${sanitizeInline(weather.condition, 80)}`)
    if (Number.isFinite(weather?.temperature)) {
      let text = `${zh ? '温度' : 'Temperature'}：${number(weather!.temperature)}°C`
      if (Number.isFinite(weather?.feelsLike)) text += `（${zh ? '体感' : 'feels like'}：${number(weather!.feelsLike)}°C）`
      lines.push(text)
    }
    if (Number.isFinite(weather?.humidity)) lines.push(`${zh ? '湿度' : 'Humidity'}：${number(weather!.humidity)}%`)
    if (Number.isFinite(weather?.windSpeed)) lines.push(`${zh ? '风速' : 'Wind'}：${number(weather!.windSpeed)} km/h ${sanitizeInline(weather?.windDirection, 20)}`.trim())
    if (weather?.stale) lines.push(zh ? '数据状态：天气使用旧缓存' : 'Data status: cached weather (refresh failed)')
  }
  if (options.includeBattery && snapshot.battery) {
    lines.push(`${zh ? '电量' : 'Battery'}：${Math.round(snapshot.battery.percentage)}%`)
    lines.push(`${zh ? '充电状态' : 'Charging'}：${snapshot.battery.charging ? (zh ? '充电中' : 'yes') : (zh ? '未充电' : 'no')}`)
  }
  if (options.includeDevice && snapshot.device) {
    const d = snapshot.device
    lines.push(`${zh ? '设备' : 'Device'}：${[d.name, d.model, d.platform].map(v => sanitizeInline(v, 80)).filter(Boolean).join(' / ')}`)
  }
  return lines.join('\n')
}
