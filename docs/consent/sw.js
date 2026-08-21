const CACHE='dentmemo-consent-shell-v7';
const SHELL=['/','/offline.html','/app.js','/google-auth.js','/function-auth-patch.js','/letterhead-settings.js','/professional-pdf.js','/completion-recovery.js','/manifest.webmanifest','/icon.svg'];
const EXTERNAL=['https://esm.sh/@supabase/supabase-js@2.112.3?bundle','https://esm.sh/pdf-lib@1.17.1?bundle'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await cache.addAll(SHELL);
    for(const url of EXTERNAL){try{const res=await fetch(url);if(res.ok)await cache.put(url,res.clone())}catch{}}
  }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.hostname.endsWith('supabase.co')) return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{
      const copy=res.clone();caches.open(CACHE).then(c=>c.put('/offline.html',copy));return res;
    }).catch(()=>caches.match('/offline.html')));
    return;
  }
  if(url.origin===self.location.origin || url.hostname==='esm.sh'){
    event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
      if(res && (res.ok || res.type==='opaque')) caches.open(CACHE).then(c=>c.put(req,res.clone()));
      return res;
    })));
  }
});
