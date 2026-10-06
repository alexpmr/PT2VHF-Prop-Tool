function decodeEntities(value){
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,key)=>{
    if(key[0]==='#'){
      const hex=key[1].toLowerCase()==='x',n=parseInt(key.slice(hex?2:1),hex?16:10);
      return Number.isFinite(n)&&n>=0&&n<=0x10ffff?String.fromCodePoint(n):'';
    }
    return named[key.toLowerCase()]??'';
  });
}
function stripInlineTags(value){return String(value).replace(/<[^>]*>/g,'');}
function clean(value){
  return decodeEntities(value)
    .replace(/\r/g,'')
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}
export function normalizeReleaseNotes(raw){
  let value=String(raw??'').trim();
  if(!value)return '';
  value=decodeEntities(value);
  value=value
    .replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    .replace(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi,(_,a,b,label)=>{
      const href=decodeEntities(a??b??'').trim(),text=clean(stripInlineTags(label));
      const safe=/^https:\/\//i.test(href);
      return text+(safe&&href!==text?' ('+href+')':'');
    })
    .replace(/<li\b[^>]*>/gi,'\n• ')
    .replace(/<\/li>/gi,'')
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/(?:p|div|section|article|h[1-6]|ul|ol)>/gi,'\n\n')
    .replace(/<(?:p|div|section|article|h[1-6]|ul|ol)\b[^>]*>/gi,'')
    .replace(/<[^>]+>/g,'');
  value=decodeEntities(value)
    .replace(/^\s{0,3}#{1,6}\s+/gm,'')
    .replace(/^\s*[-*+]\s+/gm,'• ')
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g,'$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g,'$1')
    .replace(/__([^_]+)__/g,'$1')
    .replace(/\x60([^\x60]+)\x60/g,'$1');
  return clean(value);
}
