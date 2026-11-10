(async()=>{
  if(location.protocol!=='https:'||location.hostname!=='www.seaofthieves.com'||!/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?profile(?:\/|$)/i.test(location.pathname)){
    alert('Open your signed-in profile at https://www.seaofthieves.com/profile/overview, then use this bookmark again.');return;
  }
  const button=document.createElement('div');button.textContent='Gilded Ledger: exporting profile data…';Object.assign(button.style,{position:'fixed',right:'20px',top:'20px',zIndex:'2147483647',padding:'16px',background:'#102d31',color:'#ead8af',font:'14px sans-serif',maxWidth:'330px'});document.body.append(button);
  const output={format:'gilded-ledger-profile',version:1,exportedAt:new Date().toISOString(),gamertag:document.querySelector('.pirate-balance__gamertag')?.textContent?.trim()||'',locale:document.documentElement.lang||'en',sections:{},errors:[]};
  const forbidden=/^(?:(?:xbox|xsts|user)?token|access.?token|refresh.?token|id.?token|session(?:id)?|authorization|cookie|client.?secret|password|rat|rare.?authentication.?token)$/i;
  const sanitize=value=>{if(Array.isArray(value))return value.map(sanitize);if(value&&typeof value==='object'){const result={};for(const [key,item] of Object.entries(value))if(!forbidden.test(key)&&!['__proto__','constructor','prototype'].includes(key))result[key]=sanitize(item);return result;}return value;};
  try{
    for(const section of ['overview','reputation','chest','balance','achievements']){
      try{const response=await fetch('/api/profilev2/'+section,{credentials:'same-origin',headers:{accept:'application/json'}});if(!response.ok||!response.headers.get('content-type')?.includes('json'))throw new Error('Sign-in expired or section unavailable');output.sections[section]=sanitize(await response.json());}catch{output.errors.push(section+' could not be exported');}
    }
    if(!output.sections.reputation&&!output.sections.chest)throw new Error('No progress was exported. Sign into the official website, set its language to English, then try again.');
    const blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='sea-of-thieves-profile.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    button.textContent='Profile exported. Return to the Gilded Ledger and choose Import profile. This file contains progress, not login credentials.';
  }catch(error){button.textContent='Export failed: '+error.message;}
  setTimeout(()=>button.remove(),20000);
})();
