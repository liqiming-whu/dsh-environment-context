import assert from 'node:assert/strict'
import { createStatusService } from '../src/client/weather.js'

const autoCalls=[]
const autoWeather=createStatusService({requestJson:async url=>{
  autoCalls.push(url.hostname)
  if(url.hostname==='geocoding-api.open-meteo.com')return{results:[{name:'武汉',admin1:'湖北',country:'中国',latitude:30.59,longitude:114.3,timezone:'Asia/Shanghai'}]}
  if(url.hostname==='api.open-meteo.com')throw new Error('Open-Meteo offline')
  if(url.hostname==='api.met.no')throw new Error('MET Norway offline')
  if(url.hostname==='wttr.in')return{current_condition:[{weatherCode:'116',temp_C:'30',FeelsLikeC:'35',humidity:'80',windspeedKmph:'8',winddir16Point:'NE',weatherDesc:[{value:'Partly cloudy'}],'lang_zh-cn':[{value:'局部多云'}]}]}
  throw new Error(`unexpected ${url}`)
}})
const automatic=await autoWeather({weather:'1',locale:'zh-CN',provider:'auto',locationMode:'manual',location:'武汉',force:'1'})
assert.equal(automatic.weather.source,'wttr.in')
assert.equal(automatic.weather.condition,'局部多云')
assert.equal(automatic.weather.weatherFallbackErrors.length,2)
assert.ok(automatic.warnings.weather.includes('已使用 wttr.in'))
assert.deepEqual(autoCalls,['geocoding-api.open-meteo.com','api.open-meteo.com','api.met.no','wttr.in'])

const explicitCalls=[]
const explicit=createStatusService({requestJson:async url=>{
  explicitCalls.push(url.hostname)
  if(url.hostname==='geocoding-api.open-meteo.com')return{results:[{name:'Wuhan',admin1:'Hubei',country:'China',latitude:30.59,longitude:114.3,timezone:'Asia/Shanghai'}]}
  if(url.hostname==='api.met.no')throw new Error('MET only failure')
  if(url.hostname==='api.open-meteo.com')throw new Error('must not be called')
  throw new Error(`unexpected ${url}`)
}})
const explicitFailure=await explicit({weather:'1',locale:'en-US',provider:'met-norway',locationMode:'manual',location:'Wuhan',force:'1'})
assert.equal(explicitFailure.weather,null)
assert.ok(explicitFailure.errors.weather.includes('MET only failure'))
assert.deepEqual(explicitCalls,['geocoding-api.open-meteo.com','api.met.no'])

const english=createStatusService({requestJson:async url=>{
  if(url.hostname==='geocoding-api.open-meteo.com'){
    assert.equal(url.searchParams.get('language'),'en')
    return{results:[{name:'Wuhan',admin1:'Hubei',country:'China',latitude:30.59,longitude:114.3,timezone:'Asia/Shanghai'}]}
  }
  if(url.hostname==='api.open-meteo.com')return{timezone:'Asia/Shanghai',current:{weather_code:51,temperature_2m:30,apparent_temperature:35,relative_humidity_2m:80,wind_speed_10m:8,wind_direction_10m:45}}
  throw new Error(`unexpected ${url}`)
}})
const englishStatus=await english({weather:'1',locale:'en-US',provider:'open-meteo',locationMode:'manual',location:'Wuhan',force:'1'})
assert.equal(englishStatus.location.label,'Wuhan / Hubei / China')
assert.equal(englishStatus.weather.condition,'Light drizzle')
assert.equal(englishStatus.weather.windDirection,'NE')

