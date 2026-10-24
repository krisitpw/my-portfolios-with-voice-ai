import {createLeadService,validateLead} from './lead-service.mjs';
export function createLeadApi({env=process.env,service=createLeadService({env}),now=Date.now}={}){
  const rates=new Map();
  const reply=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  return async function leadApi(req,res,next=()=>reply(res,404,{error:'Not found'})){
    if((req.url||'').split('?')[0]!=='/api/leads')return next();
    if(req.method!=='POST')return reply(res,405,{error:'Use the enquiry form to submit a lead.'});
    let origin;try{origin=new URL(req.headers.origin||'');}catch{return reply(res,403,{error:'Please submit through this website.'});}
    if(!['http:','https:'].includes(origin.protocol)||origin.host!==req.headers.host)return reply(res,403,{error:'Please submit through this website.'});
    if(!/^application\/json\b/i.test(req.headers['content-type']||''))return reply(res,415,{error:'Send the enquiry as JSON.'});
    const ip=req.socket.remoteAddress||'local',time=now();let rate=rates.get(ip);if(!rate||time-rate.start>600000){rate={start:time,count:0};rates.set(ip,rate);}
    if(++rate.count>10)return reply(res,429,{error:'Too many enquiries. Please wait a few minutes or use the contact links.'});
    if(rates.size>5000)for(const [key,value]of rates)if(time-value.start>600000)rates.delete(key);
    try{
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16384)return reply(res,413,{error:'Your enquiry is too large. Keep requirements under 4,000 characters.'});chunks.push(Buffer.from(chunk));}
      let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reply(res,400,{error:'Invalid enquiry. Please try again.'});}
      if(input?.companyWebsite)return reply(res,201,{accepted:true});
      try{validateLead(input);}catch(error){return reply(res,400,{error:error.message});}
      const id=req.headers['idempotency-key'];if(id&&!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id))return reply(res,400,{error:'Invalid submission ID. Refresh and try again.'});
      const result=await service.submit(input,id);return reply(res,201,{accepted:true,id:result.id});
    }catch(error){return reply(res,error.status===409?409:503,{error:error.status===409?error.message:error.code==='LEADS_NOT_CONFIGURED'?'Online enquiries are not configured yet. Please contact Krishna directly by email or phone. Your enquiry has not been saved.':'Your enquiry could not be saved. Please try again or contact Krishna directly.'});}
  };
}
