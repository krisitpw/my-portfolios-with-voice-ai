import test from 'node:test';
import assert from 'node:assert/strict';
import {Server} from 'node:http';
import {once} from 'node:events';
import WebSocket from 'ws';
import configHandler from '../api/voice/config.js';
import {attachDeepgramProxy} from '../server/deepgram-proxy.mjs';

test('Vercel config uses the shared safe response and rejects unsupported methods',()=>{
  const previous=process.env.DEEPGRAM_API_KEY;
  try{
    for(const key of ['test-server-only-secret','   ']){
      process.env.DEEPGRAM_API_KEY=key;
      const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=JSON.parse(body);}};
      configHandler({url:'/api/voice/config?check=1',method:'GET'},res);
      assert.equal(res.status,200);
      assert.equal(res.headers['Cache-Control'],'no-store');
      assert.equal(res.body.configured,Boolean(key.trim()));
      assert.deepEqual(Object.keys(res.body).sort(),['accent','configured','provider','transport','voice']);
      assert.ok(!JSON.stringify(res.body).includes('test-server-only-secret'));
      for(const method of ['POST','PUT','DELETE','OPTIONS','HEAD']){
        configHandler({url:'/api/voice/config',method},res);
        assert.equal(res.status,405);
        assert.equal(res.headers.Allow,'GET');
      }
    }
  }finally{
    if(previous===undefined)delete process.env.DEEPGRAM_API_KEY;
    else process.env.DEEPGRAM_API_KEY=previous;
  }
});

test('config works over native HTTP without Vercel response helpers',{timeout:5000},async()=>{
  const server=new Server(configHandler);
  try{
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/voice/config`);
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    const body=await response.json();assert.equal(body.provider,'Deepgram');assert.equal(body.transport,'websocket');assert.equal(body.DEEPGRAM_API_KEY,undefined);
  }finally{server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));}
});

test('Vercel agent exports a server with working same-origin WebSocket upgrades',{timeout:5000},async()=>{
  const previous=process.env.DEEPGRAM_API_KEY;
  let server,client;
  try{
    process.env.DEEPGRAM_API_KEY='test-server-only-secret';
    ({default:server}=await import('../api/voice/agent.js'));
    assert.ok(server instanceof Server);
    assert.equal(server.listening,false);
    server.listen(0,'127.0.0.1');
    await once(server,'listening');
    const host=`127.0.0.1:${server.address().port}`;
    const response=await fetch(`http://${host}/api/voice/agent`);
    assert.equal(response.status,426);
    await response.json();
    client=new WebSocket(`ws://${host}/api/voice/agent`,{origin:`http://${host}`});
    await once(client,'open');
    // No Start message: this verifies the route without contacting Deepgram.
    client.close();
    await once(client,'close');
    const rejected=new WebSocket(`ws://${host}/api/voice/agent`,{origin:'https://untrusted.example'});
    const status=await new Promise((resolve,reject)=>{
      rejected.on('unexpected-response',(req,res)=>{res.resume();rejected.terminate();resolve(res.statusCode);});
      rejected.on('error',()=>{});
      rejected.on('open',()=>{rejected.close();reject(Error('Cross-origin upgrade accepted'));});
    });
    assert.equal(status,403);
  }finally{
    client?.terminate();
    if(server?.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    if(previous===undefined)delete process.env.DEEPGRAM_API_KEY;
    else process.env.DEEPGRAM_API_KEY=previous;
  }
});

test('missing credentials reject a real WebSocket handshake with a safe 503',{timeout:5000},async()=>{
  const server=new Server(),bridge=attachDeepgramProxy(server,{env:{},logger:()=>{}});
  try{
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const host=`127.0.0.1:${server.address().port}`;
    const client=new WebSocket(`ws://${host}/api/voice/agent`,{origin:`http://${host}`});
    client.on('error',()=>{});
    const [req,response]=await once(client,'unexpected-response');
    assert.equal(response.statusCode,503);
    const chunks=[];for await(const chunk of response)chunks.push(chunk);
    assert.equal(JSON.parse(Buffer.concat(chunks)).error.code,'MISSING_KEY');
    client.terminate();
  }finally{bridge.dispose();if(server.listening)await new Promise(resolve=>server.close(resolve));}
});
