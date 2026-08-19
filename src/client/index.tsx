import React, { useEffect, useState, useSyncExternalStore } from 'react'
import type { ClientContext, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import '@deepseek-ai/dsh-client-ui-settings/client'
import { createStatusService } from './weather.js'
import { classifyEnvironmentLanguage, formatEnvironment, type EnvironmentSettings, type EnvironmentSnapshot } from '../context.ts'

const defaults: EnvironmentSettings = {
  enabled: true,
  locale: 'zh-CN',
  injectTime: true,
  injectTimezone: true,
  injectWeekday: true,
  injectWeather: true,
  showLocation: true,
  showCondition: true,
  showTemperature: true,
  showFeelsLike: true,
  showHumidity: true,
  showWind: true,
  weatherProvider: 'auto',
  locationMode: 'manual',
  reverseGeocodingProvider: 'auto',
  manualLocation: '武汉',
  weatherRefreshMinutes: 30,
  locationRefreshMinutes: 10,
  injectBattery: true,
  showCharging: true,
  injectDevice: true,
  showDeviceName: true,
  showDeviceModel: true,
  showDevicePlatform: true,
  customDeviceName: '',
  sectionOrder: 20,
}

const getWeatherStatus = createStatusService()
let browserLocationCache: any = null

function decode(value: unknown) {
  return value && typeof value === 'object' ? { ...defaults, ...value as Partial<EnvironmentSettings> } : undefined
}

function currentLocale(settings?: EnvironmentSettings) {
  return navigator.language || settings?.locale || 'en-US'
}

function isChinese(settings?: EnvironmentSettings) {
  return classifyEnvironmentLanguage(currentLocale(settings)) === 'zh'
}

function localText(zh: boolean, chinese: string, english: string) {
  return zh ? chinese : english
}

function position(options: PositionOptions, zh: boolean) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(localText(zh, '当前浏览器不支持设备定位', 'This browser does not support device geolocation')))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, error => {
      const messages: Record<number, string> = zh
        ? { 1: '浏览器定位权限被拒绝', 2: '浏览器暂时无法获取位置', 3: '浏览器定位超时' }
        : { 1: 'Browser geolocation permission was denied', 2: 'The browser cannot determine the location', 3: 'Browser geolocation timed out' }
      reject(new Error(messages[error.code] || error.message))
    }, options)
  })
}

async function browserLocation(settings: EnvironmentSettings, force: boolean, zh: boolean) {
  const ttl = settings.locationRefreshMinutes * 60_000
  const now = Date.now()
  if (!force && browserLocationCache && now - browserLocationCache.at < ttl) {
    return { ...browserLocationCache.value, cached: true, ageSeconds: Math.round((now - browserLocationCache.at) / 1000) }
  }
  try {
    const result = await position({ enableHighAccuracy: false, timeout: 8_000, maximumAge: force ? 0 : ttl }, zh)
    const at = result.timestamp || Date.now()
    const value = {
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
      accuracy: result.coords.accuracy,
      locationTimestamp: at,
      fetchedAt: new Date(at).toISOString(),
      stale: false,
      cached: false,
    }
    browserLocationCache = { value, at }
    return value
  } catch (error) {
    if (browserLocationCache) {
      return {
        ...browserLocationCache.value,
        cached: true,
        stale: true,
        refreshError: String((error as Error).message),
        ageSeconds: Math.round((now - browserLocationCache.at) / 1000),
      }
    }
    throw error
  }
}

async function battery(zh: boolean) {
  const nav = navigator as any
  if (typeof nav.getBattery !== 'function') {
    throw new Error(localText(zh, '当前浏览器不支持 Battery Status API', 'This browser does not support the Battery Status API'))
  }
  const result = await nav.getBattery()
  return {
    percentage: Math.round(result.level * 100),
    charging: Boolean(result.charging),
    fetchedAt: new Date().toISOString(),
    stale: false,
    cached: false,
  }
}

