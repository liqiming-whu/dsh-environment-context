import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { AssembleContext } from '@deepseek-ai/dsh-system-prompt'
import '@deepseek-ai/dsh-system-prompt'; import '@deepseek-ai/dsh-host-webserver'
import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { formatEnvironment, validateSnapshot, type EnvironmentSettings, type EnvironmentSnapshot } from './context.ts'
export { formatEnvironment, sanitizeInline, validateSnapshot } from './context.ts'
export const name='environment-context'; export const inject=['systemPrompt','webServer']; export const SETTINGS_NAMESPACE=settingsNamespace('environment-context')
export type Config=EnvironmentSettings
export const Config:z<Config>=z.object({
 enabled:z.boolean().default(true),locale:z.string().default('zh-CN'),injectTime:z.boolean().default(true),injectTimezone:z.boolean().default(true),injectWeekday:z.boolean().default(true),
 injectWeather:z.boolean().default(true),showLocation:z.boolean().default(true),showCondition:z.boolean().default(true),showTemperature:z.boolean().default(true),showFeelsLike:z.boolean().default(true),showHumidity:z.boolean().default(true),showWind:z.boolean().default(true),
 weatherProvider:z.union(['open-meteo','met-norway','wttr.in']).default('open-meteo'),locationMode:z.union(['manual','auto']).default('manual'),reverseGeocodingProvider:z.union(['auto','nominatim','bigdatacloud','photon']).default('auto'),manualLocation:z.string().default('武汉'),weatherRefreshMinutes:z.number().min(5).max(180).default(30),locationRefreshMinutes:z.number().min(5).max(60).default(10),
 injectBattery:z.boolean().default(true),showCharging:z.boolean().default(true),injectDevice:z.boolean().default(true),showDeviceName:z.boolean().default(true),showDeviceModel:z.boolean().default(true),showDevicePlatform:z.boolean().default(true),customDeviceName:z.string().default(''),
 injectionMode:z.union(['system','in_chat','authors_note']).default('system'),injectionDepth:z.number().min(0).max(100).default(1),authorNoteDepth:z.number().min(0).max(100).default(4),sectionOrder:z.number().default(20)
})
const MAX_BODY=64*1024
async function readJson(req:IncomingMessage){let text='';for await(const chunk of req){text+=chunk.toString();if(text.length>MAX_BODY)throw new Error('payload too large')}return JSON.parse(text||'{}')}
function reply(res:ServerResponse,status:number,body:unknown){res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(body))}
export function apply(ctx:Context,entry:Config){let source=()=>entry;let snapshot:EnvironmentSnapshot|null=null
 installSettingsSection(ctx,SETTINGS_NAMESPACE,Config,entry,{setSource:current=>{source=current},onChange:()=>{}})
 ctx.effect(()=>ctx.webServer.register({kind:'exact',path:'/api/environment-context/snapshot',handler:async(req,res)=>{const config=source();if(req.method==='GET')return reply(res,200,{ok:true,snapshot,prompt:formatEnvironment(snapshot,config),config});if(req.method==='POST')try{const value=validateSnapshot(await readJson(req));if(!value)return reply(res,400,{ok:false,error:'invalid snapshot'});snapshot=value;return reply(res,200,{ok:true,prompt:formatEnvironment(snapshot,config)})}catch(error){return reply(res,400,{ok:false,error:String(error)});}if(req.method==='DELETE'){snapshot=null;return reply(res,200,{ok:true})}return reply(res,405,{ok:false,error:'method not allowed'})}}))
 ctx.effect(()=>ctx.systemPrompt.section({name:'environment-context',order:entry.sectionOrder,text:(_assembly:AssembleContext)=>formatEnvironment(snapshot,source())}))
}
