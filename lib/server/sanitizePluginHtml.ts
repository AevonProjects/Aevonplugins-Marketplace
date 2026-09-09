const allowed = new Set(['p','br','strong','b','em','i','u','s','ul','ol','li','h2','h3','h4','blockquote','code','pre','a','span']);
function escAttr(v:string){return v.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
export function sanitizePluginHtml(input: unknown) {
  const html=String(input??'').slice(0,100000);
  return html.replace(/<!--[\s\S]*?-->|<![^>]*>|<\/?([a-zA-Z0-9:-]+)([^>]*)>/g,(full:string,rawTag?:string,rawAttrs?:string)=>{
    if(!rawTag)return '';
    const tag=rawTag.toLowerCase(); if(!allowed.has(tag))return '';
    const closing=/^<\s*\//.test(full); if(closing)return tag==='br'?'':`</${tag}>`;
    if(tag==='br')return '<br>';
    if(tag==='a'){
      const m=String(rawAttrs||'').match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href=(m?.[1]||m?.[2]||m?.[3]||'').trim();
      if(href){try{const u=new URL(href);if(['http:','https:','mailto:'].includes(u.protocol))return `<a href="${escAttr(u.toString())}" target="_blank" rel="noopener noreferrer">`;}catch{}}
      return '<a>';
    }
    return `<${tag}>`;
  }).slice(0,50000);
}
