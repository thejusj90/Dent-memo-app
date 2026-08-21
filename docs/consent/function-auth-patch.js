(()=>{
  const nativeFetch=window.fetch.bind(window);
  const projectRef='qcwsmepvucxtqgqohuqe';
  const publishableKey='sb_publishable_O9bkwJ1Qq3Kvpf2w7oS1zQ_bDAMe-sk';

  function currentAccessToken(){
    try{
      const candidates=[];
      const exact=localStorage.getItem(`sb-${projectRef}-auth-token`);
      if(exact)candidates.push(exact);
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)||'';
        if(key.startsWith('sb-')&&key.endsWith('-auth-token')&&key!==`sb-${projectRef}-auth-token`){
          const value=localStorage.getItem(key);
          if(value)candidates.push(value);
        }
      }
      for(const raw of candidates){
        try{
          const parsed=JSON.parse(raw);
          const token=parsed?.access_token||parsed?.currentSession?.access_token||parsed?.session?.access_token;
          if(token)return token;
        }catch{}
      }
    }catch{}
    return null;
  }

  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    if(url.includes(`${projectRef}.supabase.co/functions/v1/consent-email`)){
      const token=currentAccessToken();
      if(token){
        const headers=new Headers(input instanceof Request?input.headers:undefined);
        if(init?.headers)new Headers(init.headers).forEach((value,key)=>headers.set(key,value));
        headers.set('Authorization',`Bearer ${token}`);
        headers.set('apikey',publishableKey);
        if(input instanceof Request){
          const request=new Request(input,{...init,headers});
          return nativeFetch(request);
        }
        return nativeFetch(input,{...init,headers});
      }
    }
    return nativeFetch(input,init);
  };
})();
