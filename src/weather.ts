import type { EnvironmentSnapshot } from './context.ts'

const WMO_ZH: Record<number, string> = { 0: '晴', 1: '大部晴朗', 2: '局部多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '小毛毛雨', 53: '毛毛雨', 55: '浓毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨', 71: '小雪', 73: '中雪', 75: '大雪', 80: '小阵雨', 81: '中阵雨', 82: '强阵雨', 95: '雷暴', 96: '雷暴伴冰雹', 99: '强雷暴伴冰雹' }
const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
const direction = (degrees: number) => directions[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]

async function json(url: URL, signal?: AbortSignal): Promise<any> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`${url.hostname}: HTTP ${response.status}`)
  return response.json()
}

export async function fetchManualWeather(locationName: string, signal?: AbortSignal): Promise<Pick<EnvironmentSnapshot, 'location' | 'weather'>> {
  const geocode = new URL('https://geocoding-api.open-meteo.com/v1/search')
  geocode.search = new URLSearchParams({ name: locationName, count: '1', language: 'zh', format: 'json' }).toString()
  const place = (await json(geocode, signal))?.results?.[0]
  if (!place) throw new Error(`找不到地点“${locationName}”`)
  const forecast = new URL('https://api.open-meteo.com/v1/forecast')
  forecast.search = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m', timezone: 'auto' }).toString()
  const data = await json(forecast, signal)
  const current = data.current
  return {
    location: { label: [place.name, place.admin1, place.country].filter(Boolean).join(' / '), latitude: place.latitude, longitude: place.longitude },
    weather: { condition: WMO_ZH[current.weather_code] ?? `WMO ${current.weather_code}`, temperature: current.temperature_2m, feelsLike: current.apparent_temperature, humidity: current.relative_humidity_2m, windSpeed: current.wind_speed_10m, windDirection: direction(current.wind_direction_10m), fetchedAt: new Date().toISOString(), stale: false },
  }
}