async function collect(settings: EnvironmentSettings, force = false): Promise<EnvironmentSnapshot> {
  const locale = currentLocale(settings)
  const zh = classifyEnvironmentLanguage(locale) === 'zh'
  const result: any = {
    capturedAt: new Date().toISOString(),
    locale,
    time: { iso: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || '' },
    battery: null,
    device: null,
    location: null,
    weather: null,
    errors: {},
    warnings: {},
    meta: { forceRefresh: force },
  }
  const tasks: Promise<void>[] = []
  if (settings.injectDevice) {
    tasks.push(fetch('/api/environment-context/system', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error(`${localText(zh, '系统环境接口', 'System environment endpoint')} HTTP ${response.status}`)
      const system = await response.json()
      result.device = system.device
      Object.assign(result.errors, system.errors || {})
    }).catch(error => {
      result.errors.device = String(error.message || error)
    }))
  }
  if (settings.injectBattery) {
    tasks.push(battery(zh).then(value => {
      result.battery = value
    }).catch(error => {
      result.errors.battery = String(error.message || error)
    }))
  }
  if (settings.injectWeather) {
    tasks.push((async () => {
      let location: any = null
      if (settings.locationMode === 'auto') {
        try {
          location = await browserLocation(settings, force, zh)
          if (location.stale && location.refreshError) result.warnings.location = location.refreshError
        } catch (error) {
          result.errors.location = String((error as Error).message || error)
          return
        }
      }
      try {
        const query: any = {
          force: force ? '1' : '0',
          weather: '1',
          locale,
          provider: settings.weatherProvider,
          locationMode: settings.locationMode,
          reverseGeocodingProvider: settings.reverseGeocodingProvider,
          locationRefreshMinutes: String(settings.locationRefreshMinutes),
          weatherRefreshMinutes: String(settings.weatherRefreshMinutes),
        }
        if (settings.locationMode === 'manual') query.location = settings.manualLocation
        else Object.assign(query, {
          latitude: String(location.latitude),
          longitude: String(location.longitude),
          accuracy: String(location.accuracy ?? ''),
          locationTimestamp: String(location.locationTimestamp),
        })
        const status = await getWeatherStatus(query)
        result.time = status.time || result.time
        result.location = status.location || location
        result.weather = status.weather
        Object.assign(result.errors, status.errors || {})
        Object.assign(result.warnings, status.warnings || {})
      } catch (error) {
        result.errors.weather = String((error as Error).message || error)
      }
    })())
  }
  await Promise.all(tasks)
  return result
}

async function publish(settings: EnvironmentSettings, force = false) {
  const zh = isChinese(settings)
  if (!settings.enabled) {
    await fetch('/api/environment-context/snapshot', { method: 'DELETE' })
    return { prompt: '', snapshot: null }
  }
  const snapshot = await collect(settings, force)
  const prompt = formatEnvironment(snapshot, settings)
  const response = await fetch('/api/environment-context/snapshot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(snapshot),
  })
  if (!response.ok) throw new Error(`${localText(zh, 'Host 返回', 'Host returned')} HTTP ${response.status}`)
  await response.json()
  return { prompt, snapshot }
}

const box: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  border: '1px solid var(--dsw-alias-border-l2,#ccc)',
  borderRadius: 10,
  padding: 12,
}
const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }

