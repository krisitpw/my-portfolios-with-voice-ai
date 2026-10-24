import {mkdir,readFile,readdir,writeFile,rename} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import nodemailer from 'nodemailer';
import {enquiryFields,enquiryFieldError,requirementLabel} from '../src/lead-fields.js';

export function validateLead(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Please complete the enquiry form.');
  const lead={};
  for(const key of enquiryFields){const value=typeof input[key]==='string'?input[key].trim():'';const error=enquiryFieldError(key,value);if(error)throw Error(error);lead[key]=value;}
  if(input.consent!==true)throw Error('Please agree to share your details for this enquiry.');
  return {...lead,consent:true};
}
export function crmLeadPayload(record){return {name:record.name,phone:record.phone,email:record.email,requirement:requirementLabel(record.requirement||record.service||'other'),message:record.message??record.requirements??''};}
export function createLeadService({env=process.env,fetcher=fetch,createTransport=nodemailer.createTransport,now=Date.now}={}){
  const directory=resolve(env.LEADS_DATA_DIR||'data/leads');
  const locks=new Map();let retrying=false,transport;
  const emailConfigured=()=>Boolean(env.SMTP_HOST&&env.SMTP_USER&&env.SMTP_PASSWORD&&env.LEAD_EMAIL_FROM&&env.LEAD_EMAIL_TO);
  function crmURL(){if(!env.CRM_WEBHOOK_URL)return null;const url=new URL(env.CRM_WEBHOOK_URL);if(url.protocol!=='https:'||url.username||url.password)throw Error('CRM webhook must use HTTPS without URL credentials');return url;}
  async function save(record){await mkdir(directory,{recursive:true,mode:0o700});const temp=join(directory,`.${record.id}.${randomUUID()}.tmp`);await writeFile(temp,JSON.stringify(record,null,2),{mode:0o600});await rename(temp,join(directory,`${record.id}.json`));}
  async function load(id){try{const record=JSON.parse(await readFile(join(directory,`${id}.json`),'utf8'));return {...record,requirement:record.requirement||record.service||'other',message:record.message??record.requirements??''};}catch(error){if(error.code==='ENOENT')return null;throw error;}}
  async function locked(id,work){const previous=locks.get(id)||Promise.resolve();const next=previous.catch(()=>{}).then(work);locks.set(id,next);try{return await next;}finally{if(locks.get(id)===next)locks.delete(id);}}
  async function deliver(record,{force=false}={}){
    for(const channel of ['email','crm']){
      const state=record.delivery[channel];if(state.status==='sent'||(!force&&state.nextAttemptAt>now()))continue;
      if(channel==='email'&&!emailConfigured()||channel==='crm'&&!env.CRM_WEBHOOK_URL){state.status='not_configured';await save(record);continue;}
      state.attempts++;state.status='pending';await save(record);
      try{
        if(channel==='email'){
          const port=Number(env.SMTP_PORT)||587,secure=env.SMTP_SECURE==='true'||port===465;
          transport||=createTransport({host:env.SMTP_HOST,port,secure,requireTLS:!secure,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true});
          const info=await transport.sendMail({from:env.LEAD_EMAIL_FROM,to:env.LEAD_EMAIL_TO,replyTo:{name:record.name,address:record.email},messageId:`<lead-${record.id}@portfolio.local>`,subject:`Portfolio enquiry · ${requirementLabel(record.requirement)}`,text:`New project enquiry\n\nName: ${record.name}\nPhone: ${record.phone}\nEmail: ${record.email}\nRequirement: ${requirementLabel(record.requirement)}\n\nMessage:\n${record.message}\n\nLead ID: ${record.id}\nSubmitted: ${record.createdAt}\nConsent: agreed to email and CRM processing.`});
          if(info.rejected?.length||!info.accepted?.length)throw Error('Email not accepted');
        }else{
          const response=await fetcher(crmURL(),{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':record.id,...(env.CRM_WEBHOOK_TOKEN?{Authorization:`Bearer ${env.CRM_WEBHOOK_TOKEN}`}:{})},body:JSON.stringify(crmLeadPayload(record)),redirect:'error',signal:AbortSignal.timeout(12000)});
          const ok=response.ok;await response.body?.cancel();if(!ok)throw Error('CRM delivery failed');
        }
        state.status='sent';state.sentAt=new Date(now()).toISOString();state.nextAttemptAt=0;
      }catch{state.status='pending';state.nextAttemptAt=now()+Math.min(3600000,60000*2**Math.min(state.attempts-1,6));}
      await save(record);
    }
    return record;
  }
  async function submit(input,id=randomUUID()){
    const lead=validateLead(input);
    if(!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id))throw Error('Invalid submission ID. Refresh the page and try again.');
    return locked(id,async()=>{
      let record=await load(id);
      if(record){for(const key of enquiryFields)if(record[key]!==lead[key]){const error=Error('This submission ID was already used. Refresh and try again.');error.status=409;throw error;}}
      else{record={...lead,id,createdAt:new Date(now()).toISOString(),source:'krishna-portfolio',delivery:{email:{status:'pending',attempts:0},crm:{status:'pending',attempts:0}}};await save(record);}
      // The durable record is the receipt. Background delivery never controls acceptance.
      void locked(id,async()=>{const latest=await load(id);if(latest)await deliver(latest);}).catch(()=>console.error('Lead delivery deferred; stored enquiry retained.'));
      return {id:record.id};
    });
  }
  async function retry({force=false}={}){
    if(retrying)return;retrying=true;
    try{await mkdir(directory,{recursive:true,mode:0o700});for(const file of await readdir(directory)){if(!/^[\da-f-]{36}\.json$/i.test(file))continue;const id=file.slice(0,-5);await locked(id,async()=>{const record=await load(id);if(record)await deliver(record,{force});});}}
    finally{retrying=false;}
  }
  function startWorker(){const tick=()=>retry().catch(()=>console.error('Lead outbox could not be processed; check server storage.'));void tick();const timer=setInterval(tick,60000);timer.unref();return()=>{clearInterval(timer);transport?.close?.();};}
  return {submit,retry,startWorker};
}
