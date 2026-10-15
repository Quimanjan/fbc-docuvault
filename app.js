/* FBC DocuVault — student papers and graduation requirements (Supabase edition). */
const sb = window.supabase.createClient(window.FBC_CONFIG.url, window.FBC_CONFIG.anonKey);
const BUCKET = "papers";

const REQ = [
  {key:"form137", tab:"FORM 137", title:"Form 137", desc:"Learner's Permanent Record from your senior high school."},
  {key:"form138", tab:"FORM 138", title:"Form 138", desc:"Report Card showing your final Grade 12 grades."},
  {key:"nstp",    tab:"NSTP",     title:"NSTP Serial Number", desc:"Serial number from your NSTP certificate of completion.", serial:true},
  {key:"psa",     tab:"PSA",      title:"PSA Birth Certificate", desc:"Certificate of Live Birth on PSA security paper."},
];
const LABEL = {verified:"Verified", submitted:"For review", returned:"Returned", missing:"Not yet submitted"};
const COURSES = ["BS Information Technology","BS Business Administration","Bachelor of Elementary Education","Bachelor of Secondary Education","BS Criminology","Bachelor of Theology","AB English"];
const CATS = ["School records","Certificates & awards","IDs","Receipts & payments","Church & organizations","Personal","Other"];
const ACCEPT = "image/*,application/pdf,video/*,text/plain,text/csv";
const MAX_BYTES = 20*1024*1024;

const S = {session:null, uid:null, email:"", isReg:false, me:null, meLoaded:false, students:{}, lib:{},
  view:"me", filter:"all", q:"", open:null, busy:{}, libFilter:"all", libQ:"", editing:false, authMode:"in"};

/* ---------- helpers ---------- */
const $ = (s,r=document)=>r.querySelector(s);
function h(tag, attrs={}, ...kids){
  const el=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(v==null||v===false) continue;
    if(k==="class") el.className=v;
    else if(k.startsWith("on")) el.addEventListener(k.slice(2),v);
    else if(k==="text") el.textContent=v;
    else el.setAttribute(k, v===true?"":v);
  }
  for(const k of kids.flat()){ if(k==null||k===false) continue; el.append(k.nodeType?k:document.createTextNode(String(k))); }
  return el;
}
const isImage = t => /^image\//.test(t||"");
const nowIso = () => new Date().toISOString();
const rid = () => Math.random().toString(36).slice(2,10);
function fmtDate(iso){ if(!iso) return ""; try{ return new Date(iso).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}); }catch{ return ""; } }
let toastT;
function toast(msg){ clearTimeout(toastT); const o=$(".toast"); if(o) o.remove(); const t=h("div",{class:"toast",role:"status",text:msg}); document.body.append(t); toastT=setTimeout(()=>t.remove(),3400); }
function hasFile(x){ return !!(x && (x.path || x.mock)); }

/* file URLs: mock papers are drawn locally; stored files use short-lived signed URLs */
const urlCache = {}; const pending = new Set();
function urlFor(x){
  if(!x) return null;
  if(x.mock) return window.mockPaper(x.mock, window.SAMPLE_PEOPLE[x.person]||window.SAMPLE_PEOPLE.juan, x.blur);
  if(!x.path) return null;
  const c=urlCache[x.path];
  if(c && c.exp>Date.now()) return c.url;
  if(!pending.has(x.path)){
    pending.add(x.path);
    sb.storage.from(BUCKET).createSignedUrl(x.path, 3600).then(({data})=>{
      pending.delete(x.path);
      if(data?.signedUrl){ urlCache[x.path]={url:data.signedUrl,exp:Date.now()+3500*1000}; render(); }
    });
  }
  return null;
}
function fileType(x){ return x.mock ? "image/jpeg" : x.fileType; }

function statusOf(d,key){ const x=d?.docs?.[key]; if(!x) return "missing"; if(!(hasFile(x)||(key==="nstp"&&x.serial))) return "missing"; return x.status||"submitted"; }
function summary(d){
  const st=REQ.map(r=>statusOf(d,r.key)); const verified=st.filter(s=>s==="verified").length; const onFile=st.filter(s=>s!=="missing").length;
  let overall="incomplete"; if(verified===4) overall="cleared"; else if(onFile===4&&!st.includes("returned")) overall="review";
  return {st,verified,onFile,overall};
}
const mapRow = r => ({id:r.id, name:r.name, studentNo:r.student_no, course:r.course, year:r.year, docs:r.docs||{}, extras:r.extras||[], sample:r.sample});

