import {randomUUID} from 'node:crypto';
import {validateLead} from './lead-service.mjs';

// Serverless acceptance requires an explicitly configured durable intake service.
// A generic successful webhook/SMTP send is not proof of durable storage.
export function createRemoteLeadService({env=process.env,fetcher=fetch}={}){
  return {async submit(input,id=randomUUID()){
    const lead=validateLead(input);
    if(!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id))throw Error('Invalid submission ID');
    let url;
    try{
      url=new URL(env.LEADS_INTAKE_URL);
      if(url.protocol!=='https:'||url.username||url.password||url.hash||!env.LEADS_INTAKE_TOKEN?.trim())throw Error();
    }catch{
      const error=Error('Durable intake not configured');error.code='LEADS_NOT_CONFIGURED';throw error;
    }
    const response=await fetcher(url,{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),
      headers:{'Content-Type':'application/json','Idempotency-Key':id,Authorization:`Bearer ${env.LEADS_INTAKE_TOKEN.trim()}`},
      body:JSON.stringify({id,...lead,source:'krishna-portfolio'}),
    });
    if(!response.ok){
      await response.body?.cancel();
      const error=Error(response.status===409?'This submission ID was already used. Refresh and try again.':'Durable intake failed');
      if(response.status===409)error.status=409;
      throw error;
    }
    // The receiver must commit the record and durable delivery work before
    // acknowledging it. It must deduplicate the supplied ID across retries.
    const receipt=await response.json();
    if(receipt?.stored!==true||receipt.id!==id)throw Error('No durable receipt');
    return {id};
  }};
}
