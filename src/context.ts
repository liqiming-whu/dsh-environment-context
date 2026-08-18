export interface EnvironmentSnapshot {
  capturedAt: string
  time?: { iso?: string; timeZone?: string }
  location?: { label?: string; latitude?: number; longitude?: number; stale?: boolean; fetchedAt?: string; ageSeconds?: number; [key: string]: unknown } | null
  weather?: { condition?: string; temperature?: number | null; feelsLike?: number | null; humidity?: number | null; windSpeed?: number | null; windDirection?: string; fetchedAt?: string; stale?: boolean; [key: string]: unknown } | null
  battery?: { percentage: number; charging: boolean; fetchedAt?: string; stale?: boolean; [key: string]: unknown } | null
  device?: { name?: string; model?: string; platform?: string; [key: string]: unknown } | null
  errors?: Record<string, string>
  warnings?: Record<string, string>
  meta?: Record<string, unknown>
}

export interface EnvironmentSettings {
  enabled: boolean; locale: string
  injectTime: boolean; injectTimezone: boolean; injectWeekday: boolean
  injectWeather: boolean; showLocation: boolean; showCondition: boolean; showTemperature: boolean; showFeelsLike: boolean; showHumidity: boolean; showWind: boolean
  weatherProvider: 'open-meteo' | 'met-norway' | 'wttr.in'
  locationMode: 'manual' | 'auto'; reverseGeocodingProvider: 'auto' | 'nominatim' | 'bigdatacloud' | 'photon'; manualLocation: string
  weatherRefreshMinutes: number; locationRefreshMinutes: number
  injectBattery: boolean; showCharging: boolean
  injectDevice: boolean; showDeviceName: boolean; showDeviceModel: boolean; showDevicePlatform: boolean; customDeviceName: string
  sectionOrder: number
}

export function sanitizeInline(value: unknown, max = 160): string { return String(value ?? '').replace(/[\u0000-\u001f\u007f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) }
export function validateSnapshot(value: unknown): EnvironmentSnapshot | null { if (!value || typeof value !== 'object') return null; const raw=value as Record<string,unknown>; const capturedAt=sanitizeInline(raw.capturedAt,40); if(!capturedAt||Number.isNaN(Date.parse(capturedAt))) return null; return JSON.parse(JSON.stringify(value)) as EnvironmentSnapshot }
const finite=(v:unknown)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=(v:unknown)=>Number.isInteger(Number(v))?String(Number(v)):Number(v).toFixed(1).replace(/\.0$/,'')
function stale(label:string,value:any){ const at=String(value?.fetchedAt||'').replace('T',' ').replace(/\.\d{3}Z$/,' UTC'); return `${label}使用旧缓存${at?`（采集于 ${at}）`:''}` }

export function formatEnvironment(snapshot: EnvironmentSnapshot | null, s: EnvironmentSettings, now=new Date()): string {
  if(!s.enabled) return ''
  const zh=s.locale.toLowerCase().startsWith('zh'); const lines=[zh?'【现实环境信息】':'[Current environment]']; const zone=sanitizeInline(snapshot?.time?.timeZone||'')
  if(s.injectTime) lines.push(`${zh?'当前时间':'Local time'}：${new Intl.DateTimeFormat(s.locale,{dateStyle:'medium',timeStyle:'medium',timeZone:zone||undefined}).format(now)}`)
  if(s.injectTimezone&&zone) lines.push(`${zh?'时区':'Time zone'}：${zone}`)
  if(s.injectWeekday) lines.push(`${zh?'星期':'Weekday'}：${new Intl.DateTimeFormat(s.locale,{weekday:'long',timeZone:zone||undefined}).format(now)}`)
  if(s.injectWeather){ const w=snapshot?.weather, l=snapshot?.location; if(s.showLocation) lines.push(`${zh?'地点':'Location'}：${sanitizeInline(l?.label||'暂不可用')}`); if(s.showCondition) lines.push(`${zh?'天气':'Weather'}：${sanitizeInline(w?.condition||'暂不可用',80)}`); if(s.showTemperature&&finite(w?.temperature)){let t=`${zh?'温度':'Temperature'}：${num(w!.temperature)}°C`;if(s.showFeelsLike&&finite(w?.feelsLike))t+=`（${zh?'体感':'feels like'}：${num(w!.feelsLike)}°C）`;lines.push(t)} if(s.showHumidity&&finite(w?.humidity))lines.push(`${zh?'湿度':'Humidity'}：${num(w!.humidity)}%`);if(s.showWind&&finite(w?.windSpeed))lines.push(`${zh?'风速':'Wind'}：${num(w!.windSpeed)} km/h${w?.windDirection?` ${sanitizeInline(w.windDirection,24)}`:''}`)}
  if(s.injectBattery){const b=snapshot?.battery;if(b&&finite(b.percentage)){lines.push(`${zh?'电量':'Battery'}：${Math.round(b.percentage)}%`);if(s.showCharging)lines.push(`${zh?'充电状态':'Charging'}：${b.charging?(zh?'充电中':'yes'):(zh?'未充电':'no')}`)}else lines.push(`${zh?'电量':'Battery'}：${zh?'暂不可用':'unavailable'}`)}
  if(s.injectDevice){const d=snapshot?.device,platform=sanitizeInline(d?.platform||'未知平台',40),model=sanitizeInline(d?.model||'浏览器未提供',80),name=sanitizeInline(s.customDeviceName||d?.name||(platform!=='未知平台'?`${platform} 设备`:'浏览器未提供'),80);lines.push(zh?'设备信息：':'Device:');if(s.showDeviceName)lines.push(`${zh?'设备名称':'Name'}：${name}`);if(s.showDeviceModel)lines.push(`${zh?'设备型号':'Model'}：${model}`);if(s.showDevicePlatform)lines.push(`${zh?'平台':'Platform'}：${platform}`)}
  const old:string[]=[];if(s.injectBattery&&snapshot?.battery?.stale)old.push(stale('电量',snapshot.battery));if(s.injectWeather&&snapshot?.location?.stale)old.push(stale('定位',snapshot.location));if(s.injectWeather&&snapshot?.weather?.stale)old.push(stale('天气',snapshot.weather));if(old.length)lines.push(`${zh?'数据状态':'Data status'}：${old.join('；')}`)
  return lines.join('\n')
}
