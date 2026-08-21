(()=>{
  const TARGET_KEY='dm_consent_post_submit_target';
  let wiredDone=null;

  function go(target='dashboard'){
    try{sessionStorage.setItem(TARGET_KEY,target)}catch{}
    const root=`${location.origin}/`;
    location.replace(root);
  }

  function restoreTarget(){
    let target='';
    try{target=sessionStorage.getItem(TARGET_KEY)||'';sessionStorage.removeItem(TARGET_KEY)}catch{}
    if(target!=='new')return;
    let tries=0;
    const timer=setInterval(()=>{
      const button=document.querySelector('[data-v="new"]');
      if(button){clearInterval(timer);button.click();return}
      if(++tries>40)clearInterval(timer);
    },100);
  }

  function wireCompletion(){
    const done=document.getElementById('done');
    if(!done||done===wiredDone)return;
    wiredDone=done;
    done.textContent='Back to dashboard';
    done.type='button';
    done.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      go('dashboard');
    },true);

    const actions=document.createElement('div');
    actions.className='actions';
    actions.style.cssText='justify-content:center;margin-top:12px';
    const another=document.createElement('button');
    another.type='button';
    another.className='secondary';
    another.textContent='Create another consent';
    another.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      go('new');
    },true);
    actions.appendChild(another);
    done.insertAdjacentElement('afterend',actions);

    const hint=document.createElement('p');
    hint.className='muted';
    hint.style.cssText='font-size:12px;margin-top:14px';
    hint.textContent='You can continue using Consent immediately — no new tab is needed.';
    actions.insertAdjacentElement('afterend',hint);
  }

  restoreTarget();
  const observer=new MutationObserver(wireCompletion);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>{restoreTarget();wireCompletion()});
  setTimeout(()=>{restoreTarget();wireCompletion()},500);
})();
