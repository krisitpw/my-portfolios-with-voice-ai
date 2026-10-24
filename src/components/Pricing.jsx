import React from 'react';
import {ArrowUpRight,Clock3} from 'lucide-react';
import {pricing,monthlyServices,pricingNotes} from '../pricing-data';
export default function Pricing({onSelect}) {
  return <section className="pricing-section" id="pricing" aria-labelledby="pricing-title">
    <div className="section-heading"><div><p className="eyebrow">CLEAR STARTING POINTS</p><h2 className="section-title" id="pricing-title">Built for your next idea.</h2></div><p>Websites, products, and growth.<br/>Choose a starting point. Let’s shape the details together.</p></div>
    <div className="pricing-table-wrap"><table className="pricing-table"><caption>Website development pricing · INR · Domain and hosting excluded</caption><thead><tr><th scope="col">Service</th><th scope="col">Estimated timeline</th><th scope="col">Investment</th><th scope="col"><span className="sr-only">Enquire</span></th></tr></thead><tbody>{pricing.map((item,i)=><tr key={item.id}><td><span className="price-number">{String(i+1).padStart(2,'0')}</span><div><strong>{item.name}</strong><small>{item.detail}</small></div></td><td><span className="price-time"><Clock3 size={13}/>{item.timeline}</span></td><td><strong className="price-amount">{item.price}</strong><small>{item.unit}</small></td><td><button type="button" className="price-select" aria-label={`Enquire about ${item.name} (${item.detail})`} onClick={()=>onSelect(item.id)}><ArrowUpRight size={19}/></button></td></tr>)}</tbody></table></div>
    <div className="growth-pricing">{monthlyServices.map(item=><article className="growth-card" key={item.id}><p className="eyebrow">ONGOING GROWTH</p><h3>{item.name}</h3><p>{item.description}</p><div className="monthly-amount">{item.price}<small>{item.unit}</small></div><p className="growth-followup">{item.followup}</p><small>{item.note}</small><button type="button" className="project-link" onClick={()=>onSelect(item.id)}>Discuss {item.id==='ads'?'campaigns':'search growth'} <ArrowUpRight size={15}/></button></article>)}</div>
    <details className="pricing-notes"><summary>Before we begin · pricing & project terms</summary><ul>{pricingNotes.map(note=><li key={note}>{note}</li>)}</ul></details>
  </section>;
}
