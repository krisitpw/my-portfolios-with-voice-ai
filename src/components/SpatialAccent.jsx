import React from 'react';
import { Code2, Database, Workflow } from 'lucide-react';

export default function SpatialAccent() {
  return <div className="spatial-accent" aria-hidden="true">
    <div className="spatial-floor"/>
    <div className="spatial-cube-position"><div className="spatial-cube">
      <span className="cube-face cube-front"><Code2/><small>BUILD</small></span>
      <span className="cube-face cube-back"><Database/><small>DATA</small></span>
      <span className="cube-face cube-right"><Workflow/><small>CONNECT</small></span>
      <span className="cube-face cube-left"><Code2/><small>CREATE</small></span>
      <span className="cube-face cube-top">KS</span><span className="cube-face cube-bottom">✳</span>
    </div></div>
    <span className="spatial-satellite satellite-one">REACT</span><span className="spatial-satellite satellite-two">AI / SAAS</span>
    <div className="spatial-caption"><i/> IDEAS → WORKING SYSTEMS</div>
  </div>;
}
