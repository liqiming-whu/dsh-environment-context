export interface EnvironmentSnapshot {
  capturedAt: string
  locale?: string
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
  weatherProvider: 'auto' | 'open-meteo' | 'met-norway' | 'wttr.in'
  locationMode: 'manual' | 'auto'; reverseGeocodingProvider: 'auto' | 'nominatim' | 'bigdatacloud' | 'photon'; manualLocation: string
  weatherRefreshMinutes: number; locationRefreshMinutes: number
  injectBattery: boolean; showCharging: boolean
  injectDevice: boolean; showDeviceName: boolean; showDeviceModel: boolean; showDevicePlatform: boolean; customDeviceName: string
}

export function sanitizeInline(value: unknown, max = 160): string { return String(value ?? '').replace(/[\u0000-\u001f\u007f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) }
export function validateSnapshot(value: unknown): EnvironmentSnapshot | null { if (!value || typeof value !== 'object') return null; const raw=value as Record<string,unknown>; const capturedAt=sanitizeInline(raw.capturedAt,40); if(!capturedAt||Number.isNaN(Date.parse(capturedAt))) return null; return JSON.parse(JSON.stringify(value)) as EnvironmentSnapshot }
const finite=(v:unknown)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))
const num=(v:unknown)=>Number.isInteger(Number(v))?String(Number(v)):Number(v).toFixed(1).replace(/\.0$/,'')
export function classifyEnvironmentLanguage(value:unknown):'zh'|'en'|undefined{
  const candidate=sanitizeInline(value,35).toLowerCase().replace(/_/g,'-');if(!candidate)return undefined
  return candidate.startsWith('zh')?'zh':'en'
}
function promptLocale(snapshotLocale:unknown,fallback:unknown):'zh-CN'|'en-US'{
  for(const value of [snapshotLocale,fallback,'en-US']){const language=classifyEnvironmentLanguage(value);if(language)return language==='zh'?'zh-CN':'en-US'}
  return 'en-US'
}
function stale(label:string,value:any,zh:boolean){const at=String(value?.fetchedAt||'').replace('T',' ').replace(/\.\d{3}Z$/,' UTC');return zh?`${label}使用旧缓存${at?`（采集于 ${at}）`:''}`:`${label} is using stale cache${at?` (captured at ${at})`:''}`}
const field=(zh:boolean,cn:string,en:string,value:string)=>`${zh?cn:en}${zh?'：':': '}${value}`

export function formatEnvironment(snapshot: EnvironmentSnapshot | null, s: EnvironmentSettings, now=new Date()): string {
  if(!s.enabled) return ''
  const locale=promptLocale(snapshot?.locale,s.locale),zh=locale==='zh-CN',unavailable=zh?'暂不可用':'unavailable',zone=sanitizeInline(snapshot?.time?.timeZone||''),lines=[zh?'【现实环境信息】':'[Current environment]']
  if(s.injectTime) lines.push(field(zh,'当前时间','Local time',new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'medium',timeZone:zone||undefined}).format(now)))
  if(s.injectTimezone&&zone) lines.push(field(zh,'时区','Time zone',zone))
  if(s.injectWeekday) lines.push(field(zh,'星期','Weekday',new Intl.DateTimeFormat(locale,{weekday:'long',timeZone:zone||undefined}).format(now)))
  if(s.injectWeather){const w=snapshot?.weather,l=snapshot?.location;if(s.showLocation)lines.push(field(zh,'地点','Location',sanitizeInline(l?.label||unavailable)));if(s.showCondition)lines.push(field(zh,'天气','Weather',sanitizeInline(w?.condition||unavailable,80)));if(s.showTemperature&&finite(w?.temperature)){let t=field(zh,'温度','Temperature',`${num(w!.temperature)}°C`);if(s.showFeelsLike&&finite(w?.feelsLike))t+=zh?`（体感：${num(w!.feelsLike)}°C）`:` (feels like ${num(w!.feelsLike)}°C)`;lines.push(t)}if(s.showHumidity&&finite(w?.humidity))lines.push(field(zh,'湿度','Humidity',`${num(w!.humidity)}%`));if(s.showWind&&finite(w?.windSpeed))lines.push(field(zh,'风速','Wind',`${num(w!.windSpeed)} km/h${w?.windDirection?` ${sanitizeInline(w.windDirection,24)}`:''}`))}
  if(s.injectBattery){const b=snapshot?.battery;if(b&&finite(b.percentage)){lines.push(field(zh,'电量','Battery',`${Math.round(b.percentage)}%`));if(s.showCharging)lines.push(field(zh,'充电状态','Charging',b.charging?(zh?'充电中':'yes'):(zh?'未充电':'no')))}else lines.push(field(zh,'电量','Battery',unavailable))}
  if(s.injectDevice){const d=snapshot?.device,unknownPlatform=zh?'未知平台':'unknown platform',missing=zh?'浏览器未提供':'unavailable',platform=sanitizeInline(d?.platform||unknownPlatform,80),model=sanitizeInline(d?.model||missing,80),name=sanitizeInline(s.customDeviceName||d?.name||(platform!==unknownPlatform?(zh?`${platform} 设备`:`${platform} device`):missing),80);lines.push(zh?'设备信息：':'Device:');if(s.showDeviceName)lines.push(field(zh,'设备名称','Name',name));if(s.showDeviceModel)lines.push(field(zh,'设备型号','Model',model));if(s.showDevicePlatform)lines.push(field(zh,'平台','Platform',platform))}
  const old:string[]=[];if(s.injectBattery&&snapshot?.battery?.stale)old.push(stale(zh?'电量':'Battery',snapshot.battery,zh));if(s.injectWeather&&snapshot?.location?.stale)old.push(stale(zh?'定位':'Location',snapshot.location,zh));if(s.injectWeather&&snapshot?.weather?.stale)old.push(stale(zh?'天气':'Weather',snapshot.weather,zh));if(old.length)lines.push(field(zh,'数据状态','Data status',old.join(zh?'；':'; ')))
  return lines.join('\n')
}
