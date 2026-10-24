import {createServer} from 'node:http';
import {existsSync,createReadStream,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createVoiceApi} from './voice-api.mjs';
import {attachDeepgramProxy} from './deepgram-proxy.mjs';
import {createLeadApi} from './lead-api.mjs';
import {createLeadService} from './lead-service.mjs';
if(existsSync('.env'))process.loadEnvFile('.env');
const root=resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.m4a':'audio/mp4','.json':'application/json'};
const api=createVoiceApi();
const leads=createLeadService(),leadApi=createLeadApi({service:leads});
const server=createServer((req,res)=>leadApi(req,res,()=>api(req,res,()=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
 let file=resolve(root,`.${name}`);
 if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
 if(!existsSync(file)||!statSync(file).isFile())file=resolve(root,'index.html');
 if(!existsSync(file)){res.writeHead(503);return res.end('Run npm run build first.');}
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});
 if(req.method==='HEAD')return res.end();createReadStream(file).pipe(res);
})));
attachDeepgramProxy(server);
const stopLeads=leads.startWorker();server.on('close',stopLeads);
server.listen(Number(process.env.PORT)||3000,process.env.HOST||'127.0.0.1',()=>console.log(`Portfolio server: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||3000}`));
