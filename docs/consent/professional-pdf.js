import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.3?bundle';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1?bundle';

const SUPABASE_URL='https://qcwsmepvucxtqgqohuqe.supabase.co';
const SUPABASE_KEY='sb_publishable_O9bkwJ1Qq3Kvpf2w7oS1zQ_bDAMe-sk';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const A4=[595.28,841.89];
const BLUE=rgb(0.055,0.357,0.918);
const NAVY=rgb(0.075,0.129,0.239);
const MUTED=rgb(0.42,0.48,0.57);
const LINE=rgb(0.88,0.91,0.95);
const PALE=rgb(0.965,0.977,0.995);

function clean(value){return String(value??'').replace(/\s+/g,' ').trim()}
function dateText(value){if(!value)return '—';try{return new Date(value).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return clean(value)}}
function wrap(text,font,size,maxWidth){
  const words=clean(text).split(' ').filter(Boolean),lines=[];let line='';
  for(const word of words){
    const next=line?`${line} ${word}`:word;
    if(font.widthOfTextAtSize(next,size)<=maxWidth){line=next;continue}
    if(line)lines.push(line);
    if(font.widthOfTextAtSize(word,size)<=maxWidth){line=word;continue}
    let chunk='';
    for(const ch of word){const test=chunk+ch;if(font.widthOfTextAtSize(test,size)>maxWidth&&chunk){lines.push(chunk);chunk=ch}else chunk=test}
    line=chunk;
  }
  if(line)lines.push(line);
  return lines;
}
function fitText(text,font,maxWidth,maxHeight){
  for(let size=10;size>=6.5;size-=0.25){const lines=wrap(text,font,size,maxWidth),leading=size*1.35;if(lines.length*leading<=maxHeight)return{size,leading,lines}}
  const size=6.25,leading=7.8;return{size,leading,lines:wrap(text,font,size,maxWidth)};
}
async function downloadBranding(path){if(!path)return null;const {data,error}=await supabase.storage.from('dm-consent-branding').download(path);if(error||!data)return null;return new Uint8Array(await data.arrayBuffer())}
async function currentClinic(){
  const {data:{session}}=await supabase.auth.getSession();if(!session)return null;
  const {data:member}=await supabase.from('dm_clinic_members').select('clinic_id').eq('user_id',session.user.id).eq('active',true).limit(1).maybeSingle();if(!member)return null;
  const {data:clinic}=await supabase.from('dm_clinics').select('id,name,city,consent_address,consent_phone,consent_email,consent_logo_path,consent_letterhead_path').eq('id',member.clinic_id).maybeSingle();
  return clinic||null;
}
async function loadRecord(id){const {data,error}=await supabase.from('dm_consents').select('*').eq('id',id).maybeSingle();if(error)throw error;if(!data)throw new Error('Consent record not found.');return data}

async function createBase(pdf,clinic){
  let page=null,usesLetterhead=false;
  if(clinic?.consent_letterhead_path){
    const bytes=await downloadBranding(clinic.consent_letterhead_path);
    if(bytes){
      try{
        if(/\.pdf$/i.test(clinic.consent_letterhead_path)){
          const source=await PDFDocument.load(bytes);const [copied]=await pdf.copyPages(source,[0]);page=pdf.addPage(copied);usesLetterhead=true;
        }else{
          page=pdf.addPage(A4);const image=/\.png$/i.test(clinic.consent_letterhead_path)?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);page.drawImage(image,{x:0,y:0,width:A4[0],height:A4[1]});usesLetterhead=true;
        }
      }catch{page=null}
    }
  }
  if(!page)page=pdf.addPage(A4);
  return{page,usesLetterhead};
}

