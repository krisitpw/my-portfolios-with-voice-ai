import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Linkedin, Github, Mail, Code2, Bot, Workflow, Sparkles, Globe2, Database, GitBranch, ShoppingBag } from "lucide-react";
import portrait from "./assets/krishna-portrait.jpg";
import "./styles.css";
import VoiceAssistant from "./components/VoiceAssistant";
import SpatialAccent from "./components/SpatialAccent";
import Pricing from "./components/Pricing";
import LeadForm from "./components/LeadForm";
import {emptyEnquiry} from "./lead-fields";
import { liveProjects, featured } from "./portfolio-data";
const technologies = [
  { name: "PHP", mark: "php", color: "#8993be", style: "php" },
  { name: "Laravel", mark: "L", color: "#ff6159", style: "laravel" },
  { name: "JavaScript", mark: "JS", color: "#e8d44e", style: "javascript" },
  { name: "React", mark: "⚛", color: "#61dafb", style: "react" },
  { name: "WordPress", mark: "W", color: "#ededed", style: "wordpress" },
  { name: "Shopify", icon: ShoppingBag, color: "#95bf47" },
  { name: "MySQL", icon: Database, color: "#4479a1" },
  { name: "Git", icon: GitBranch, color: "#f05032" },
  { name: "REST APIs", icon: Code2, color: "#36bcf8" },
  { name: "AI", icon: Bot, color: "#b5a0e5" },
  { name: "n8n", icon: Workflow, color: "#ea6c8b" },
];

