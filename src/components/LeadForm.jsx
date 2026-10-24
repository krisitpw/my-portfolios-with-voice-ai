import React,{useEffect,useRef,useState} from 'react';
import {ArrowUpRight,CheckCircle2,LoaderCircle} from 'lucide-react';
import {enquiryServices,emptyEnquiry} from '../lead-fields';
export default function LeadForm({draft=emptyEnquiry,onDraftChange,onSubmitted,compact=false}) {
  const [status,setStatus]=useState('idle'),[notice,setNotice]=useState(''),[consent,setConsent]=useState(false);
  const request=useRef(null),submissionId=useRef(null),result=useRef(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(()=>{if(status!=='idle')result.current?.focus();},[status]);
  useEffect(()=>{submissionId.current=null;setConsent(false);},[draft]);
  function change(field,value){onDraftChange?.({[field]:value});if(status!=='sending'){setStatus('idle');setNotice('');}}
  async function submit(event){
    event.preventDefault();if(status==='sending')return;
    const form=event.currentTarget,data=new FormData(form);submissionId.current||=crypto.randomUUID();
    request.current=new AbortController();setStatus('sending');setNotice('');
    try{
      const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':submissionId.current},signal:request.current.signal,body:JSON.stringify({...draft,companyWebsite:data.get('companyWebsite'),consent})});
      const body=await response.json();if(!response.ok)throw Error(body.error||'Your enquiry could not be saved. Please try again.');
      setStatus('success');setNotice('Your enquiry is received. Thank you! Krishna will follow up using the contact details you shared.');form.reset();onDraftChange?.({...emptyEnquiry});submissionId.current=null;setConsent(false);onSubmitted?.(body.id);
    }catch(error){if(error.name==='AbortError')return;setStatus('error');setNotice(error.message||'Please try again or use the contact links.');}
  }
  const field=(key,label,type='text',maxLength=100,placeholder='')=><label>{label}<input name={key} type={type} autoComplete={key==='phone'?'tel':key} required minLength={key==='name'?2:key==='phone'?7:undefined} maxLength={maxLength} inputMode={key==='phone'?'tel':undefined} placeholder={placeholder} value={draft[key]} onChange={event=>change(key,event.target.value)}/></label>;
  return <div className={`lead-card ${compact?'lead-card-compact':''}`} id={compact?undefined:'project-enquiry'}><div className="lead-heading"><p className="eyebrow">{compact?'YOUR ENQUIRY':'LET’S BUILD SOMETHING'}</p><h3>{compact?'Check your details.':'Tell me what you have in mind.'}</h3><p>{compact?'The AI fills this as you talk. You can edit anything before sending.':'A few details are all we need to start the conversation.'}</p></div>
    <form className="lead-form" onSubmit={submit}>
      <fieldset disabled={status==='sending'}>
      <div className="lead-form-grid">{field('name','Your name','text',100,'Your full name')}{field('phone','Phone number','tel',25,'+91 98765 43210')}</div>
      {field('email','Email address','email',254,'you@company.com')}
      <label>What can I help with?<select name="requirement" required value={draft.requirement} onChange={event=>change('requirement',event.target.value)}><option value="" disabled>Choose a service</option>{enquiryServices.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Message<textarea name="message" required minLength={10} maxLength={4000} rows={compact?3:4} placeholder="Tell me about your idea, features, timeline, and anything else that matters." value={draft.message} onChange={event=>change('message',event.target.value)}/></label>
      <div className="lead-honeypot" aria-hidden="true"><label>Company website<input name="companyWebsite" tabIndex={-1} autoComplete="off"/></label></div>
      <label className="lead-consent"><input name="consent" type="checkbox" required checked={consent} onChange={event=>setConsent(event.target.checked)}/><span>I agree to share these details with Krishna by email and his CRM so he can contact me about this enquiry.</span></label>
      <button type="submit" className="metal-button lead-submit" disabled={status==='sending'}>{status==='sending'?<><LoaderCircle className="lead-spinner" size={17}/>Sending enquiry…</>:<>Send project enquiry <ArrowUpRight size={17}/></>}</button>
      </fieldset>
      {notice&&<p ref={result} tabIndex={-1} className={`lead-result ${status}`} role={status==='error'?'alert':'status'}>{status==='success'&&<CheckCircle2 size={18}/>}<span>{notice}</span></p>}
      <p className="lead-privacy">Only these details are submitted after you confirm. Your voice recording isn’t attached.</p>
    </form></div>;
}