const localizedCalls=[]
const localized=createStatusService({requestJson:async url=>{
  localizedCalls.push(`${url.hostname}:${url.searchParams.get('language')||'-'}`)
  if(url.hostname==='geocoding-api.open-meteo.com'){
    const zh=url.searchParams.get('language')==='zh'
    return{results:[{name:zh?'武汉':'Wuhan',admin1:zh?'湖北':'Hubei',country:zh?'中国':'China',latitude:30.59,longitude:114.3,timezone:'Asia/Shanghai'}]}
  }
  if(url.hostname==='api.open-meteo.com')return{timezone:'Asia/Shanghai',current:{weather_code:2,temperature_2m:30,apparent_temperature:35,relative_humidity_2m:80,wind_speed_10m:8,wind_direction_10m:45}}
  throw new Error(`unexpected ${url}`)
}})
const localizedZh=await localized({weather:'1',locale:'zh_CN',provider:'open-meteo',locationMode:'manual',location:'Wuhan'})
const localizedEn=await localized({weather:'1',locale:'cmn-CN',provider:'open-meteo',locationMode:'manual',location:'Wuhan'})
const localizedZhCached=await localized({weather:'1',locale:'zh-TW',provider:'open-meteo',locationMode:'manual',location:'Wuhan'})
assert.equal(localizedZh.location.label,'武汉 / 湖北 / 中国')
assert.equal(localizedZh.weather.condition,'局部多云')
assert.equal(localizedEn.location.label,'Wuhan / Hubei / China')
assert.equal(localizedEn.weather.condition,'Partly cloudy')
assert.equal(localizedZhCached.weather.cached,true)
assert.deepEqual(localizedCalls,['geocoding-api.open-meteo.com:zh','api.open-meteo.com:-','geocoding-api.open-meteo.com:en','api.open-meteo.com:-'])

const providerCalls=[]
const providerSwitch=createStatusService({requestJson:async url=>{
  providerCalls.push(url.hostname)
  if(url.hostname==='geocoding-api.open-meteo.com')return{results:[{name:'Wuhan',admin1:'Hubei',country:'China',latitude:30.59,longitude:114.3,timezone:'Asia/Shanghai'}]}
  if(url.hostname==='api.open-meteo.com')return{timezone:'Asia/Shanghai',current:{weather_code:0,temperature_2m:30,apparent_temperature:35,relative_humidity_2m:80,wind_speed_10m:8,wind_direction_10m:0}}
  if(url.hostname==='api.met.no')return{properties:{timeseries:[{data:{instant:{details:{air_temperature:29,relative_humidity:70,wind_speed:2,wind_from_direction:90}},next_1_hours:{summary:{symbol_code:'clearsky_day'}}}}]}}
  throw new Error(`unexpected ${url}`)
}})
const fromOpen=await providerSwitch({weather:'1',locale:'en-US',provider:'open-meteo',locationMode:'manual',location:'Wuhan'})
const fromMet=await providerSwitch({weather:'1',locale:'en-US',provider:'met-norway',locationMode:'manual',location:'Wuhan'})
assert.equal(fromOpen.weather.source,'Open-Meteo')
assert.equal(fromMet.weather.source,'MET Norway')
assert.deepEqual(providerCalls,['geocoding-api.open-meteo.com','api.open-meteo.com','api.met.no'])

const reverse=[]
const autoAddress=createStatusService({requestJson:async url=>{
  if(url.hostname==='nominatim.openstreetmap.org'){reverse.push('nominatim');throw new Error('offline')}
  if(url.hostname==='api.bigdatacloud.net'){reverse.push('bigdatacloud');throw new Error('offline')}
  if(url.hostname==='photon.komoot.io'){reverse.push('photon');return{features:[{properties:{city:'Yichang',state:'Hubei',country:'China'}}]}}
  if(url.hostname==='api.open-meteo.com')return{timezone:'Asia/Shanghai',current:{weather_code:0,temperature_2m:30,apparent_temperature:35,relative_humidity_2m:80,wind_speed_10m:8,wind_direction_10m:0}}
  throw new Error(`unexpected ${url}`)
}})
const status=await autoAddress({weather:'1',locale:'en-US',provider:'open-meteo',locationMode:'auto',reverseGeocodingProvider:'auto',latitude:'30.66',longitude:'111.43',force:'1'})
assert.deepEqual(reverse,['nominatim','bigdatacloud','photon'])
assert.equal(status.location.addressProvider,'photon')
console.log('weather auto-fallback, localization, and cache-isolation tests passed')
