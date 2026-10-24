import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {Server} from 'node:http';
import {once} from 'node:events';
import server from '../api/leads.js';
import {createLeadApi} from '../server/lead-api.mjs';
import {createRemoteLeadService} from '../server/remote-lead-service.mjs';

const id='83934e3b-7c30-4ade-8dac-910bbf1761c3';
const lead={name:'Test Client',phone:'+91 98765 43210',email:'client@example.com',message:'A five-page website for my business.',requirement:'wordpress-5',consent:true};
const env={LEADS_INTAKE_URL:'https://intake.example.test/leads',LEADS_INTAKE_TOKEN:'fake-intake-secret'};
async function request(service,input=lead,headers={}){
  const req=Readable.from([Buffer.from(JSON.stringify(input))]);
  Object.assign(req,{url:'/api/leads',method:'POST',headers:{host:'portfolio.test',origin:'https://portfolio.test','content-type':'application/json','idempotency-key':id,...headers},socket:{remoteAddress:'test'}});
  const res={writeHead(status){this.status=status;},end(body){this.body=JSON.parse(body);}};
  await createLeadApi({service})(req,res);return res;
}
test('Vercel enquiry exports a native server without starting a file outbox',()=>{
  assert.ok(server instanceof Server);assert.equal(server.listening,false);
});
test('native Vercel enquiry server reads JSON and fails safely without durable configuration',{timeout:5000},async()=>{
  const before=process.env.LEADS_INTAKE_URL;
  try{
    delete process.env.LEADS_INTAKE_URL;
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const host=`127.0.0.1:${server.address().port}`;
    const res=await fetch(`http://${host}/api/leads`,{method:'POST',headers:{Origin:`http://${host}`,'Content-Type':'application/json'},body:JSON.stringify(lead)});
    assert.equal(res.status,503);const body=await res.json();assert.match(body.error,/not configured/);assert.equal(body.accepted,undefined);
  }finally{
    server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));
    if(before===undefined)delete process.env.LEADS_INTAKE_URL;else process.env.LEADS_INTAKE_URL=before;
  }
});
test('absent or unsafe durable intake configuration returns 503, never acceptance',async()=>{
  for(const config of [{},{...env,LEADS_INTAKE_TOKEN:''},{...env,LEADS_INTAKE_URL:'http://intake.example.test'},{...env,LEADS_INTAKE_URL:'https://user:password@intake.example.test'}]){
    let called=false;
    const res=await request(createRemoteLeadService({env:config,fetcher:async()=>{called=true;}}));
    assert.equal(res.status,503);assert.match(res.body.error,/not configured/);assert.equal(res.body.accepted,undefined);assert.equal(called,false);
  }
});
test('intake retains consent and origin checks and sends only validated fields',async()=>{
  const calls=[];
  const service=createRemoteLeadService({env,fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({stored:true,id})};}});
  assert.equal((await request(service,{...lead,consent:false})).status,400);
  assert.equal((await request(service,lead,{origin:'https://attacker.test'})).status,403);
  assert.equal(calls.length,0);
  const res=await request(service,{...lead,untrusted:'ignored'});
  assert.equal(res.status,201);assert.deepEqual(res.body,{accepted:true,id});
  const options=calls[0].options;
  assert.equal(options.headers.Authorization,'Bearer fake-intake-secret');assert.equal(options.headers['Idempotency-Key'],id);
  assert.equal(options.redirect,'error');assert.deepEqual(JSON.parse(options.body),{id,...lead,source:'krishna-portfolio'});
  assert.ok(!JSON.stringify(res.body).includes(env.LEADS_INTAKE_TOKEN));
});
test('generic 2xx webhook, mismatched receipt, timeout and backend failures cannot confirm success',async()=>{
  for(const fetcher of [
    async()=>({ok:true,json:async()=>({accepted:true,id})}),
    async()=>({ok:true,json:async()=>({stored:true,id:'wrong'})}),
    async()=>({ok:true,json:async()=>{throw Error('private failure');}}),
    async()=>({ok:false,status:500}),
    async()=>{throw Error('private secret '+env.LEADS_INTAKE_TOKEN);},
  ]){
    const res=await request(createRemoteLeadService({env,fetcher}));assert.equal(res.status,503);assert.equal(res.body.accepted,undefined);assert.ok(!res.body.error.includes('private'));
  }
  const res=await request(createRemoteLeadService({env,fetcher:async()=>({ok:false,status:409})}));assert.equal(res.status,409);
});
