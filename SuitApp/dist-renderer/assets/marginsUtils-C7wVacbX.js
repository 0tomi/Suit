const m={A4:{label:"A4",widthPx:794,heightPx:1123,pdfPageSize:"A4"},A3:{label:"A3",widthPx:1123,heightPx:1588,pdfPageSize:"A3"},LETTER:{label:"Carta",widthPx:816,heightPx:1056,pdfPageSize:"Letter"},LEGAL:{label:"Oficio",widthPx:816,heightPx:1344,pdfPageSize:"Legal"}},s="A4",d=28;function u(t=s){return m[t]||m[s]}const P={pt:{pt:1,mm:25.4/72,cm:2.54/72},mm:{pt:72/25.4,mm:1,cm:.1},cm:{pt:72/2.54,mm:10,cm:1}};function p(t,r,e){if(r===e||!t)return t;const n=t*P[r][e];return e==="pt"?Math.round(n):e==="mm"?Math.round(n*10)/10:Math.round(n*100)/100}const M={pt:1,mm:.5,cm:.05},A={pt:"Puntos (pt)",mm:"Milímetros (mm)",cm:"Centímetros (cm)"},$={top:3,bottom:2.5,left:4,right:2.5,unit:"cm"},l={top:72,bottom:72,left:72,right:72,unit:"pt",mirrored:!1,pageFormat:s};function g(t){return{...l,...t||{},pageFormat:t?.pageFormat||s}}function S(t,r){return Math.round(r==="mm"?t*96/25.4:r==="cm"?t*96/2.54:t*96/72)}function x(t,r){const e=t*72/96;return r==="mm"?Math.round(e*25.4/72*10)/10:r==="cm"?Math.round(e*2.54/72*100)/100:Math.round(e)}function E(t,r="odd"){const e=g(t),n=e.mirrored&&r==="even";return{...e,left:n?e.right:e.left,right:n?e.left:e.right}}function T(t,r,e,n="odd"){const o=g(t),i=o.mirrored&&n==="even"?r==="left"?"right":"left":r;return{...o,[i]:e}}function F(t){const r=g(t),e=u(r.pageFormat);return{widthPx:e.widthPx,heightPx:e.heightPx}}function _(t){const r=g(t),e=u(r.pageFormat),{top:n,right:o,bottom:c,left:i,unit:a,mirrored:h}=r;return h?`
            @page {
                size: ${e.pdfPageSize};
                margin-top: ${n}${a};
                margin-bottom: ${c}${a};
            }

            @page :right {
                margin-left: ${i}${a};
                margin-right: ${o}${a};
            }

            @page :left {
                margin-left: ${o}${a};
                margin-right: ${i}${a};
            }
        `:`
        @page {
            size: ${e.pdfPageSize};
            margin: ${n}${a} ${o}${a} ${c}${a} ${i}${a};
        }
    `}const f=t=>`suit-template-margins:${t}`;function z(t,r){try{localStorage.setItem(f(t),JSON.stringify(r))}catch{}}function b(t){try{const r=localStorage.getItem(f(t));return r?g(JSON.parse(r)):null}catch{return null}}export{$ as A,l as D,d as P,A as U,E as a,_ as b,m as c,M as d,p as e,z as f,F as g,f as h,b as l,S as m,g as n,x as p,T as s};