/* ---------- data ---------- */
async function loadMe(){
  const {data,error}=await sb.from("students").select("*").eq("id",S.uid).maybeSingle();
  if(error) toast("Could not load your record: "+error.message);
  S.me = data ? mapRow(data) : null; S.meLoaded=true; render();
}
async function loadLib(){
  const {data}=await sb.from("library").select("*").eq("owner",S.uid).order("uploaded_at",{ascending:false});
  const m={}; for(const r of data||[]) m[r.id]={title:r.title,category:r.category,path:r.file_path,mock:r.mock,person:r.person,fileName:r.file_name,fileType:r.file_type,uploadedAt:r.uploaded_at,sample:r.sample};
  S.lib=m; render();
}
async function loadStudents(){
  if(!S.isReg) return;
  const {data,error}=await sb.from("students").select("*").order("name");
  if(error){ toast("Could not load the student list."); return; }
  const m={}; for(const r of data||[]) m[r.id]=mapRow(r); S.students=m; render();
}
let channel=null;
function subscribe(){
  if(channel) sb.removeChannel(channel);
  channel=sb.channel("dv-"+S.uid)
    .on("postgres_changes",{event:"*",schema:"public",table:"students"},()=>{ loadMe(); loadStudents(); })
    .on("postgres_changes",{event:"*",schema:"public",table:"library"},()=>loadLib())
    .subscribe();
}
async function saveMe(patch){
  const {error}=await sb.from("students").update({...patch,updated_at:nowIso()}).eq("id",S.uid);
  if(error) throw error;
  await loadMe();
}

/* ---------- auth ---------- */
async function onSession(session){
  S.session=session; S.uid=session?.user?.id||null; S.email=session?.user?.email||"";
  if(!S.uid){ S.me=null; S.meLoaded=false; S.lib={}; S.students={}; S.isReg=false; render(); return; }
  const {data}=await sb.rpc("is_registrar"); S.isReg=!!data;
  await Promise.all([loadMe(), loadLib(), loadStudents()]);
  subscribe();
}
sb.auth.onAuthStateChange((_e,session)=>{ if((session?.user?.id||null)!==S.uid) onSession(session); });
sb.auth.getSession().then(({data})=>onSession(data.session));

function authView(){
  const up=S.authMode==="up";
  const f=h("form",{class:"card",style:"margin:24px auto"},
    h("h2",{style:"font-size:1.6rem;margin-bottom:6px",text:up?"Create your account":"Sign in"}),
    h("p",{style:"margin:0 0 18px;color:var(--muted);font-size:.9rem",text:"Store your Form 137, Form 138, NSTP serial number, PSA and any other papers in one safe place, and see right away what you still need for graduation."}),
    h("div",{style:"display:grid;gap:12px"},
      h("label",{class:"f"},"Email",h("input",{type:"email",id:"a-email",required:true,autocomplete:"email",placeholder:"you@example.com"})),
      h("label",{class:"f"},"Password",h("input",{type:"password",id:"a-pass",required:true,minlength:"6",autocomplete:up?"new-password":"current-password",placeholder:"At least 6 characters"})),
      h("div",{class:"row"},h("button",{class:"btn primary",type:"submit",id:"a-go"},up?"Create account":"Sign in"),
        h("button",{class:"btn ghost",type:"button",onclick:()=>{S.authMode=up?"in":"up";render();}},up?"I already have an account":"Create an account"))));
  f.addEventListener("submit",async e=>{
    e.preventDefault(); $("#a-go").disabled=true;
    const email=$("#a-email").value.trim(), password=$("#a-pass").value;
    const res = up ? await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin}}) : await sb.auth.signInWithPassword({email,password});
    $("#a-go").disabled=false;
    if(res.error){ toast(res.error.message); return; }
    if(up && !res.data.session) toast("Account created. Check your email to confirm, then sign in.");
  });
  return f;
}