function Section({ scope }: { scope: SettingsScope<EnvironmentSettings> }) {
  const state = useSyncExternalStore(scope.subscribe.bind(scope), scope.getSnapshot.bind(scope))
  const settings = state.value ?? defaults
  const zh = isChinese(settings)
  const t = (chinese: string, english: string) => localText(zh, chinese, english)
  const [preview, setPreview] = useState(t('尚未读取环境状态', 'Environment status has not been loaded'))
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key: keyof EnvironmentSettings, value: unknown) => void scope.set(key, value)
  const toggle = (key: keyof EnvironmentSettings, label: string) => (
    <label style={row}><input type="checkbox" checked={Boolean(settings[key])} disabled={!state.writable} onChange={event => set(key, event.target.checked)} />{label}</label>
  )
  const refresh = async (force = false) => {
    setBusy(true)
    setStatus(force ? t('正在绕过缓存并测试…', 'Testing with caches bypassed…') : t('正在刷新…', 'Refreshing…'))
    try {
      const result = await publish(settings, force)
      setPreview(result.prompt || t('当前未注入任何内容', 'No environment context is currently injected'))
      const errors = Object.values((result.snapshot as any)?.errors || {})
      const warnings = Object.values((result.snapshot as any)?.warnings || {})
      const separator = zh ? '；' : '; '
      setStatus(errors.length
        ? `${t('部分信息不可用', 'Some information is unavailable')}: ${errors.join(separator)}`
        : warnings.length
          ? `${t('已更新', 'Updated')}: ${warnings.join(separator)}`
          : t('环境状态已更新', 'Environment status updated'))
    } catch (error) {
      setStatus(`${t('刷新失败', 'Refresh failed')}: ${String((error as Error).message || error)}`)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refresh(false)
    const id = setInterval(() => void refresh(false), 60_000)
    const focus = () => void refresh(false)
    addEventListener('focus', focus)
    return () => {
      clearInterval(id)
      removeEventListener('focus', focus)
    }
  }, [settings])

  return <section style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 14 }}>
    <h2 style={{ margin: 0 }}>{t('环境上下文', 'Environment Context')}</h2>
    <p>{t('生成前读取环境状态，通过动态系统提示段注入；不会创建聊天消息或累积上下文节点。', 'Reads environment status before generation and injects it through a dynamic system-prompt section without creating chat messages or accumulating context nodes.')}</p>

    <div style={box}>
      <h3>{t('总开关', 'General')}</h3>
      {toggle('enabled', t('启用环境上下文', 'Enable environment context'))}
    </div>

    <div style={box}>
      <h3>{t('时间', 'Time')}</h3>
      {toggle('injectTime', t('注入本地时间', 'Inject local time'))}
      {toggle('injectTimezone', t('注入时区', 'Inject time zone'))}
      {toggle('injectWeekday', t('注入星期', 'Inject weekday'))}
    </div>

    <div style={box}>
      <h3>{t('天气与地点', 'Weather and Location')}</h3>
      {toggle('injectWeather', t('注入天气', 'Inject weather'))}
      <label>{t('天气提供方', 'Weather provider')} <select value={settings.weatherProvider} onChange={event => set('weatherProvider', event.target.value)}>
        <option value="auto">{t('自动（Open-Meteo → MET Norway → wttr.in）', 'Auto (Open-Meteo → MET Norway → wttr.in)')}</option>
        <option value="open-meteo">Open-Meteo</option>
        <option value="met-norway">MET Norway</option>
        <option value="wttr.in">wttr.in</option>
      </select></label>
      <label>{t('地点来源', 'Location source')} <select value={settings.locationMode} onChange={event => set('locationMode', event.target.value)}>
        <option value="manual">{t('手动地点', 'Manual location')}</option>
        <option value="auto">{t('浏览器设备定位', 'Browser device geolocation')}</option>
      </select></label>
      {settings.locationMode === 'manual'
        ? <label>{t('地点', 'Location')} <input value={settings.manualLocation} onChange={event => set('manualLocation', event.target.value)} placeholder={t('例如：武汉；重名时填写宜昌市', 'Example: London; add a region when names are ambiguous')} /></label>
        : <label>{t('反向地址解析', 'Reverse geocoding')} <select value={settings.reverseGeocodingProvider} onChange={event => set('reverseGeocodingProvider', event.target.value)}>
          <option value="auto">{t('自动（Nominatim → BigDataCloud → Photon）', 'Auto (Nominatim → BigDataCloud → Photon)')}</option>
          <option value="nominatim">Nominatim</option>
          <option value="bigdatacloud">BigDataCloud</option>
          <option value="photon">Photon</option>
        </select></label>}
      <div style={row}>
        {toggle('showLocation', t('显示地点', 'Show location'))}
        {toggle('showCondition', t('天气状况', 'Condition'))}
        {toggle('showTemperature', t('温度', 'Temperature'))}
        {toggle('showFeelsLike', t('体感温度', 'Feels-like temperature'))}
        {toggle('showHumidity', t('湿度', 'Humidity'))}
        {toggle('showWind', t('风速', 'Wind'))}
      </div>
      <label>{t('天气刷新间隔（5–180 分钟）', 'Weather refresh interval (5–180 minutes)')} <input type="number" min={5} max={180} value={settings.weatherRefreshMinutes} onChange={event => set('weatherRefreshMinutes', Number(event.target.value))} /></label>
      <label>{t('定位刷新间隔（5–60 分钟）', 'Location refresh interval (5–60 minutes)')} <input type="number" min={5} max={60} value={settings.locationRefreshMinutes} onChange={event => set('locationRefreshMinutes', Number(event.target.value))} /></label>
      <small>{t('自动定位使用浏览器 Geolocation API，不读取代理地址或公网 IP。天气和反向地址解析的自动模式均严格按显示顺序容错。', 'Automatic location uses the browser Geolocation API, never a proxy address or public IP. Automatic weather and reverse-geocoding modes fail over strictly in the displayed order.')}</small>
    </div>

    <div style={box}>
      <h3>{t('电量', 'Battery')}</h3>
      {toggle('injectBattery', t('注入电量', 'Inject battery level'))}
      {toggle('showCharging', t('显示充电状态', 'Show charging state'))}
      <small>{t('每次刷新直接读取 Battery Status API，不缓存旧电量。', 'Every refresh reads the Battery Status API directly; old battery values are not cached.')}</small>
    </div>

    <div style={box}>
      <h3>{t('设备信息', 'Device Information')}</h3>
      {toggle('injectDevice', t('注入设备信息', 'Inject device information'))}
      <label>{t('设备名称', 'Device name')} <input value={settings.customDeviceName} onChange={event => set('customDeviceName', event.target.value)} placeholder={t('留空使用系统设备名称', 'Leave blank to use the system device name')} /></label>
      {toggle('showDeviceName', t('显示设备名称', 'Show device name'))}
      {toggle('showDeviceModel', t('显示设备型号', 'Show device model'))}
      {toggle('showDevicePlatform', t('显示平台', 'Show platform'))}
    </div>

    <div style={box}>
      <h3>{t('动态格式预览', 'Live Injection Preview')}</h3>
      <pre style={{ whiteSpace: 'pre-wrap', padding: 12, background: 'var(--dsw-alias-background-l2,#eee)', borderRadius: 8 }}>{preview}</pre>
      <div>{status}</div>
      <button type="button" disabled={busy} onClick={event => { event.preventDefault(); void refresh(true) }}>
        {busy ? t('正在测试…', 'Testing…') : t('立即测试并强制刷新', 'Test now and force refresh')}
      </button>
    </div>
  </section>
}

export const inject = ['slots', 'settingsScope', 'connection', 'remote']
export function apply(ctx: ClientContext) {
  const scope = ctx.settingsScope.bind<EnvironmentSettings>({ namespace: 'environment-context', decode })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'environment-context',
    order: 35,
    label: () => localText(isChinese(), '环境上下文', 'Environment Context'),
    inject: () => ({ scope }),
  }, Section as any))
}
