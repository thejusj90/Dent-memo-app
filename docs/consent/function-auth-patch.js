(()=>{
  const nativeFetch=window.fetch.bind(window);
  const EMAIL_PATH='/functions/v1/consent-email';
  const DB_NAME='dentmemo-consent-offline-v1';

  // Email delivery has been removed from DentMemo Consent.
  // Old cached clients may still attempt to call the former Edge Function;
  // treat those calls as a successful no-op so their legacy retry queue clears.
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    if(url.includes(EMAIL_PATH)){
      return new Response(JSON.stringify({ok:true,emailFeatureRemoved:true}),{
        status:200,
        headers:{'Content-Type':'application/json'}
      });
    }
    return nativeFetch(input,init);
  };

  function clearLegacyEmailQueue(){
    try{
      const req=indexedDB.open(DB_NAME);
      req.onsuccess=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('emails')){db.close();return;}
        const tx=db.transaction('emails','readwrite');
        tx.objectStore('emails').clear();
        tx.oncomplete=()=>db.close();
        tx.onerror=()=>db.close();
      };
    }catch{}
  }

  function removeEmailUi(){
    document.querySelectorAll('[data-mail]').forEach(el=>el.remove());

    document.querySelectorAll('.status-warn').forEach(el=>{
      if(/email retry/i.test(el.textContent||'')) el.remove();
    });

    document.querySelectorAll('.row').forEach(row=>{
      const pdfButton=row.querySelector('[data-pdf]');
      if(pdfButton){
        const third=row.children?.[2];
        const small=third?.querySelector?.('small');
        if(small) small.textContent='Stored securely';
      }
      row.querySelectorAll('.badge').forEach(badge=>{
        const value=(badge.textContent||'').trim().toLowerCase();
        if(['pending','failed','sent','not_applicable'].includes(value)) badge.textContent='Stored';
      });

      const title=row.querySelector('div:nth-child(2) b');
      if(title && /^email\s/i.test((title.textContent||'').trim())) row.style.display='none';
    });

    document.querySelectorAll('label').forEach(label=>{
      if(/email for signed pdfs/i.test(label.textContent||'')){
        const input=label.querySelector('input[type="email"]');
        if(input) input.required=false;
        for(const node of label.childNodes){
          if(node.nodeType===Node.TEXT_NODE){node.textContent='Doctor email (optional)';break;}
        }
      }
    });
  }

  clearLegacyEmailQueue();
  document.addEventListener('DOMContentLoaded',removeEmailUi);
  new MutationObserver(removeEmailUi).observe(document.documentElement,{childList:true,subtree:true});
})();