function Reveal({ children, className = "", delay = 0 }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className={className} initial={reduceMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.65, delay }}>{children}</motion.div>;
}
function Tags({ items }) {
  return <div className="tags">{items.map(item => <span key={item}>{item}</span>)}</div>;
}
function ProjectVisual({ index }) {
  return <div className={`project-visual visual-${index}`} aria-hidden="true">
    <div className="preview-toolbar"><span/><span/><span/><i>{["voice.workspace", "piesetu.crm", "messages.workspace", "automation.workflow"][index]}</i></div>
    {index === 0 ? <div className="voice-preview"><div className="voice-orb"><Bot size={32}/></div><span>Conversational Voice AI</span><div className="waveform">{Array.from({length:19}, (_,i)=><i key={i} style={{height:`${12 + (i * 17 % 38)}px`}}/>)}</div><small>Connected · Ready to listen</small></div>
    : index === 1 ? <div className="crm-preview"><aside><b>P.</b><i/><i/><i/><i/></aside><div><strong>Sales overview</strong><div className="mini-stats"><span>Leads<b>128</b></span><span>Pipeline<b>24</b></span></div><div className="chart">{[32,50,40,68,56,85,72,96].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div></div></div>
    : index === 2 ? <div className="chat-preview"><span><i/> WhatsApp workspace</span><p>Hello! How can I help you today?</p><p>I'd like to know more about your services.</p><p>Of course. Let's find the right solution.</p><div>Message your customer… <ArrowUpRight size={12}/></div></div>
    : <div className="workflow-preview"><span><Globe2/>Webhook</span><i/><span><Bot/>AI agent</span><i/><span><Database/>CRM</span></div>}
  </div>;
}



function App() {
  const [filter, setFilter] = useState("All");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [leadDraft,setLeadDraft]=useState({...emptyEnquiry});
  function updateLeadDraft(patch){setLeadDraft(previous=>Object.entries(patch).some(([key,value])=>previous[key]!==value)?{...previous,...patch}:previous);}
  function openEnquiry(service=''){if(service)updateLeadDraft({requirement:service});setVoiceOpen(false);requestAnimationFrame(()=>document.getElementById('project-enquiry')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));}
  const categories = ["All", "Business", "E-commerce", "Education", "Healthcare", "AI / SaaS"];
  const projects = liveProjects.map(([name, desc, url, no]) => ({ name, desc, url, no, category:
    /shopify|brands/i.test(name) ? "E-commerce" : name === "MGM Hospital Patna" ? "Healthcare" :
    ["MGM GOI", "Society Gurukul", "St. Dominic Savio's"].includes(name) ? "Education" :
    ["PieSetu CRM", "VidyaSetu ERP", "AskMe360.ai"].includes(name) ? "AI / SaaS" : "Business" }));
  const filtered = filter === "All" ? projects : projects.filter(p => p.category === filter);
  return <MotionConfig reducedMotion="user">
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="background" aria-hidden="true"><div className="spotlight"/></div>
    <div className="container">
      <header className="nav">
        <a className="brand" href="#home" aria-label="Krishna Singh home"><span>K</span><span>S</span></a>
        <nav className="section-nav" aria-label="Portfolio sections"><a href="#home">Home</a><a href="#about">About</a><a href="#work">Work</a><a href="#pricing">Pricing</a><button type="button" onClick={()=>setVoiceOpen(true)}>Talk to AI</button><a href="#contact">Contact</a></nav>
        <nav className="social-links" aria-label="Main navigation">
          <a href="https://www.linkedin.com/in/krishna-singh-rajput/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn"><Linkedin size={23}/></a>
          <a href="https://github.com/krisitpw" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub"><Github size={23}/></a>
          <a href="#work" aria-label="Explore projects" title="Projects"><Code2 size={25}/></a>
          <a href="mailto:singhkrishna512@gmail.com" aria-label="Email Krishna" title="Email"><Mail size={23}/></a>
        </nav>
      </header>
      <main id="main">
        <section className="hero" id="home" aria-labelledby="hero-title">
          <Reveal className="hero-copy">
            <h1 id="hero-title">Krishna Singh</h1>
            <p className="hero-role">Software Engineer & AI Builder</p>
            <p className="hero-description">A software engineer building real systems — from SaaS products and conversational AI to automation workflows and high-performing web experiences.</p>
            <div className="hero-actions"><a className="metal-button" href="#work">Explore my work <ArrowUpRight size={17}/></a><button type="button" className="voice-invitation" onClick={()=>setVoiceOpen(true)}>Talk to my AI <span>↗</span></button></div>
            <SpatialAccent/>
          </Reveal>
          <Reveal className="portrait-wrap" delay={0.2}><div className="portrait"><img src={portrait} alt="Krishna Singh" width="650" height="650" fetchpriority="high"/><div className="portrait-texture"/></div></Reveal>
        </section>
        <section className="technologies" id="technologies" aria-labelledby="technology-title">
          <Reveal><h2 className="section-title" id="technology-title">Technologies</h2></Reveal>
          <div className="technology-list">{technologies.map((tech,i) => {const Icon=tech.icon; return <div className="technology" key={tech.name} style={{color:tech.color, "--delay":`${i * -0.37}s`}} tabIndex={0} aria-label={tech.name}><span className={`tech-mark ${tech.style || ""}`}>{Icon ? <Icon size={62} strokeWidth={1.5}/> : tech.mark}</span><span className="tech-label">{tech.name}</span></div>;})}</div>
        </section>
        <section className="engineering" id="about" aria-labelledby="engineering-title">
          <Reveal><h2 className="section-title" id="engineering-title">Engineering & Product Work</h2></Reveal>
          <Reveal className="metal-frame"><div className="summary-card"><h3>Software engineering <span>with product thinking</span></h3><p>I turn complex ideas into useful digital products. My work spans business websites, multi-tenant SaaS, CRM workflows and conversational AI — combining hands-on engineering with a focus on real business problems.</p><Tags items={["PHP", "Laravel", "React", "SaaS", "AI applications", "REST APIs", "Automation"]}/></div></Reveal>
          <div className="feature-grid">{featured.map(p => <Reveal className="metal-frame feature-frame" key={p.no}><article className="feature-card"><div className="feature-heading"><div><p className="eyebrow">{p.type}</p><h3>{p.title}</h3></div><span className="status-dot"/></div><div className="feature-description"><p>{p.desc}</p></div><Tags items={p.tags}/></article></Reveal>)}</div>
        </section>
        <section className="projects" id="work" aria-labelledby="projects-title">
          <Reveal><h2 className="section-title" id="projects-title">Projects</h2></Reveal>
          {featured.map((p,i)=><Reveal className="project-detail" key={p.no}><ProjectVisual index={i}/><div className="project-copy" id={`build-${p.no}`}><h3>{p.title}</h3><p>{p.desc}</p><ul>{[
            ["Connects conversational models, speech services and communication APIs.", "Brings voice-first interactions into practical application workflows."],
            ["Lead management and sales communication in a connected CRM workspace.", "WhatsApp integrations, workflow automation and AI-enabled calling."],
            ["Multi-agent conversations, templates, media and inbound webhooks.", "Messaging automation with website chat integration."],
            ["Connects applications and APIs to reduce repetitive work.", "Supports lead-to-CRM processes through event-driven workflows."]
          ][i].map(item=><li key={item}>{item}</li>)}</ul><Tags items={p.tags}/>{i===1 && <a className="project-link" href="https://crm.piesetucrm.com/" target="_blank" rel="noopener noreferrer">Visit PieSetu CRM <ArrowUpRight size={15}/></a>}</div></Reveal>)}
        </section>
        <section className="live-work" id="live-websites" aria-labelledby="live-title">
          <Reveal><h2 className="section-title" id="live-title">Live Websites</h2><p className="section-description">Explore my website and product portfolio.</p></Reveal>
          <div className="filter-row" role="group" aria-label="Filter projects by category">{categories.map(category=><button type="button" key={category} className={filter===category?"filter active":"filter"} aria-pressed={filter===category} onClick={()=>setFilter(category)}>{category}</button>)}</div>
          <p className="result-count" role="status">{filtered.length} {filtered.length===1?"project":"projects"}</p>
          <div className="project-list">{filtered.map(p=><a className="project-row" id={`website-${p.no}`} href={p.url} target="_blank" rel="noopener noreferrer" key={p.no}><span className="project-no">{p.no}</span><span className="project-name">{p.name}<small>{p.desc}</small></span><span className="project-category">{p.category}</span><ArrowUpRight size={19}/></a>)}</div>
          <p className="portfolio-note">Project involvement and scope may vary by engagement.</p>
        </section>
        <Pricing onSelect={openEnquiry}/>
        <section className="contact" id="contact" aria-labelledby="contact-title">
          <Reveal><h2 className="section-title" id="contact-title">Get in Touch</h2><div className="contact-details"><p>Gurugram, Haryana, India</p><a href="tel:+919540434299">+91 95404 34299</a><a className="email-link" href="mailto:singhkrishna512@gmail.com">singhkrishna512@gmail.com</a></div></Reveal>
          <LeadForm draft={leadDraft} onDraftChange={updateLeadDraft}/>
        </section>
      </main>
      <footer><span>© {new Date().getFullYear()} Krishna Singh</span><a href="#home">Back to top ↑</a></footer>
    </div>
    <VoiceAssistant open={voiceOpen} onOpen={()=>setVoiceOpen(true)} onClose={()=>setVoiceOpen(false)} onEnquiry={()=>openEnquiry()} draft={leadDraft} onDraftChange={updateLeadDraft}/>
  </MotionConfig>;
}
createRoot(document.getElementById("root")).render(<App/>);
