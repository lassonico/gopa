import React from 'react';
import logoLoader from '../assets/logoLoader.svg';

const STYLE_TAG = `
.dp-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
.dp-loader__orbit{position:relative;width:104px;height:104px;animation:dpFloat 2.6s ease-in-out infinite;}
.dp-loader__ring{position:absolute;inset:0;border-radius:50%;border:3px dashed rgba(130,28,65,.4);animation:dpSpin 7s linear infinite;}
.dp-loader__ring::after{content:"";position:absolute;top:-5px;left:50%;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#e68457;box-shadow:0 0 14px 2px rgba(230,132,87,.9);animation:dpDotPulse 1.4s ease-in-out infinite;}
.dp-loader__ring2{position:absolute;inset:9px;border-radius:50%;border:2px solid rgba(94,36,78,.28);animation:dpSpinRev 4s linear infinite;}
.dp-loader__ring2::after{content:"";position:absolute;bottom:-4px;left:50%;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:#aa1c41;}
.dp-loader__logo{position:absolute;inset:20px;width:auto;height:calc(100% - 40px);animation:dpPulse 1.7s ease-in-out infinite;}
.dp-loader__text{font-size:13px;color:#6b7280;font-weight:500;letter-spacing:.3px;animation:dpTextFade 1.7s ease-in-out infinite;}
@keyframes dpSpin{to{transform:rotate(360deg)}}
@keyframes dpSpinRev{to{transform:rotate(-360deg)}}
@keyframes dpPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes dpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes dpDotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.85)}}
@keyframes dpTextFade{0%,100%{opacity:1}50%{opacity:.45}}
@media (prefers-reduced-motion:reduce){
.dp-loader__orbit,.dp-loader__ring,.dp-loader__ring2,.dp-loader__logo,.dp-loader__text{animation:none!important;}
}
`;
let injected = false;
function ensureStyle() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  if (!document.getElementById('dp-loader-styles')) {
    const style = document.createElement('style');
    style.id = 'dp-loader-styles';
    style.textContent = STYLE_TAG;
    document.head.appendChild(style);
  }
}

export default function Loader({ text, size = 104 }) {
  ensureStyle();
  return (
    <div className="dp-loader" role="status" aria-label="Cargando">
      <div className="dp-loader__orbit" style={{ width: size, height: size }}>
        <div className="dp-loader__ring" aria-hidden="true" />
        <div className="dp-loader__ring2" aria-hidden="true" />
        <img src={logoLoader} alt="Cargando" className="dp-loader__logo" />
      </div>
      {text ? <p className="dp-loader__text" style={{ margin: 0 }}>{text}</p> : null}
    </div>
  );
}