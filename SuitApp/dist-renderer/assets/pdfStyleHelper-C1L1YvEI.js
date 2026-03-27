const c=()=>{let r="";try{const o=Array.from(document.styleSheets);for(const e of o)try{const t=e.cssRules||e.rules;if(t)for(const s of Array.from(t))r+=s.cssText+`
`}catch{e.ownerNode&&e.ownerNode.tagName==="STYLE"&&(r+=e.ownerNode.innerText+`
`)}}catch{console.error("Error collecting report styles")}return r};export{c as getReportStyles};
