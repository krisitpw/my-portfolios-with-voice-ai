import React,{useEffect,useRef,useState} from 'react';
import {Mic,MicOff,X,Send,Volume2,Square,RotateCcw,ArrowUpRight,Headphones} from 'lucide-react';
import {useVoiceAssistant} from '../useVoiceAssistant';
import avatar from '../assets/krishna-avatar-clean.jpg';
import VideoAvatar from './VideoAvatar';
import LeadForm from './LeadForm';
import {missingEnquiryFields} from '../lead-fields';
const statusLabels={idle:'Ready to help',connecting:'Connecting…',error:'Connection unavailable',speaking:'Speaking · you can interrupt',listening:'Listening · go ahead', 'requesting-mic':'Allow microphone access',transcribing:'Understanding your question…',thinking:'Thinking…',ready:'Ready for your question',unavailable:'Voice assistant coming soon'};
export default function VoiceAssistant({open,onOpen,onClose,onEnquiry,draft,onDraftChange}) {
  const [input,setInput]=useState(''),[view,setView]=useState('conversation');
  const voice=useVoiceAssistant(open,{draft,onDraftChange,reviewing:view==='enquiry'});const end=useRef(null),launcher=useRef(null),close=useRef(null);
  const missing=missingEnquiryFields(draft);
  useEffect(()=>{if(voice.enquiryReady&&!missing.length)setView('enquiry');},[voice.enquiryReady,voice.enquiryRevision,missing.length]);
  useEffect(()=>{if(view==='enquiry')voice.pauseMic();},[view,voice.pauseMic]);
  useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[voice.messages,voice.status]);
  useEffect(()=>{
    if(!open)return;
    close.current?.focus();
    const handle=event=>{if(event.key==='Escape'){onClose();launcher.current?.focus();}};
    window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);
  },[open,onClose]);
  function submit(event){event.preventDefault();if(input.trim()){voice.sendText(input);setInput('');}}
  return <div className="voice-widget">
    {open&&<aside className={`voice-popup ${view==='enquiry'?'show-enquiry':''}`} role="dialog" aria-modal="false" aria-labelledby="assistant-title" id="voice-assistant">
      <header className="voice-popup-header"><div className="assistant-avatar"><img src={avatar} alt=""/><span>AI</span></div><div><h2 id="assistant-title">Ask Krishna’s AI</h2></div><button type="button" className="widget-icon-button" ref={close} onClick={()=>{onClose();launcher.current?.focus();}} aria-label="Close voice assistant"><X size={20}/></button></header>
      <div className={`voice-presence ${voice.status==='speaking'?'talking':''} ${voice.status==='listening'?'hearing':''}`}>
        <VideoAvatar speechFrame={voice.speechFrame} status={voice.status}/>
        <div className="popup-wave" aria-hidden="true">{Array.from({length:17},(_,i)=><i key={i} style={{'--wave-height':`${8+i*11%26}px`,'--wave-delay':`${i*-.08}s`,'--input-level':voice.level}}/>)}</div>
        <p role="status">{statusLabels[voice.status]||'Ready to help'}</p>
      </div>
      {view==='conversation'?<div className="assistant-messages" aria-label="Conversation" role="log" aria-live="polite" aria-relevant="additions text">
        {!voice.messages.length&&<div className="assistant-empty"><Headphones size={20}/><p>Ask about my projects,<br/>skills, or your next idea.</p></div>}
        {voice.messages.map((message,i)=><div className={`assistant-message ${message.role}`} key={i}><span>{message.role==='assistant'?'Krishna’s AI':'You'}</span><p>{message.content}</p></div>)}
        <div ref={end}/>
      </div>:<div className="assistant-enquiry-pane"><button type="button" className="assistant-back" onClick={()=>setView('conversation')}>← Back to chat</button><LeadForm compact draft={draft} onDraftChange={onDraftChange}/><button type="button" className="assistant-enquiry" onClick={onEnquiry}>Continue in the full-page form <ArrowUpRight size={13}/></button></div>}
      {voice.error&&<p className="assistant-notice" role="alert">{voice.error}</p>}
      {voice.needsPlay&&<button type="button" className="widget-play" onClick={voice.replay}><Volume2 size={15}/> Play reply</button>}
      {voice.status==='unavailable'&&<a className="assistant-contact" href="mailto:singhkrishna512@gmail.com">Contact Krishna <ArrowUpRight size={14}/></a>}
      {view==='conversation'&&<div className="assistant-actions">
        <button type="button" className={`widget-mic ${!voice.micEnabled?'muted':''}`} onClick={voice.toggleMic} disabled={!voice.configured} aria-label={voice.micEnabled?'Mute microphone':'Enable microphone'} aria-pressed={voice.micEnabled}>{voice.micEnabled?<Mic size={18}/>:<MicOff size={18}/>}<span>{voice.micEnabled?'Mic on':'Mic off'}</span></button>
        {voice.status==='speaking'&&<button type="button" onClick={voice.interrupt}><Square size={12}/> Interrupt</button>}
        <button type="button" className="widget-reconnect" onClick={voice.reconnect} disabled={voice.status==='connecting'} aria-label="Restart conversation" title="Restart conversation"><RotateCcw size={16}/></button>
      </div>}
      {view==='conversation'&&<form className="assistant-form" onSubmit={submit}><label className="sr-only" htmlFor="assistant-question">Your question</label><input id="assistant-question" value={input} onChange={event=>setInput(event.target.value)} placeholder="Or type your question…" maxLength={1000} disabled={!voice.configured} autoComplete="off"/><button type="submit" aria-label="Send question" disabled={!input.trim()||!voice.configured}><Send size={17}/></button></form>}
    </aside>}
    <button type="button" ref={launcher} className={`voice-launcher ${open?'is-open':''}`} onClick={open?onClose:onOpen} aria-label={open?'Close voice assistant':'Open voice assistant'} aria-expanded={open} aria-controls={open?'voice-assistant':undefined}><span className="launcher-person">{open?<X size={24}/>:<img src={avatar} alt=""/>}</span><span className="launcher-label">Let’s talk<span>Ask my AI</span></span><i aria-hidden="true"/></button>
  </div>;
}