/* ---------- root render ---------- */
function render(){
  const who=$("#who"); who.replaceChildren();
  const signedIn=!!S.uid;
  if(signedIn){
    who.append(h("span",{class:"chip",text:S.isReg?"Registrar":"Student"}),
      h("span",{class:"mail",text:S.email}),
      h("button",{class:"btn ghost light",type:"button",onclick:()=>sb.auth.signOut()},"Sign out"));
  }
  $("#tabbar").hidden=!signedIn;
  $("#tab-reg").hidden=!S.isReg;
  for(const v of ["me","docs","reg"]){ $("#tab-"+v).setAttribute("aria-selected",S.view===v); $("#view-"+v).hidden=!signedIn||S.view!==v; }
  $("#view-auth").hidden=signedIn;
  if(!signedIn){ $("#view-auth").replaceChildren(authView()); renderOverlay(); return; }
  if(S.view==="me") renderMe(); else if(S.view==="docs") renderDocs(); else renderReg();
  renderOverlay();
}
$("#tab-me").onclick=()=>{S.view="me";render();};
$("#tab-docs").onclick=()=>{S.view="docs";render();};
$("#tab-reg").onclick=()=>{S.view="reg";render();};

/* ---------- requirements view ---------- */
function renderMe(){
  const root=$("#view-me"); root.replaceChildren();
  if(!S.meLoaded){ root.append(h("p",{class:"empty-line",text:"Opening your records…"})); return; }
  if(!S.me||S.editing){ root.append(profileForm(S.editing?S.me:null)); return; }
  const d=S.me, sm=summary(d);
  root.append(
    h("div",{class:"me-head"},
      h("div",{},h("h2",{text:d.name}),
        h("div",{class:"meta"},h("span",{class:"mono",text:d.studentNo})," · ",d.course," · ",d.year," · ",
          h("button",{class:"linkbtn",type:"button",onclick:()=>{S.editing=true;render();}},"Edit details"))),
      h("div",{class:"meter"},
        h("div",{class:"lbl"},h("span",{},h("b",{text:sm.verified+" of 4"})," papers verified"),
          h("span",{text:sm.overall==="cleared"?"Cleared for graduation":sm.overall==="review"?"Waiting for registrar":"Incomplete"})),
        h("div",{class:"track"},sm.st.map(s=>h("span",{class:s,title:LABEL[s]}))))),
    h("div",{class:"sec-title"},h("h3",{text:"Graduation requirements"}),h("p",{text:"Upload a clear photo or PDF of each paper. The registrar checks it and marks it verified."})),
    h("div",{class:"folders"},REQ.map(r=>reqCard(r,d))),
    h("div",{class:"sec-title"},h("h3",{text:"Other documents for the registrar"}),h("p",{},"Extra papers the registrar can see. For everything else, use ",h("button",{class:"linkbtn",type:"button",onclick:()=>{S.view="docs";render();}},"My documents"),".")),
    extrasBlock(d));
}
function profileForm(cur){
  const f=h("form",{class:"card"},
    h("h2",{style:"font-size:1.5rem;margin-bottom:6px",text:cur?"Edit your details":"Set up your record"}),
    h("p",{style:"margin:0 0 18px;color:var(--muted);font-size:.9rem",text:"Enter your details once. Your papers are saved under this record and only you and the registrar can see them."}),
    h("div",{style:"display:grid;gap:12px"},
      h("label",{class:"f"},"Full name",h("input",{type:"text",id:"p-name",required:true,placeholder:"Juan M. Dela Cruz",maxlength:"80",value:cur?.name||""})),
      h("div",{class:"grid2"},
        h("label",{class:"f"},"Student number",h("input",{type:"text",id:"p-no",required:true,placeholder:"2025-0000",maxlength:"20",value:cur?.studentNo||""})),
        h("label",{class:"f"},"Year level",h("select",{id:"p-year"},["1st Year","2nd Year","3rd Year","4th Year"].map(y=>h("option",{text:y,selected:cur?.year===y}))))),
      h("label",{class:"f"},"Course",h("select",{id:"p-course"},COURSES.map(c=>h("option",{text:c,selected:cur?.course===c})))),
      h("div",{class:"row"},h("button",{class:"btn primary",type:"submit",id:"p-save"},cur?"Save changes":"Create my record"),
        cur?h("button",{class:"btn ghost",type:"button",onclick:()=>{S.editing=false;render();}},"Cancel"):
          h("button",{class:"btn",type:"button",onclick:loadSampleRecord},"Try with a sample record"))));
  f.addEventListener("submit",async e=>{
    e.preventDefault();
    const name=$("#p-name").value.trim(), no=$("#p-no").value.trim();
    if(!name||!no){ toast("Enter your full name and student number."); return; }
    $("#p-save").disabled=true;
    const fields={name,student_no:no,course:$("#p-course").value,year:$("#p-year").value};
    try{
      if(cur){ await saveMe(fields); S.editing=false; toast("Details saved."); render(); }
      else{
        const {error}=await sb.from("students").insert({id:S.uid,...fields,docs:{},extras:[]});
        if(error) throw error; await loadMe(); toast("Record created.");
      }
    }catch(err){ $("#p-save").disabled=false; toast("Could not save: "+err.message); }
  });
  return f;
}
async function loadSampleRecord(){
  const t=nowIso();
  const docs={form138:{mock:"form138",person:"juan",fileName:"Form138_sample.jpg",uploadedAt:t},
    nstp:{serial:"C-0626-NIR-004517",mock:"nstp",person:"juan",fileName:"NSTP_sample.jpg",uploadedAt:t}};
  const {error}=await sb.from("students").insert({id:S.uid,name:"Juan M. Dela Cruz",student_no:"2025-0388",course:"BS Information Technology",year:"2nd Year",
    docs,extras:[{id:rid(),title:"Dean's List Certificate (sample)",category:"Certificates & awards",mock:"deanslist",person:"juan",fileName:"DeansList_sample.jpg",uploadedAt:t}],sample:true});
  if(error){ toast("Could not create the sample: "+error.message); return; }
  await loadMe(); toast("Sample record created. Edit details to put in your own.");
}

