import {defaultCatalog} from './lib/catalog';

const KEY='atelier-portfolio-data-v1';
const copy=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
const uuid=()=>crypto.randomUUID();
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const day=(d:string,n:number)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
const clock=(n:number)=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const instant=(d:string,t:string)=>new Date(d+'T'+t+':00+05:00').toISOString();
const seed=()=>({catalog:copy(defaultCatalog),bookings:[] as any[],blocks:[] as any[],media:[] as any[],requests:{} as Record<string,any>});
let state=seed();
try { const stored=localStorage.getItem(KEY); if(stored) state=JSON.parse(stored); } catch {}
let auth=true;
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(state));}
  catch{throw Object.assign(new Error('Хранилище браузера заполнено или недоступно. Скачайте резервную копию либо удалите загруженные фото.'),{status:507,code:'STORAGE_FULL'});}
}
const fail=(message:string,code='INVALID_REQUEST',status=400):never=>{throw Object.assign(new Error(message),{code,status});};
const overlaps=(a:number,b:number,c:number,d:number)=>a<d&&b>c;
function slots(serviceId:string,masterId:string,date:string){
  const service=state.catalog.services.find((s:any)=>s.id===serviceId&&s.enabled!==false);
  if(!service) return [];
  const result:any[]=[];
  const weekday=new Date(date+'T12:00:00').getDay();
  for(const m of state.catalog.masters){
    if(masterId!=='any'&&m.id!==masterId)continue;
    if(!m.serviceIds.includes(serviceId))continue;
    const shift=m.schedule.find((s:any)=>s.weekday===weekday);
    if(!shift?.enabled)continue;
    for(let start=minutes(shift.start);start+service.durationMinutes<=minutes(shift.end);start+=15){
      const end=start+service.durationMinutes;
      if(shift.breakStart&&overlaps(start,end,minutes(shift.breakStart),minutes(shift.breakEnd)))continue;
      if(Date.parse(instant(date,clock(start)))<Date.now()+3600000)continue;
      if(state.bookings.some((b:any)=>b.status!=='cancelled'&&b.masterId===m.id&&b.date===date&&overlaps(start,end,minutes(b.time)-15,minutes(b.endTime)+15)))continue;
      if(state.blocks.some((b:any)=>b.masterId===m.id&&b.date===date&&overlaps(start,end,minutes(b.start),minutes(b.end))))continue;
      result.push({id:m.id+'-'+date+'-'+clock(start),masterId:m.id,date,time:clock(start),endTime:clock(end),startAt:instant(date,clock(start)),endAt:instant(date,clock(end))});
    }
  }
  return result.sort((a,b)=>a.time.localeCompare(b.time));
}
function availability(q:URLSearchParams){
  const serviceId=q.get('serviceId')||state.catalog.services[0].id;
  const masterId=q.get('masterId')||'any';
  const date=q.get('date')||today();
  const days=Array.from({length:28},(_,i)=>day(today(),i)).map(d=>({date:d,count:slots(serviceId,masterId,d).length}));
  const picked=q.get('date')?date:(days.find(d=>d.count>0)?.date||date);
  return {timezone:'Asia/Qostanay',today:today(),date:picked,days,slots:slots(serviceId,masterId,picked),masters:state.catalog.masters.map(m=>{const d=days.find(d=>slots(serviceId,m.id,d.date).length);return {id:m.id,nextAvailable:d?{date:d.date,time:slots(serviceId,m.id,d.date)[0].time}:null};}),durationMinutes:state.catalog.services.find(s=>s.id===serviceId)?.durationMinutes||60,generatedAt:new Date().toISOString()};
}
function book(input:any){
  if(String(input.name||'').trim().length<2)fail('Введите имя.');
  if(String(input.phone||'').replace(/\D/g,'').length<10)fail('Проверьте номер телефона.');
  const slot=slots(input.serviceId,input.masterId,input.date).find(s=>s.time===input.time);
  if(!slot)fail('Это время уже занято. Выберите другое.','SLOT_TAKEN',409);
  const service=state.catalog.services.find(s=>s.id===input.serviceId)!;
  const master=state.catalog.masters.find(m=>m.id===input.masterId)!;
  const b={...input,...slot,id:uuid(),reference:'DEMO-'+String(state.bookings.length+1).padStart(4,'0'),token:uuid(),status:'confirmed',serviceName:service.name,masterName:master.name,price:service.price,priceMax:service.priceMax,priceOnRequest:service.priceOnRequest,from:service.from,durationMinutes:service.durationMinutes,lookIds:input.lookIds||[],createdAt:new Date().toISOString()};
  state.bookings.push(b);return b;
}
function request(method:string,path:string,q:URLSearchParams,b:any):any{
  if(path==='/health')return {today:today(),status:'ok',mode:'local-demo'};
  if(path==='/content')return {...state.catalog,services:state.catalog.services.filter(s=>s.enabled!==false),reviews:state.catalog.reviews.filter((r:any)=>!r.status||r.status==='published')};
  if(path==='/availability')return availability(q);
  if(path==='/admin/session'){if(method==='DELETE')auth=false;else if(method==='POST')auth=true;return {authenticated:auth};}
  if(path.startsWith('/admin/')&&!auth)fail('Войдите в демонстрационную панель.','UNAUTHORIZED',401);
  if(path==='/visits'||path==='/bookings'||path==='/admin/bookings/quick'){
    if(method!=='POST')fail('Метод не поддерживается.');
    const key=b.requestKey;
    const signature=JSON.stringify(b);
    if(key&&state.requests[key]){if(state.requests[key].signature!==signature)fail('Состав записи изменился.','IDEMPOTENCY_CONFLICT',409);return state.requests[key].result;}
    const before=copy(state);
    try{
      const items=path==='/visits'?b.items:[b];
      if(!Array.isArray(items)||!items.length||items.length>6)fail('Выберите от одной до шести услуг.');
      const appointments=items.map((item:any)=>book({...b,...item,items:undefined}));
      if(appointments.some((a:any,i:number)=>appointments.some((other:any,j:number)=>i!==j&&overlaps(Date.parse(a.startAt),Date.parse(a.endAt)+15*60000,Date.parse(other.startAt),Date.parse(other.endAt)+15*60000))))fail('Процедуры пересекаются по времени.','VISIT_OVERLAP',409);
      const result=path==='/visits'?{appointments}:appointments[0];
      if(key)state.requests[key]={signature,result};save();return result;
    }catch(e){state=before;throw e;}
  }
  let m=path.match(/^\/bookings\/([^/]+)(\/cancel)?$/);
  if(m){const item=state.bookings.find(b=>b.token===m![1]);if(!item)fail('Запись не найдена.','NOT_FOUND',404);if(m[2]){item.status='cancelled';save();}return item;}
  if(path==='/reviews'&&method==='POST'){const r={...b,id:uuid(),status:'pending',createdAt:new Date().toISOString()};state.catalog.reviews.push(r);save();return r;}
  if(path==='/admin/agenda')return {bookings:state.bookings.filter(b=>b.date===q.get('date')),blocks:state.blocks.filter(b=>b.date===q.get('date'))};
  if(path==='/admin/export')return {...state,exportedAt:new Date().toISOString()};
  if(path.startsWith('/admin/notifications'))return {configured:false,pending:0,message:'В локальной демонстрации внешние уведомления не отправляются.'};
  if(path==='/admin/branding'){state.catalog.branding[b.key]=b.value;save();return {ok:true};}
  m=path.match(/^\/admin\/bookings\/([^/]+)\/cancel$/);
  if(m){const item=state.bookings.find(b=>b.id===m![1]);if(!item)fail('Запись не найдена.');item.status='cancelled';save();return item;}
  m=path.match(/^\/admin\/schedule\/([^/]+)$/);
  if(m){const master=state.catalog.masters.find(v=>v.id===m![1]);if(!master)fail('Специалист не найден.');if(method==='PUT'){master.schedule=b.shifts;save();}return {shifts:master.schedule};}
  m=path.match(/^\/admin\/masters\/([^/]+)$/);
  if(m){const master=state.catalog.masters.find(v=>v.id===m![1]);Object.assign(master,b);save();return master;}
  m=path.match(/^\/admin\/(services|reviews|looks|media|blocks)(?:\/([^/]+))?$/);
  if(m){
    const kind=m[1],id=m[2];
    const list:any[]=kind==='media'?state.media:kind==='blocks'?state.blocks:(state.catalog as any)[kind];
    if(method==='GET')return {[kind]:list};
    if(method==='DELETE'){const index=list.findIndex(v=>v.id===id);if(index<0)fail('Элемент не найден.');list.splice(index,1);save();return {ok:true};}
    if(kind==='media'){if(!String(b.data).startsWith('data:image/'))fail('Ожидается изображение.');const obj={id:uuid(),url:b.data,bytes:b.data.length,createdAt:new Date().toISOString()};list.unshift(obj);save();return obj;}
    const key=id||b.id;
    let obj=key?list.find(v=>v.id===key):null;
    if(obj)Object.assign(obj,b);else{obj={...b,id:uuid()};list.push(obj);}
    if(kind==='services')for(const master of state.catalog.masters){master.serviceIds=master.serviceIds.filter(v=>v!==obj.id);if(!obj.masterIds?.length||obj.masterIds.includes(master.id))master.serviceIds.push(obj.id);}
    save();return obj;
  }
  fail('Этот сценарий недоступен в локальной демонстрации.','NOT_FOUND',404);
}

const originalFetch=window.fetch.bind(window);
window.fetch=async(input:any,init:RequestInit={})=>{
  const raw=typeof input==='string'?input:input.url;
  if(!raw.startsWith('/api/'))return originalFetch(input,init);
  if(init.signal?.aborted)throw new DOMException('Aborted','AbortError');
  const url=new URL(raw,'https://local.demo');
  const before=copy(state);
  try{
    const body=typeof init.body==='string'?JSON.parse(init.body):{};
    return new Response(JSON.stringify(request(init.method||'GET',url.pathname.slice(4),url.searchParams,body)),{status:200,headers:{'Content-Type':'application/json'}});
  }catch(e:any){state=before;return new Response(JSON.stringify({error:e.message,code:e.code||'ERROR'}),{status:e.status||400,headers:{'Content-Type':'application/json'}});}
};
export function reset(){localStorage.removeItem(KEY);for(const k of ['deesse-appointments-v1','deesse-saved','deesse-visit-v1'])localStorage.removeItem(k);location.hash='';location.reload();}
