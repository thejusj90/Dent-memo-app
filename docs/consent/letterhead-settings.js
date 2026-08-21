import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3?bundle';

const SUPABASE_URL='https://qcwsmepvucxtqgqohuqe.supabase.co';
const SUPABASE_KEY='sb_publishable_O9bkwJ1Qq3Kvpf2w7oS1zQ_bDAMe-sk';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let busy=false;

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function clinicContext(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)return null;
  const {data:member,error}=await supabase.from('dm_clinic_members').select('clinic_id,role').eq('user_id',session.user.id).eq('active',true).limit(1).maybeSingle();
  if(error||!member)return null;
  const {data:clinic}=await supabase.from('dm_clinics').select('id,name,consent_letterhead_path').eq('id',member.clinic_id).maybeSingle();
  return clinic?{session,member,clinic}:null;
}

async function signedPreview(path){
  if(!path)return null;
  const {data}=await supabase.storage.from('dm-consent-branding').createSignedUrl(path,900);
  return data?.signedUrl||null;
}

async function inject(){
  if(busy||document.getElementById('dm-letterhead-panel'))return;
  const heading=[...document.querySelectorAll('.card h2')].find(h=>h.textContent?.trim()==='Clinic profile');
  if(!heading)return;
  busy=true;
  try{
    const info=await clinicContext();
    if(!info||info.member.role!=='owner')return;
    const card=heading.closest('.card');
    if(!card)return;
    const panel=document.createElement('div');
    panel.id='dm-letterhead-panel';
    panel.style.cssText='margin-top:20px;padding-top:18px;border-top:1px solid #e7ebf2';
    const current=info.clinic.consent_letterhead_path;
    panel.innerHTML=`
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <h3 style="margin:0 0 5px;font-size:16px">PDF letterhead</h3>
          <p class="muted" style="margin:0;max-width:580px">Optional. Upload a blank A4 clinic letterhead. DentMemo will place the consent, patient details and signature inside safe margins and keep the final signed PDF to one page.</p>
        </div>
        <span class="badge" id="dm-letterhead-status">${current?'Letterhead active':'DentMemo design active'}</span>
      </div>
      <div id="dm-letterhead-preview" style="margin:12px 0"></div>
      <div class="actions">
        <label class="secondary" style="display:inline-flex;align-items:center;cursor:pointer">
          ${current?'Replace letterhead':'Upload letterhead'}
          <input id="dm-letterhead-file" type="file" accept="application/pdf,image/png,image/jpeg" style="display:none">
        </label>
        ${current?'<button class="link" id="dm-letterhead-remove" type="button">Use DentMemo design instead</button>':''}
      </div>
      <small class="muted" style="display:block;margin-top:8px">Best result: A4 portrait, blank body area, PDF/PNG/JPG, maximum 5 MB. Letterhead is stored privately for this clinic only.</small>`;
    card.appendChild(panel);

    const preview=document.getElementById('dm-letterhead-preview');
    if(current){
      const url=await signedPreview(current);
      if(url){
        if(/\.pdf(?:$|\?)/i.test(current)) preview.innerHTML=`<a class="link" href="${esc(url)}" target="_blank" rel="noopener">Preview current A4 letterhead</a>`;
        else preview.innerHTML=`<img src="${esc(url)}" alt="Clinic letterhead preview" style="width:min(260px,100%);max-height:180px;object-fit:contain;border:1px solid #e7ebf2;border-radius:10px;background:#fff">`;
      }
    }

    document.getElementById('dm-letterhead-file').onchange=async ev=>{
      const file=ev.target.files?.[0];
      if(!file)return;
      if(file.size>5*1024*1024)return alert('Letterhead must be 5 MB or smaller.');
      if(!['application/pdf','image/png','image/jpeg'].includes(file.type))return alert('Upload an A4 PDF, PNG or JPG letterhead.');
      const ext=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':'jpg';
      const path=`${info.clinic.id}/letterhead.${ext}`;
      const status=document.getElementById('dm-letterhead-status');
      status.textContent='Uploading…';
      const {error:upError}=await supabase.storage.from('dm-consent-branding').upload(path,file,{contentType:file.type,upsert:true});
      if(upError){status.textContent='Upload failed';return alert(upError.message)}
      const {error:updateError}=await supabase.from('dm_clinics').update({consent_letterhead_path:path}).eq('id',info.clinic.id);
      if(updateError){status.textContent='Save failed';return alert(updateError.message)}
      status.textContent='Letterhead active';
      alert('Letterhead saved. New and re-sent consent PDFs will use it automatically.');
      location.reload();
    };

    const remove=document.getElementById('dm-letterhead-remove');
    if(remove)remove.onclick=async()=>{
      if(!confirm('Switch future consent PDFs back to the DentMemo professional design?'))return;
      const {error}=await supabase.from('dm_clinics').update({consent_letterhead_path:null}).eq('id',info.clinic.id);
      if(error)return alert(error.message);
      location.reload();
    };
  }finally{busy=false}
}

const observer=new MutationObserver(()=>inject());
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',inject);
setTimeout(inject,800);