function thumb(x,label,cls="thumb"){
  if(!hasFile(x)) return null;
  const url=urlFor(x);
  if(!url) return h("div",{class:cls},h("span",{text:"Loading…"}));
  if(fileType(x)==="application/pdf"||(!isImage(fileType(x))&&!x.mock)) return h("a",{class:cls,href:url,target:"_blank",rel:"noopener"},h("span",{class:"ftype",text:((fileType(x)||"file").split("/").pop()||"FILE").toUpperCase()+" · open"}));
  return h("button",{class:cls,type:"button",title:"View "+label,onclick:()=>openViewer(url,label)},h("img",{src:url,alt:label,loading:"lazy"}));
}
function fileBtn(id,label,primary,onfile,busy){
  const input=h("input",{type:"file",id,class:"file-in",accept:ACCEPT,onchange:e=>onfile(e.target.files[0])});
  return [input,h("label",{class:"btn"+(primary?" primary":""),for:id,role:"button",tabindex:"0",onkeydown:e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();input.click();}}},busy?"Uploading…":label)];
}
function reqCard(r,d){
  const x=(d.docs||{})[r.key]||{}, st=statusOf(d,r.key), busy=S.busy[r.key];
  const card=h("article",{class:"folder","data-tab":r.tab},
    h("div",{class:"row",style:"justify-content:space-between"},h("h4",{text:r.title}),h("span",{class:"pill s-"+st,text:LABEL[st]})),
    h("p",{class:"desc",text:r.desc}));
  if(r.serial){
    if(x.serial) card.append(h("div",{class:"serial",text:x.serial}));
    const inp=h("input",{type:"text",id:"serial-in",placeholder:"e.g. C-0624-NIR-001842",value:x.serial||"",maxlength:"40"});
    card.append(h("label",{class:"f"},x.serial?"Change serial number":"Type your serial number",inp),
      h("div",{class:"row"},h("button",{class:"btn primary",type:"button",disabled:busy,onclick:()=>saveSerial(inp.value)},x.serial?"Update":"Save serial")));
  }
  const th=thumb(x,r.title);
  if(th) card.append(th); else if(!r.serial) card.append(h("div",{class:"thumb empty"},h("span",{text:"No file yet"})));
  if(x.note&&st==="returned") card.append(h("div",{class:"note",text:"Registrar: "+x.note}));
  card.append(h("div",{class:"row"},...fileBtn("up-"+r.key,hasFile(x)?"Replace file":(r.serial?"Attach certificate":"Upload file"),!r.serial,f=>uploadReq(r.key,f),busy),
    x.uploadedAt?h("span",{class:"fname",text:"Uploaded "+fmtDate(x.uploadedAt)}):null));
  return card;
}
async function uploadFile(file){
  if(file.size>MAX_BYTES) throw new Error("That file is over 20 MB. Take a smaller photo or compress the PDF.");
  const safe=file.name.replace(/[^A-Za-z0-9._-]+/g,"_").slice(-80);
  const path=`${S.uid}/${Date.now()}-${safe}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type||"application/octet-stream",upsert:false});
  if(error) throw error;
  return {path,fileName:file.name,fileType:file.type||"application/octet-stream",size:file.size};
}
async function uploadReq(key,file){
  if(!file) return;
  S.busy[key]=true; render();
  try{
    const f=await uploadFile(file);
    const old=S.me.docs[key]||{};
    const docs={...S.me.docs,[key]:{...(key==="nstp"&&old.serial?{serial:old.serial}:{}),...f,uploadedAt:nowIso()}};
    await saveMe({docs});
    if(old.path) sb.storage.from(BUCKET).remove([old.path]);
    toast("Uploaded. The registrar will review it.");
  }catch(e){ toast(e.message||"Upload failed. Try again."); }
  S.busy[key]=false; render();
}
async function saveSerial(v){
  v=v.trim().toUpperCase(); if(!v){ toast("Type your NSTP serial number first."); return; }
  S.busy.nstp=true; render();
  try{ const old=S.me.docs.nstp||{}; await saveMe({docs:{...S.me.docs,nstp:{...old,serial:v,uploadedAt:nowIso()}}}); toast("Serial number saved."); }
  catch(e){ toast("Could not save: "+e.message); }
  S.busy.nstp=false; render();
}
function confirmBtn(label,fn){
  const b=h("button",{class:"btn ghost",type:"button",text:label}); let armed=false,t;
  b.onclick=()=>{ if(!armed){ armed=true; b.textContent="Tap again to remove"; b.className="btn bad"; t=setTimeout(()=>{armed=false;b.textContent=label;b.className="btn ghost";},3500); return; } clearTimeout(t); fn(); };
  return b;
}
function extrasBlock(d){
  const list=d.extras||[], wrap=h("div",{class:"extras"});
  if(!list.length) wrap.append(h("p",{class:"empty-line",text:"No other documents yet. Add one below."}));
  for(const x of list){
    const url=urlFor(x);
    const mini=url?(isImage(fileType(x))?h("button",{class:"mini",type:"button",onclick:()=>openViewer(url,x.title)},h("img",{src:url,alt:x.title,loading:"lazy"})):h("a",{class:"mini",href:url,target:"_blank",rel:"noopener"},"FILE")):h("div",{class:"mini"},"…");
    wrap.append(h("div",{class:"extra"},mini,h("div",{},h("b",{text:x.title}),h("span",{class:"fname",text:(x.fileName||"")+(x.uploadedAt?" · "+fmtDate(x.uploadedAt):"")})),
      h("div",{class:"acts row"},confirmBtn("Remove",()=>removeExtra(x.id)))));
  }
  const title=h("input",{type:"text",id:"x-title",placeholder:"Document name, e.g. Good Moral Certificate",maxlength:"80"});
  wrap.append(h("div",{class:"add"},h("label",{class:"f"},"Add another document",title),
    h("div",{class:"row"},...fileBtn("x-file","Choose file & save",true,f=>addExtra(title.value,f,"School records"),S.busy.extra))));
  return wrap;
}
async function addExtra(title,file,category){
  title=(title||"").trim(); if(!file) return;
  if(!title){ toast("Name the document first, then choose the file."); const i=$("#x-file"); if(i) i.value=""; return; }
  S.busy.extra=true; render();
  try{ const f=await uploadFile(file); await saveMe({extras:[...(S.me.extras||[]),{id:rid(),title,category,...f,uploadedAt:nowIso()}]}); toast("Saved “"+title+"”."); }
  catch(e){ toast(e.message||"Upload failed."); }
  S.busy.extra=false; render();
}
async function removeExtra(id){
  const x=(S.me.extras||[]).find(e=>e.id===id);
  try{ await saveMe({extras:(S.me.extras||[]).filter(e=>e.id!==id)}); if(x?.path) sb.storage.from(BUCKET).remove([x.path]); toast("Removed."); }
  catch(e){ toast("Could not remove: "+e.message); }
}

/* ---------- my documents ---------- */
function libraryItems(){
  const items=[], d=S.me;
  if(d){
    for(const r of REQ){ const x=(d.docs||{})[r.key]; const st=statusOf(d,r.key); if(st==="missing"||!hasFile(x)) continue;
      items.push({kind:"req",id:"req-"+r.key,title:r.title,category:"School records",...x,status:st}); }
    for(const x of d.extras||[]) items.push({kind:"shared",category:x.category||"School records",...x});
  }
  for(const [id,x] of Object.entries(S.lib||{})) items.push({kind:"private",...x,id});
  return items.sort((a,b)=>(b.uploadedAt||"").localeCompare(a.uploadedAt||""));
}
function renderDocs(){
  const root=$("#view-docs"); root.replaceChildren(); const all=libraryItems();
  root.append(h("div",{class:"me-head"},
    h("div",{},h("h2",{text:"My documents"}),h("div",{class:"meta",text:"Every paper you have in the system: registrar requirements, papers you shared with the registrar, and your own private files."})),
    h("div",{class:"meta"},h("b",{class:"mono",style:"font-size:1.4rem;color:var(--ink)",text:all.length})," documents stored")));
  const title=h("input",{type:"text",id:"l-title",placeholder:"e.g. School ID, Dean's List certificate, receipt",maxlength:"80"});
  const cat=h("select",{id:"l-cat"},CATS.map(c=>h("option",{text:c})));
  const share=h("input",{type:"checkbox",id:"l-share",disabled:!S.me});
  root.append(h("div",{class:"uploader"},h("label",{class:"f"},"Document name",title),h("label",{class:"f"},"Category",cat),
    h("div",{class:"row"},...fileBtn("l-file","Choose file & upload",true,f=>addLibrary(title.value,cat.value,share.checked,f),S.busy.lib)),
    h("label",{class:"share"},share,S.me?"Let the registrar see this document":"Set up your record under Requirements to share files with the registrar. Files you upload here stay private.")));
  root.append(h("p",{class:"fname",style:"margin:8px 2px 0",text:"Photos, PDFs, short videos or text files up to 20 MB. Private files are not listed for the registrar."}));
  const groups=[["all","All"],["req","Requirements"],["shared","Shared with registrar"],["private","Private"]];
  const n=k=>k==="all"?all.length:all.filter(i=>i.kind===k).length;
  const q=h("input",{type:"text",id:"l-q",placeholder:"Search documents",value:S.libQ}); q.addEventListener("input",()=>{S.libQ=q.value;draw();});
  root.append(h("div",{class:"filters"},groups.map(([k,l])=>h("button",{class:"fchip",type:"button","aria-pressed":S.libFilter===k,onclick:()=>{S.libFilter=k;render();}},l,h("b",{text:n(k)}))),q));
  const grid=h("div",{class:"lib"}); root.append(grid); draw();
  function draw(){
    const qq=S.libQ.trim().toLowerCase();
    const vis=all.filter(i=>(S.libFilter==="all"||i.kind===S.libFilter)&&(!qq||(i.title||"").toLowerCase().includes(qq)||(i.category||"").toLowerCase().includes(qq)));
    grid.replaceChildren();
    if(!all.length){ grid.append(h("div",{class:"empty-line"},"No documents yet. Upload your first one above, or ",h("button",{class:"linkbtn",type:"button",onclick:loadSampleLibrary},"add sample documents"),".")); return; }
    if(!vis.length){ grid.append(h("p",{class:"empty-line",text:"No documents match."})); return; }
    const SRC={req:"Requirement",shared:"Shared with registrar",private:"Private"};
    for(const i of vis){
      grid.append(h("article",{class:"tile"},thumb(i,i.title)||h("div",{class:"thumb"},h("span",{text:"Serial "+(i.serial||"")})),h("div",{class:"body"},
        h("span",{class:"src "+i.kind,text:SRC[i.kind]}),h("b",{text:i.title}),
        h("span",{class:"fname",text:(i.category||"")+(i.uploadedAt?" · "+fmtDate(i.uploadedAt):"")}),
        h("div",{class:"foot"},i.kind==="req"?h("span",{class:"pill s-"+i.status,text:LABEL[i.status]}):h("span"),
          i.kind==="req"?h("button",{class:"linkbtn",type:"button",onclick:()=>{S.view="me";render();}},"Manage"):
            confirmBtn("Remove",()=>i.kind==="shared"?removeExtra(i.id):removeLibrary(i.id,i.path))))));
    }
  }
}
async function addLibrary(title,category,shared,file){
  title=(title||"").trim(); if(!file) return;
  if(!title){ toast("Name the document first, then choose the file."); $("#l-file").value=""; return; }
  S.busy.lib=true; render();
  try{
    const f=await uploadFile(file);
    if(shared&&S.me){ await saveMe({extras:[...(S.me.extras||[]),{id:rid(),title,category,...f,uploadedAt:nowIso()}]}); }
    else{ const {error}=await sb.from("library").insert({owner:S.uid,title,category,file_path:f.path,file_name:f.fileName,file_type:f.fileType}); if(error) throw error; await loadLib(); }
    toast("Saved “"+title+"”.");
  }catch(e){ toast(e.message||"Upload failed."); }
  S.busy.lib=false; render();
}
async function removeLibrary(id,path){
  const {error}=await sb.from("library").delete().eq("id",id);
  if(error){ toast("Could not remove: "+error.message); return; }
  if(path) sb.storage.from(BUCKET).remove([path]);
  await loadLib(); toast("Removed.");
}
async function loadSampleLibrary(){
  const rows=[["Cybersecurity Seminar Certificate (sample)","Certificates & awards","seminar"],["Official Receipt - Midterm Tuition (sample)","Receipts & payments","receipt"],
    ["Youth Camp Certificate (sample)","Church & organizations","camp"]].map(([title,category,mock])=>({owner:S.uid,title,category,mock,person:"juan",file_name:mock+"_sample.jpg",file_type:"image/jpeg",sample:true}));
  const {error}=await sb.from("library").insert(rows);
  if(error){ toast("Could not add samples: "+error.message); return; }
  await loadLib(); toast("Added 3 sample documents.");
}

/* ---------- registrar ---------- */
function renderReg(){
  const root=$("#view-reg"); root.replaceChildren();
  const rows=Object.entries(S.students).map(([id,d])=>({id,d,sm:summary(d)}));
  const count=k=>k==="all"?rows.length:rows.filter(r=>r.sm.overall===k).length;
  root.append(h("div",{class:"stats"},[["all","Students"],["cleared","Cleared"],["review","For review"],["incomplete","Incomplete"]].map(([k,l])=>
    h("button",{class:"stat",type:"button","aria-pressed":S.filter===k,onclick:()=>{S.filter=k;render();}},h("b",{text:count(k)}),h("span",{text:l})))));
  const q=h("input",{type:"text",id:"reg-q",placeholder:"Search name or student number",value:S.q}); q.addEventListener("input",()=>{S.q=q.value;table();});
  root.append(h("div",{class:"tools"},q)); const tw=h("div",{class:"ledger-wrap"}); root.append(tw);
  root.append(h("div",{class:"legend"},["verified","submitted","returned","missing"].map(s=>h("span",{},h("i",{class:"dot "+s}),LABEL[s]))));
  table();
  function table(){
    const qq=S.q.trim().toLowerCase();
    const vis=rows.filter(r=>(S.filter==="all"||r.sm.overall===S.filter)&&(!qq||(r.d.name||"").toLowerCase().includes(qq)||(r.d.studentNo||"").toLowerCase().includes(qq)));
    tw.replaceChildren();
    if(!rows.length){ tw.append(h("p",{class:"empty-line",style:"padding:18px",text:"No student records yet."})); return; }
    if(!vis.length){ tw.append(h("p",{class:"empty-line",style:"padding:18px",text:"No students match this filter."})); return; }
    const ov={cleared:["verified","Cleared"],review:["submitted","For review"],incomplete:["missing","Incomplete"]};
    tw.append(h("table",{},h("thead",{},h("tr",{},h("th",{text:"Student"}),h("th",{text:"Course"}),REQ.map(r=>h("th",{class:"c",text:r.tab})),h("th",{class:"c",text:"Others"}),h("th",{text:"Status"}))),
      h("tbody",{},vis.map(r=>h("tr",{tabindex:"0",onclick:()=>{S.open=r.id;render();},onkeydown:e=>{if(e.key==="Enter"){S.open=r.id;render();}}},
        h("td",{},h("b",{text:r.d.name||"Unnamed"}),r.d.sample?h("span",{class:"tag",text:"SAMPLE"}):null,h("div",{class:"fname mono",text:r.d.studentNo||""})),
        h("td",{},h("span",{text:r.d.course||""}),h("div",{class:"fname",text:r.d.year||""})),
        r.sm.st.map((s,i)=>h("td",{class:"c",title:REQ[i].title+": "+LABEL[s]},h("i",{class:"dot "+s}))),
        h("td",{class:"c mono",text:(r.d.extras||[]).length}),
        h("td",{},h("span",{class:"pill s-"+ov[r.sm.overall][0],text:ov[r.sm.overall][1]})))))));
  }
}
let viewerState=null;
function openViewer(url,title){ viewerState={url,title}; renderOverlay(); }
function renderOverlay(){
  const ov=$("#overlay"); ov.replaceChildren();
  if(S.open&&S.students[S.open]) ov.append(h("div",{class:"scrim",onclick:()=>{S.open=null;render();}}),drawer(S.open,S.students[S.open]));
  if(viewerState) ov.append(h("div",{class:"viewer",role:"dialog","aria-label":viewerState.title},
    h("header",{},h("b",{text:viewerState.title}),h("div",{class:"row"},
      viewerState.url.startsWith("data:")?null:h("a",{class:"btn",href:viewerState.url,target:"_blank",rel:"noopener"},"Open full size"),
      h("button",{class:"btn",type:"button",onclick:()=>{viewerState=null;renderOverlay();}},"Close"))),
    h("div",{class:"stage"},h("img",{src:viewerState.url,alt:viewerState.title}))));
}
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ if(viewerState){viewerState=null;renderOverlay();} else if(S.open){S.open=null;render();} }});
function mini(x,label){
  const url=urlFor(x);
  if(!hasFile(x)) return h("div",{class:"mini",text:x?.serial?"No scan":"None"});
  if(!url) return h("div",{class:"mini",text:"…"});
  if(!isImage(fileType(x))) return h("a",{class:"mini",href:url,target:"_blank",rel:"noopener"},"FILE");
  return h("button",{class:"mini",type:"button",onclick:()=>openViewer(url,label)},h("img",{src:url,alt:label,loading:"lazy"}));
}
function drawer(id,d){
  const sm=summary(d);
  const el=h("aside",{class:"drawer",role:"dialog","aria-label":"Papers of "+(d.name||"student")},
    h("div",{class:"row",style:"justify-content:space-between"},h("span",{class:"fname mono",text:d.studentNo||""}),h("button",{class:"btn ghost",type:"button",onclick:()=>{S.open=null;render();}},"Close")),
    h("h3",{text:d.name||"Unnamed"}),h("p",{style:"margin:2px 0 6px;color:var(--muted)",text:[d.course,d.year].filter(Boolean).join(" · ")}),
    h("div",{class:"meter",style:"max-width:none"},h("div",{class:"lbl"},h("span",{},h("b",{text:sm.verified+" of 4"})," verified")),h("div",{class:"track"},sm.st.map(s=>h("span",{class:s})))),
    h("div",{class:"sec-title",style:"margin-top:22px"},h("h3",{style:"font-size:1.1rem",text:"Required papers"})));
  for(const r of REQ){
    const x=(d.docs||{})[r.key]||{}, st=statusOf(d,r.key), can=st!=="missing";
    const noteIn=h("input",{type:"text",placeholder:"Reason for returning (shown to student)",maxlength:"160"});
    el.append(h("div",{class:"d-doc"},mini(x,d.name+" · "+r.title),h("div",{},
      h("div",{class:"row",style:"justify-content:space-between"},h("b",{text:r.title}),h("span",{class:"pill s-"+st,text:LABEL[st]})),
      r.serial&&x.serial?h("div",{class:"serial",style:"font-size:.92rem;padding:5px 8px",text:x.serial}):null,
      x.uploadedAt?h("span",{class:"fname",text:"Submitted "+fmtDate(x.uploadedAt)+(x.fileName?" · "+x.fileName:"")}):null,
      x.note&&st==="returned"?h("div",{class:"note",text:x.note}):null, can?noteIn:null,
      can?h("div",{class:"row"},h("button",{class:"btn ok",type:"button",disabled:st==="verified",onclick:()=>review(id,r.key,"verified","")},"Mark verified"),
        h("button",{class:"btn bad",type:"button",onclick:()=>review(id,r.key,"returned",noteIn.value.trim()||"Please re-submit a clear, complete copy.")},"Return to student")):null)));
  }
  el.append(h("div",{class:"sec-title",style:"margin-top:22px"},h("h3",{style:"font-size:1.1rem",text:"Other documents"})));
  const ex=d.extras||[]; if(!ex.length) el.append(h("p",{class:"empty-line",text:"None stored."}));
  for(const x of ex) el.append(h("div",{class:"d-doc"},mini(x,d.name+" · "+x.title),h("div",{},h("b",{text:x.title}),h("span",{class:"fname",text:(x.fileName||"")+(x.uploadedAt?" · "+fmtDate(x.uploadedAt):"")}))));
  return el;
}
async function review(id,key,status,note){
  const d=S.students[id]; const docs={...d.docs,[key]:{...(d.docs[key]||{}),status,note,reviewedAt:nowIso()}};
  const {error}=await sb.from("students").update({docs,updated_at:nowIso()}).eq("id",id);
  if(error){ toast("Could not save the review: "+error.message); return; }
  await loadStudents(); if(id===S.uid) loadMe();
  toast(status==="verified"?"Marked verified.":"Returned to student with your note.");
}
render();