async function drawDefaultHeader(pdf,page,clinic,bold,regular){
  const w=page.getWidth(),h=page.getHeight();
  page.drawRectangle({x:0,y:h-105,width:w,height:105,color:NAVY});
  page.drawRectangle({x:0,y:h-109,width:w,height:4,color:BLUE});
  let x=44;
  if(clinic?.consent_logo_path){
    const bytes=await downloadBranding(clinic.consent_logo_path);
    if(bytes){try{const image=/\.png$/i.test(clinic.consent_logo_path)?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);const d=image.scaleToFit(52,52);page.drawImage(image,{x:44,y:h-79,width:d.width,height:d.height});x=112}catch{}}
  }
  page.drawText(clean(clinic?.name)||'Dental Clinic',{x,y:h-52,size:17,font:bold,color:rgb(1,1,1)});
  const contact=[clean(clinic?.consent_address||clinic?.city),clean(clinic?.consent_phone),clean(clinic?.consent_email)].filter(Boolean).join('  •  ');
  if(contact){const lines=wrap(contact,regular,8.5,w-x-44).slice(0,2);lines.forEach((line,i)=>page.drawText(line,{x,y:h-70-(i*11),size:8.5,font:regular,color:rgb(.84,.89,.96)}))}
}
function drawLabel(page,label,value,x,y,width,regular,bold){
  page.drawText(label.toUpperCase(),{x,y,size:6.8,font:bold,color:MUTED});
  const lines=wrap(clean(value)||'—',regular,8.4,width).slice(0,2);lines.forEach((line,i)=>page.drawText(line,{x,y:y-12-(i*10),size:8.4,font:regular,color:NAVY}));
}
function drawSignature(page,strokes,x,y,w,h){
  page.drawRectangle({x,y,width:w,height:h,borderColor:LINE,borderWidth:1,color:rgb(1,1,1)});
  for(const stroke of strokes||[]){const pts=stroke?.points||[];for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i];page.drawLine({start:{x:x+Math.max(0,Math.min(1,a.x))*w,y:y+(1-Math.max(0,Math.min(1,a.y)))*h},end:{x:x+Math.max(0,Math.min(1,b.x))*w,y:y+(1-Math.max(0,Math.min(1,b.y)))*h},thickness:1.25,color:NAVY});
  }}
}

