import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,stat,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {createLeadService,validateLead} from '../server/lead-service.mjs';
import {createLeadApi} from '../server/lead-api.mjs';
const lead={name:'Test Client',phone:'+91 98765 43210',email:'client@example.com',message:'A five-page website for my business.',requirement:'wordpress-5',consent:true};
const id='83934e3b-7c30-4ade-8dac-910bbf1761c3';
async function fixture(t,options={}){const dir=await mkdtemp(join(tmpdir(),'portfolio-leads-'));t.after(()=>rm(dir,{recursive:true,force:true}));return {dir,service:createLeadService({...options,env:{LEADS_DATA_DIR:dir,...options.env}})};}
async function request(api,input=lead,options={}){const bytes=Buffer.from(options.raw??JSON.stringify(input));const req=Readable.from(options.chunks||[bytes]);Object.assign(req,{url:'/api/leads',method:options.method||'POST',headers:{host:'portfolio.test',origin:'https://portfolio.test','content-type':'application/json',...options.headers},socket:{remoteAddress:options.ip||'test'}});const res={writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};await api(req,res);return res;}

test('lead validation requires real contact fields, requirements and consent; rejects header injection',()=>{
  assert.equal(validateLead(lead).name,'Test Client');
  for(const change of [{name:'A'},{name:'Test\r\nBcc: bad@example.com'},{email:'bad\r\n@example.com'},{phone:'123'},{message:'short'},{consent:false},{requirement:'unknown'},{email:'x'.repeat(260)+'@example.com'}])assert.throws(()=>validateLead({...lead,...change}));
});
test('lead is stored privately even without delivery settings, and survives service restart',async t=>{
  const {service,dir}=await fixture(t);assert.deepEqual(await service.submit(lead,id),{id});await service.retry();
  const record=JSON.parse(await readFile(join(dir,id+'.json')));assert.equal(record.name,lead.name);assert.equal(record.delivery.email.status,'not_configured');assert.equal(record.delivery.crm.status,'not_configured');assert.equal((await stat(join(dir,id+'.json'))).mode&0o777,0o600);
  const restarted=createLeadService({env:{LEADS_DATA_DIR:dir}});await restarted.submit(lead,id);await restarted.retry();assert.equal((await readdir(dir)).length,1);
});
test('webhook uses exactly the requested five fields and server-only authorization; email uses reply-to',async t=>{
  const calls=[],mails=[];const {service,dir}=await fixture(t,{env:{CRM_WEBHOOK_URL:'https://crm.example.com/lead',CRM_WEBHOOK_TOKEN:'private-crm-token',SMTP_HOST:'smtp.example.com',SMTP_USER:'user',SMTP_PASSWORD:'private-mail-password',LEAD_EMAIL_TO:'owner@example.com',LEAD_EMAIL_FROM:'sender@example.com'},fetcher:async(url,options)=>{calls.push({url,options});return {ok:true};},createTransport:options=>{assert.equal(options.requireTLS,true);return {sendMail:async message=>{mails.push(message);return {accepted:['owner@example.com'],rejected:[]};}};}});
  await service.submit(lead,id);await service.retry();assert.equal(calls.length,1);assert.equal(mails.length,1);assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers.Authorization,'Bearer private-crm-token');assert.equal(calls[0].options.headers['Idempotency-Key'],id);assert.deepEqual(JSON.parse(calls[0].options.body),{name:lead.name,phone:lead.phone,email:lead.email,requirement:'5-page website · WordPress',message:lead.message});assert.equal(mails[0].replyTo.address,lead.email);assert.equal(mails[0].from,'sender@example.com');
  const raw=await readFile(join(dir,id+'.json'),'utf8');assert.ok(!raw.includes('private-crm-token'));assert.ok(!raw.includes('private-mail-password'));assert.equal(JSON.parse(raw).delivery.crm.status,'sent');
});
test('failed CRM delivery is retried without resending a successful email; duplicate submissions keep one record',async t=>{
  let attempts=0,emails=0;const {service,dir}=await fixture(t,{env:{CRM_WEBHOOK_URL:'https://crm.example.com/lead',SMTP_HOST:'smtp.example.com',SMTP_USER:'user',SMTP_PASSWORD:'password',LEAD_EMAIL_TO:'owner@example.com',LEAD_EMAIL_FROM:'sender@example.com'},fetcher:async()=>({ok:++attempts>1}),createTransport:()=>({sendMail:async()=>{emails++;return {accepted:['owner@example.com']};}})});
  await Promise.all([service.submit(lead,id),service.submit(lead,id)]);await service.retry();let record=JSON.parse(await readFile(join(dir,id+'.json')));assert.equal(record.delivery.crm.status,'pending');assert.equal(record.delivery.email.status,'sent');assert.equal(attempts,1);assert.equal(emails,1);
  await service.retry({force:true});assert.equal(attempts,2);assert.equal(emails,1);assert.equal((await readdir(dir)).length,1);await assert.rejects(()=>service.submit({...lead,name:'Someone Else'},id),/already used/);
});
test('HTTP-only webhook is never contacted and saved lead stays pending',async t=>{
  let called=false;const {service,dir}=await fixture(t,{env:{CRM_WEBHOOK_URL:'http://crm.example.com/lead'},fetcher:async()=>{called=true;}});await service.submit(lead,id);await service.retry();assert.equal(called,false);assert.equal(JSON.parse(await readFile(join(dir,id+'.json'))).delivery.crm.status,'pending');
});
test('API rejects cross-origin, missing consent, oversized input, bad JSON and bad submission IDs',async()=>{
  let saved=0;const api=createLeadApi({service:{submit:async()=>{saved++;return {id};}}});
  assert.equal((await request(api,lead,{headers:{origin:'https://attacker.test'}})).status,403);
  assert.equal((await request(api,{...lead,consent:false})).status,400);
  assert.equal((await request(api,lead,{raw:'x'.repeat(17000)})).status,413);
  assert.equal((await request(api,lead,{raw:'{broken'})).status,400);
  assert.equal((await request(api,lead,{headers:{'idempotency-key':'../secrets'}})).status,400);assert.equal(saved,0);
});
test('API accepts Unicode across chunk boundaries and never returns contact data',async()=>{
  let received;const api=createLeadApi({service:{submit:async input=>{received=input;return {id};}}});const input={...lead,name:'कृष्णा Client'};const bytes=Buffer.from(JSON.stringify(input));const result=await request(api,input,{chunks:[bytes.subarray(0,11),bytes.subarray(11,12),bytes.subarray(12)]});assert.equal(result.status,201);assert.equal(received.name,input.name);assert.deepEqual(result.body,{accepted:true,id});assert.ok(!JSON.stringify(result.body).includes(lead.email));
});
test('honeypot quietly discards bots and repeated requests are limited',async()=>{
  let saved=0;const api=createLeadApi({service:{submit:async()=>{saved++;return {id};}}});assert.equal((await request(api,{companyWebsite:'https://spam.test'})).status,201);assert.equal(saved,0);for(let i=0;i<9;i++)await request(api);assert.equal((await request(api)).status,429);assert.equal(saved,9);
});
test('storage failure cannot produce a false successful receipt',async t=>{
  const {dir}=await fixture(t);const file=join(dir,'not-a-directory');await writeFile(file,'test');const service=createLeadService({env:{LEADS_DATA_DIR:file}});const result=await request(createLeadApi({service}));assert.equal(result.status,503);assert.equal(result.body.accepted,undefined);
});
