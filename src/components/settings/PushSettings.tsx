import { useEffect, useState } from "react";
import { Glass, SectionTitle } from "@/components/ui/Glass";

function fromBase64Url(value:string){const s=value.replace(/-/g,"+").replace(/_/g,"/");const bin=atob(s+"=".repeat((4-s.length%4)%4));return Uint8Array.from(bin,(c)=>c.charCodeAt(0));}
function supported(){return typeof window!=="undefined"&&"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;}

export function PushSettings(){
 const [state,setState]=useState<"unsupported"|"off"|"on"|"denied">("unsupported");const [busy,setBusy]=useState(false);const [msg,setMsg]=useState("");
 const sync=async()=>{if(!supported()){setState("unsupported");return;}const perm=Notification.permission;if(perm==="denied"){setState("denied");return;}try{const reg=await navigator.serviceWorker.getRegistration("/service-worker.js");const sub=await reg?.pushManager.getSubscription();setState(sub?"on":"off");}catch{setState("off");}};
 useEffect(()=>{void sync();},[]);
 const enable=async()=>{if(!supported())return;setBusy(true);setMsg("正在开启系统通知…");try{const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();if(permission!=="granted"){setState("denied");setMsg("通知权限未开启，请在系统设置中允许 Fund AI Pro 通知。");return;}const cfg=await fetch("/api/push/config",{cache:"no-store"}).then((r)=>r.ok?r.json():Promise.reject(new Error("push-config-unavailable")));if(!cfg.publicKey)throw new Error("VAPID 公钥未配置");const reg=await navigator.serviceWorker.register("/service-worker.js",{scope:"/"});await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:fromBase64Url(cfg.publicKey)});const saved=await fetch("/api/push/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(sub.toJSON())}).then((r)=>r.ok);if(!saved)throw new Error("push-subscribe-failed");setState("on");setMsg("系统通知已开启。官方净值发布、波动提醒会通过系统通知发送。");}catch(e){setMsg(e instanceof Error?e.message:"系统通知开启失败");}finally{setBusy(false);}};
 const disable=async()=>{setBusy(true);try{const reg=await navigator.serviceWorker.getRegistration("/service-worker.js");const sub=await reg?.pushManager.getSubscription();if(sub){await fetch("/api/push/subscribe",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint:sub.endpoint})});await sub.unsubscribe();}setState("off");setMsg("系统通知已关闭。");}catch{setMsg("关闭通知失败，请稍后再试");}finally{setBusy(false);}};
 const test=async()=>{setBusy(true);setMsg("正在发送测试通知…");try{const r=await fetch("/api/push/test",{method:"POST"});if(!r.ok)throw new Error("test-push-failed");setMsg("测试通知已发送，请检查系统通知栏。");}catch{setMsg("测试通知发送失败，请先开启通知或检查服务器推送配置。");}finally{setBusy(false);}};
 return <Glass><SectionTitle title="系统级通知" hint="后台 Push" />
  {state==="unsupported"?<p className="text-xs leading-relaxed text-muted">当前浏览器不支持系统级 Web Push。请使用支持 PWA/Web Push 的浏览器并安装到主屏幕。</p>:<>
   <p className="text-[10px] leading-relaxed text-muted">通知由服务器后台发送，不依赖页面保持打开。官方净值确认后可推送结果；盘中达到提醒阈值也可推送。不会把 API Key 放进推送配置。</p>
   <div className="mt-3 flex items-center justify-between rounded-2xl bg-bg-elevated px-3 py-2.5"><div><div className="text-xs font-semibold text-fg">{state==="on"?"已开启系统通知":state==="denied"?"通知权限已拒绝":"系统通知未开启"}</div><div className="mt-0.5 text-[9px] text-subtle">{state==="on"?"后台可接收 Fund AI Pro 提醒":"需要浏览器通知权限"}</div></div><div className="flex gap-1.5">{state==="on"?<><button type="button" disabled={busy} onClick={()=>void test()} className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-fg shadow-sm">测试</button><button type="button" disabled={busy} onClick={()=>void disable()} className="rounded-full bg-fg px-3 py-1.5 text-[10px] font-semibold text-bg">关闭</button></>:<button type="button" disabled={busy||state==="denied"} onClick={()=>void enable()} className="rounded-full bg-blue-500 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-50">开启</button>}</div></div>
   {msg?<p className="mt-2 text-[10px] text-muted">{msg}</p>:null}
  </>}
 </Glass>;
}