async function buildProfessionalPdf(record,clinic){
  const pdf=await PDFDocument.create();const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const {page,usesLetterhead}=await createBase(pdf,clinic);const w=page.getWidth(),h=page.getHeight();
  if(!usesLetterhead)await drawDefaultHeader(pdf,page,clinic,bold,regular);
  const left=46,right=46,bodyW=w-left-right;
  let y=usesLetterhead?h-122:h-137;
  page.drawText('SIGNED DENTAL CONSENT',{x:left,y,size:7.4,font:bold,color:BLUE});y-=25;
  const title=clean(record.consent_title_snapshot||record.procedure_name_snapshot||'Dental Consent');
  const titleSize=title.length>55?14:16;page.drawText(title,{x:left,y,size:titleSize,font:bold,color:NAVY});y-=24;
  page.drawLine({start:{x:left,y},end:{x:w-right,y},thickness:1,color:LINE});y-=18;

  const gap=16,col=(bodyW-gap)/2;
  drawLabel(page,'Patient',record.patient_name_snapshot,left,y,col,regular,bold);
  drawLabel(page,'Treating doctor',[record.doctor_name_snapshot,record.doctor_registration_snapshot?`Reg. ${record.doctor_registration_snapshot}`:''].filter(Boolean).join(' · '),left+col+gap,y,col,regular,bold);y-=38;
  drawLabel(page,'Mobile / DOB',[record.patient_mobile_snapshot||'',record.patient_dob_snapshot?dateText(record.patient_dob_snapshot).split(',')[0]:''].filter(Boolean).join(' · ')||'—',left,y,col,regular,bold);
  drawLabel(page,'Tooth / Procedure notes',[record.tooth_numbers?`Tooth ${record.tooth_numbers}`:'',record.procedure_notes||''].filter(Boolean).join(' · ')||'—',left+col+gap,y,col,regular,bold);y-=42;

  page.drawRectangle({x:left,y:y-1,width:bodyW,height:22,color:PALE});
  page.drawText('CONSENT STATEMENT',{x:left+10,y:y+7,size:7.2,font:bold,color:BLUE});y-=16;

  const signatureTop=188,ackTop=signatureTop+69;
  const maxTextH=Math.max(110,y-ackTop-18);
  const fitted=fitText(record.consent_text_snapshot||'',regular,bodyW,maxTextH);
  for(const line of fitted.lines){if(y<ackTop+8)break;page.drawText(line,{x:left,y,size:fitted.size,font:regular,color:NAVY});y-=fitted.leading}

  y=ackTop;
  page.drawLine({start:{x:left,y:y+16},end:{x:w-right,y:y+16},thickness:1,color:LINE});
  page.drawText('ACKNOWLEDGEMENTS',{x:left,y,size:7.2,font:bold,color:BLUE});
  const acks=(record.acknowledgements||[]).length?record.acknowledgements:['I have read and understood the information above.','I have had an opportunity to ask questions.'];
  acks.slice(0,3).forEach((ack,i)=>{page.drawRectangle({x:left,y:y-19-(i*14),width:7,height:7,borderColor:BLUE,borderWidth:1});page.drawLine({start:{x:left+1.5,y:y-15-(i*14)},end:{x:left+3.2,y:y-17-(i*14)},thickness:1,color:BLUE});page.drawLine({start:{x:left+3.1,y:y-17-(i*14)},end:{x:left+6.3,y:y-12.5-(i*14)},thickness:1,color:BLUE});page.drawText(clean(ack),{x:left+13,y:y-20-(i*14),size:7.5,font:regular,color:NAVY})});

  const sigY=76,sigW=240,sigH=76;page.drawText('PATIENT / GUARDIAN SIGNATURE',{x:left,y:sigY+sigH+10,size:7.2,font:bold,color:BLUE});
  drawSignature(page,record.signature_strokes,left,sigY,sigW,sigH);
  const detailX=left+sigW+24;
  drawLabel(page,'Signer',record.signer_name,detailX,sigY+sigH-3,bodyW-sigW-24,regular,bold);
  drawLabel(page,'Signed on',dateText(record.signed_at),detailX,sigY+sigH-37,bodyW-sigW-24,regular,bold);
  if(record.signer_relationship)drawLabel(page,'Relationship',record.signer_relationship,detailX,sigY+sigH-68,bodyW-sigW-24,regular,bold);

  page.drawLine({start:{x:left,y:48},end:{x:w-right,y:48},thickness:.7,color:LINE});
  page.drawText(clean(record.consent_number),{x:left,y:31,size:7.2,font:bold,color:NAVY});
  const footer='Electronically signed consent • Stored securely in DentMemo Consent';
  page.drawText(footer,{x:w-right-regular.widthOfTextAtSize(footer,6.7),y:31,size:6.7,font:regular,color:MUTED});
  return await pdf.save();
}

async function downloadProfessional(id,button){
  if(!navigator.onLine)return alert('Connect to the internet to retrieve a stored consent PDF.');
  const old=button?.textContent;try{
    if(button){button.disabled=true;button.textContent='Preparing…'}
    const [record,clinic]=await Promise.all([loadRecord(id),currentClinic()]);
    const bytes=await buildProfessionalPdf(record,clinic);
    const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`${record.consent_number}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(error){alert(`Could not prepare PDF: ${error?.message||error}`)}finally{if(button){button.disabled=false;button.textContent=old||'Download PDF'}}
}

function polishRecords(){
  document.querySelectorAll('[data-mail]').forEach(el=>el.remove());
  document.querySelectorAll('[data-pdf]').forEach(el=>{el.textContent='Download PDF';el.setAttribute('aria-label','Download professional one-page PDF')});
  document.querySelectorAll('.row small').forEach(el=>{if(['not_applicable','pending','failed','sent'].includes((el.textContent||'').trim()))el.textContent='Stored securely'});
  document.querySelectorAll('.badge').forEach(el=>{if(['not_applicable','pending','failed','sent'].includes((el.textContent||'').trim()))el.textContent='Stored'});
}

document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-pdf]');if(!button)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();downloadProfessional(button.dataset.pdf,button);
},true);
const observer=new MutationObserver(polishRecords);observer.observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('load',polishRecords);setTimeout(polishRecords,500);
