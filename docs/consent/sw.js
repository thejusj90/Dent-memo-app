const CACHE='dentmemo-consent-shell-v3';
const SHELL=['/','/offline.html','/app.js','/google-auth.js','/function-auth-patch.js','/manifest.webmanifest','/icon.svg'];
const ESM='https://esm.sh/@supabase/supabase-js@2.112.3?bundle';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{await cache.addAll(SHELL);try{const res=await fetch(ESM);if(res.ok)await cache.put(ESM,res.clone())}catch{} }).then(()=>self.skipWaiting()));
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
