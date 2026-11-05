import { useState, useEffect, useMemo } from "react";

const T = {
  loginBg:"#000000", loginSurface:"#111111", loginBorder:"#2a2a2a",
  pageBg:"#F0F4F8", white:"#FFFFFF", surface:"#F7F9FC",
  ocean:"#0B6E9E", oceanDark:"#084D6E", oceanMid:"#1A8ABF", oceanLight:"#E6F3FA",
  gold:"#C8960C", goldLight:"#F5C842", goldBg:"#FDF8E7",
  green:"#1A7F4B", greenBg:"#E8F7EF",
  red:"#C0392B", redBg:"#FDECEA",
  amber:"#B45309", amberBg:"#FEF3C7",
  textDark:"#0D1B2A", textMid:"#4A6080", textLight:"#8FA3B8",
  border:"#D8E4EE", divider:"#EBF0F5",
};

const DB = {
  get:(k,d)=>{ try{const r=localStorage.getItem(k);return r?JSON.parse(r):d;}catch{return d;} },
  set:(k,v)=>{ try{localStorage.setItem(k,JSON.stringify(v));}catch{} },
};
const EMPTY={villages:[],borrowers:{}};
const fmt=n=>`₹${Number(n||0).toLocaleString("en-IN")}`;
const todayStr=()=>new Date().toISOString().split("T")[0];
const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const dateLabel=d=>{ try{return new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});}catch{return d;} };
const dayName=d=>{ try{return DAYS[new Date(d+"T00:00:00").getDay()];}catch{return "";} };
const getMondayOfWeek=dateStr=>{ const d=new Date(dateStr+"T00:00:00"); const day=d.getDay(); const diff=day===0?-6:1-day; d.setDate(d.getDate()+diff); return d.toISOString().split("T")[0]; };
// FIX 3: Include ALL weeks from collections (any day Mon-Sun)
const getWeeksList=collections=>{ const m=new Set(); Object.values(collections).forEach(c=>{if(c.date)m.add(getMondayOfWeek(c.date));}); return Array.from(m).sort((a,b)=>b.localeCompare(a)); };

const CSS=`
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
body{margin:0;background:#F0F4F8;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;}
input,select,textarea,button{font-family:inherit;}
input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-thumb{background:#D8E4EE;border-radius:4px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes pop{0%{transform:scale(0.8)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-9px)}75%{transform:translateX(9px)}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234A6080' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;}
`;

// ── ATOMS ──
const Card=({children,style={},onClick})=>(
  <div onClick={onClick} style={{background:"#fff",borderRadius:16,border:"1px solid #D8E4EE",boxShadow:"0 1px 6px #0B6E9E08",padding:16,marginBottom:12,...style}}>{children}</div>
);
const Row=({children,style={}})=>(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",...style}}>{children}</div>);
const Btn=({children,onClick,variant="primary",style={},disabled=false})=>{
  const base={padding:"13px 18px",borderRadius:12,border:"none",cursor:disabled?"not-allowed":"pointer",fontWeight:700,fontSize:14,transition:"all 0.18s",opacity:disabled?0.5:1,...style};
  const vs={
    primary:{...base,background:`linear-gradient(135deg,#1A8ABF,#084D6E)`,color:"#fff",boxShadow:"0 3px 14px #0B6E9E28"},
    gold:{...base,background:`linear-gradient(135deg,#F5C842,#C8960C)`,color:"#fff",boxShadow:"0 3px 14px #C8960C30"},
    outline:{...base,background:"#fff",color:"#0B6E9E",border:"1.5px solid #0B6E9E"},
    white:{...base,background:"#fff",color:"#0D1B2A",border:"1px solid #D8E4EE",boxShadow:"0 1px 4px #0002"},
    danger:{...base,background:"#FDECEA",color:"#C0392B",border:"1px solid #C0392B30"},
    ghost:{...base,background:"#E6F3FA",color:"#0B6E9E",border:"1px solid #D8E4EE"},
  };
  return <button onClick={disabled?undefined:onClick} style={vs[variant]||vs.primary}>{children}</button>;
};
const Inp=({label,value,onChange,type="text",placeholder="",style={},note=""})=>(
  <div style={{marginBottom:14}}>
    {label&&<div style={{fontSize:11,fontWeight:700,color:"#8FA3B8",marginBottom:5,textTransform:"uppercase",letterSpacing:0.7}}>{label}</div>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #D8E4EE",background:"#F7F9FC",color:"#0D1B2A",fontSize:15,outline:"none",transition:"border 0.2s",...style}}
      onFocus={e=>e.target.style.borderColor="#0B6E9E"} onBlur={e=>e.target.style.borderColor="#D8E4EE"}/>
    {note&&<div style={{fontSize:11,color:"#8FA3B8",marginTop:4}}>{note}</div>}
  </div>
);
const Sel=({label,value,onChange,children,style={}})=>(
  <div style={{marginBottom:14}}>
    {label&&<div style={{fontSize:11,fontWeight:700,color:"#8FA3B8",marginBottom:5,textTransform:"uppercase",letterSpacing:0.7}}>{label}</div>}
    <select value={value} onChange={onChange}
      style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #D8E4EE",background:"#F7F9FC",color:"#0D1B2A",fontSize:15,outline:"none",...style}}
      onFocus={e=>e.target.style.borderColor="#0B6E9E"} onBlur={e=>e.target.style.borderColor="#D8E4EE"}>
      {children}
    </select>
  </div>
);
const Chip=({children,color="#0B6E9E",bg="#E6F3FA"})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:4,background:bg,color,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{children}</span>
);
const SecLabel=({children,style={}})=>(
  <div style={{fontSize:11,fontWeight:800,color:"#8FA3B8",letterSpacing:1.2,textTransform:"uppercase",marginBottom:10,marginTop:4,...style}}>{children}</div>
);
const Sheet=({open,onClose,title,children})=>{
  if(!open) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"#00000060",zIndex:600,display:"flex",alignItems:"flex-end",justifyContent:"center",animation:"fadeIn 0.2s ease"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",borderRadius:"22px 22px 0 0",padding:"20px 18px 36px",width:"100%",maxWidth:480,maxHeight:"93vh",overflowY:"auto",animation:"slideUp 0.28s ease"}}>
        <Row style={{marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:16,color:"#0D1B2A"}}>{title}</div>
          <button onClick={onClose} style={{background:"#F7F9FC",border:"1px solid #D8E4EE",borderRadius:20,width:32,height:32,cursor:"pointer",fontSize:16,color:"#8FA3B8",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </Row>
        {children}
      </div>
    </div>
  );
};
const Toast=({msg,type="success"})=>{
  if(!msg) return null;
  const bg=type==="success"?"#1A7F4B":type==="error"?"#C0392B":"#C8960C";
  return <div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:bg,color:"#fff",padding:"10px 22px",borderRadius:24,fontWeight:700,fontSize:13,zIndex:999,boxShadow:"0 4px 24px #0004",animation:"fadeUp 0.28s ease",whiteSpace:"nowrap",pointerEvents:"none"}}>{msg}</div>;
};
const Nav=({title,onBack,right})=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",background:"#fff",borderBottom:"1px solid #EBF0F5",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px #0B6E9E0A"}}>
    <div style={{width:38}}>{onBack&&<button onClick={onBack} style={{width:36,height:36,borderRadius:18,border:"1px solid #D8E4EE",background:"#F7F9FC",cursor:"pointer",fontSize:20,color:"#0B6E9E",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>}</div>
    <div style={{flex:1,textAlign:"center",fontSize:16,fontWeight:800,color:"#0D1B2A"}}>{title}</div>
    <div style={{width:38,display:"flex",justifyContent:"flex-end"}}>{right||null}</div>
  </div>
);

// ── PIN SCREEN ──
function PinScreen({storedPin,onUnlock}){
  const [pin,setPin]=useState(""); const [err,setErr]=useState(""); const [shake,setShake]=useState(false);
  const press=k=>{
    if(k==="del"){setPin(p=>p.slice(0,-1));setErr("");return;}
    if(pin.length>=4) return;
    const np=pin+k; setPin(np);
    if(np.length===4) setTimeout(()=>{
      if(np===storedPin){onUnlock();}
      else{setShake(true);setErr("Incorrect PIN. Try again.");setPin("");setTimeout(()=>setShake(false),400);}
    },150);
  };
  const keys=["1","2","3","4","5","6","7","8","9","","0","del"];
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#000",padding:28,gap:36}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:70,height:2,background:"linear-gradient(90deg,transparent,#F5C842,transparent)",borderRadius:4,margin:"0 auto 22px"}}/>
        <div style={{fontSize:26,fontWeight:900,color:"#F5C842",letterSpacing:0.5,marginBottom:6}}>Sri Lakshmi Ganapati</div>
        <div style={{fontSize:12,color:"#444",letterSpacing:2.5,textTransform:"uppercase",fontWeight:600}}>Village Finance Manager</div>
        <div style={{width:70,height:2,background:"linear-gradient(90deg,transparent,#F5C842,transparent)",borderRadius:4,margin:"22px auto 0"}}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:18}}>
        <div style={{fontSize:11,color:"#555",fontWeight:600,letterSpacing:2,textTransform:"uppercase"}}>Enter PIN</div>
        <div style={{display:"flex",gap:18,animation:shake?"shake 0.35s ease":"none"}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:14,height:14,borderRadius:7,background:i<pin.length?"#F5C842":"transparent",border:`2px solid ${i<pin.length?"#F5C842":"#333"}`,transition:"all 0.2s"}}/>)}
        </div>
        {err&&<div style={{color:"#F5C842",fontSize:13,fontWeight:700}}>{err}</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,80px)",gap:12}}>
        {keys.map((k,i)=>k===""?<div key={i}/>:(
          <button key={i} onClick={()=>press(k)}
            style={{width:80,height:80,borderRadius:40,background:"#111",border:"1px solid #2a2a2a",color:k==="del"?"#F5C842":"#fff",fontSize:k==="del"?20:26,fontWeight:500,cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center"}}
            onMouseDown={e=>{e.currentTarget.style.background="#1f1a00";e.currentTarget.style.borderColor="#F5C842";}}
            onMouseUp={e=>{e.currentTarget.style.background="#111";e.currentTarget.style.borderColor="#2a2a2a";}}
            onTouchStart={e=>{e.currentTarget.style.background="#1f1a00";e.currentTarget.style.borderColor="#F5C842";}}
            onTouchEnd={e=>{e.currentTarget.style.background="#111";e.currentTarget.style.borderColor="#2a2a2a";}}>
            {k==="del"?"⌫":k}
          </button>
        ))}
      </div>
      <div style={{fontSize:11,color:"#333",letterSpacing:1,textTransform:"uppercase",textAlign:"center"}}>🔒 Data stored privately on this device</div>
    </div>
  );
}

// ── HOME ──
function HomeTab({data,collections,expenses,setTab,onLock}){
  const [selWeekHome,setSelWeekHome]=useState(null);
  const [personalModal,setPersonalModal]=useState(false);
  const [personalAmt,setPersonalAmt]=useState("");
  const [personalNote,setPersonalNote]=useState("");
  const [toast,setToast]=useState({});
  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast({}),2400);};

  const newLoansLog=DB.get("slg_newloans",[]);
  const allB=Object.values(data.borrowers).flat();
  const totalLent=allB.reduce((s,b)=>s+b.loanAmt,0);
  const totalReturn=allB.reduce((s,b)=>s+(b.totalReturn||0),0);
  const totalInt=totalReturn-totalLent;
  const totalColl=Object.values(collections).reduce((s,c)=>s+(c.totalCollected||0),0);
  const totalPersonal=Object.values(collections).reduce((s,c)=>s+(c.personalUse||0),0);
  const totalExp=expenses.reduce((s,e)=>s+e.amt,0);
  const netProfit=totalColl-totalExp-totalPersonal;
  const active=allB.filter(b=>b.weeksPaid<(b.durationWeeks||12)).length;
  const complete=allB.filter(b=>b.weeksPaid>=(b.durationWeeks||12)).length;
  const todayDay=DAYS[new Date().getDay()];
  const isMon=new Date().getDay()===1,isTue=new Date().getDay()===2;
  const todayV=data.villages.filter(v=>(v.day==="Monday"&&isMon)||(v.day==="Tuesday"&&isTue));
  const allC=Object.values(collections);
  const weeksList=useMemo(()=>getWeeksList(collections),[collections]);

  // This week's new loans (from Monday to today)
  const thisMonday=getMondayOfWeek(todayStr());
  const thisWeekLoans=newLoansLog.filter(l=>l.date>=thisMonday&&l.date<=todayStr());
  const thisWeekLoansTotal=thisWeekLoans.reduce((s,l)=>s+l.loanAmt,0);

  // Today's new loans
  const todayNewLoans=newLoansLog.filter(l=>l.date===todayStr());
  const todayNewLoansTotal=todayNewLoans.reduce((s,l)=>s+l.loanAmt,0);

  const savePersonalUse=()=>{
    if(!personalAmt) return;
    // Save as a personal use log entry
    const log=DB.get("slg_personal",[]);
    log.unshift({id:"p"+Date.now(),amt:parseInt(personalAmt),note:personalNote||"Personal use",date:todayStr()});
    DB.set("slg_personal",log);
    setPersonalAmt(""); setPersonalNote(""); setPersonalModal(false);
    showToast("Personal use recorded ✓");
  };

  // FIX 3: Cover full Mon→Sun week
  const collsInWeek=monday=>{
    const start=new Date(monday+"T00:00:00");
    const weekDates=[];
    for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);weekDates.push(d.toISOString().split("T")[0]);}
    return allC.filter(c=>weekDates.includes(c.date));
  };

  if(selWeekHome){
    const wColls=collsInWeek(selWeekHome);
    const wColl=wColls.reduce((s,c)=>s+(c.totalCollected||0),0);
    const wExp=wColls.reduce((s,c)=>s+(c.totalExpected||0),0);
    const wNew=wColls.reduce((s,c)=>s+(c.newLoans||0),0);
    const wPers=wColls.reduce((s,c)=>s+(c.personalUse||0),0);
    const weekNum=weeksList.length-weeksList.indexOf(selWeekHome);
    const tue=new Date(selWeekHome+"T00:00:00"); tue.setDate(tue.getDate()+6);
    return (
      <div style={{background:"#F0F4F8",minHeight:"100vh"}}>
        <Nav title={`Week ${weekNum} Report`} onBack={()=>setSelWeekHome(null)}/>
        <div style={{padding:"14px 14px 100px"}}>
          <Card style={{background:"linear-gradient(135deg,#084D6E,#1A8ABF)",border:"none",color:"#fff",padding:18,marginBottom:14}}>
            <div style={{fontSize:12,opacity:0.7}}>Week {weekNum}</div>
            <div style={{fontSize:22,fontWeight:900,marginTop:2}}>{fmt(wColl)} Collected</div>
            <div style={{fontSize:12,opacity:0.6,marginTop:4}}>{dateLabel(selWeekHome)} → {dateLabel(tue.toISOString().split("T")[0])}</div>
          </Card>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[{l:"Collected",v:fmt(wColl),c:"#1A7F4B",bg:"#E8F7EF"},{l:"Expected",v:fmt(wExp),c:"#0B6E9E",bg:"#E6F3FA"},{l:"Shortfall",v:fmt(Math.max(wExp-wColl,0)),c:"#C0392B",bg:"#FDECEA"},{l:"New Loans",v:fmt(wNew),c:"#B45309",bg:"#FEF3C7"},{l:"Personal Use",v:fmt(wPers),c:"#B45309",bg:"#FEF3C7"},{l:"Visits",v:wColls.length,c:"#0B6E9E",bg:"#E6F3FA"}].map((s,i)=>(
              <Card key={i} style={{marginBottom:0,padding:14}}><div style={{fontWeight:800,fontSize:16,color:s.c}}>{s.v}</div><div style={{fontSize:11,color:"#8FA3B8",marginTop:3}}>{s.l}</div></Card>
            ))}
          </div>
          <SecLabel>Village Collections This Week</SecLabel>
          {wColls.map((c,i)=>(
            <Card key={i} style={{padding:14}}>
              <Row style={{marginBottom:8}}>
                <div><div style={{fontWeight:700,color:"#0D1B2A"}}>{c.villageName}</div><div style={{fontSize:12,color:"#8FA3B8"}}>{dayName(c.date)}, {dateLabel(c.date)}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontWeight:800,color:"#1A7F4B"}}>{fmt(c.totalCollected)}</div><div style={{fontSize:11,color:"#8FA3B8"}}>of {fmt(c.totalExpected)}</div></div>
              </Row>
              {(c.entries||[]).map((e,j)=>{
                const b=(data.borrowers[c.villageId]||[]).find(x=>x.id===e.borrowerId);
                if(!b) return null;
                const ic=e.status==="paid"?"✅":e.status==="skip"?"❌":"⚡";
                const col=e.status==="paid"?"#1A7F4B":e.status==="skip"?"#C0392B":"#B45309";
                return (
                  <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderTop:"1px solid #EBF0F5"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:13,color:"#0D1B2A"}}>{ic} {b.seqNo?`#${b.seqNo} · `:""}{b.name}</span>
                      {e.status==="paid"&&e.payMethod&&(
                        e.payMethod==="phonepe"?<span style={{fontSize:10,background:"#6739B7",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>📱</span>
                        :e.payMethod==="online"?<span style={{fontSize:10,background:"#0B6E9E",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>🌐</span>
                        :<span style={{fontSize:10,background:"#1A7F4B",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>💵</span>
                      )}
                    </div>
                    <span style={{fontSize:13,fontWeight:700,color:col}}>{e.status!=="skip"?fmt(e.amtPaid):"—"}</span>
                  </div>
                );
              })}
            </Card>
          ))}
          {/* New loans given this week */}
          {(()=>{
            const tue=new Date(selWeekHome+"T00:00:00"); tue.setDate(tue.getDate()+1);
            const tueStr=tue.toISOString().split("T")[0];
            const wkLoans=newLoansLog.filter(l=>l.date===selWeekHome||l.date===tueStr);
            if(wkLoans.length===0) return null;
            const wkLoansTotal=wkLoans.reduce((s,l)=>s+l.loanAmt,0);
            return (
              <>
                <SecLabel>📤 New Loans Given This Week</SecLabel>
                <Card style={{background:"linear-gradient(135deg,#FDF8E7,#fff8dc)",border:"1.5px solid #C8960C40",padding:14}}>
                  <Row style={{marginBottom:10}}>
                    <div style={{fontWeight:700,color:"#0D1B2A"}}>Total New Loans</div>
                    <div style={{fontWeight:900,color:"#C8960C",fontSize:16}}>{fmt(wkLoansTotal)}</div>
                  </Row>
                  {wkLoans.map((l,i)=>(
                    <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderTop:"1px solid #EBF0F5"}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:"#0D1B2A"}}>{l.seqNo?`#${l.seqNo} · `:""}{l.borrowerName}</div>
                        <div style={{fontSize:11,color:"#8FA3B8"}}>{l.villageName} · {dateLabel(l.date)}</div>
                      </div>
                      <div style={{fontWeight:800,color:"#C8960C"}}>{fmt(l.loanAmt)}</div>
                    </div>
                  ))}
                </Card>
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:"14px 14px 100px",background:"#F0F4F8"}}>
      {toast.msg&&<Toast msg={toast.msg} type={toast.type}/>}

      {/* Personal Use Modal */}
      <Sheet open={personalModal} onClose={()=>setPersonalModal(false)} title="🏠 Record Personal Use">
        <div style={{background:"#FEF3C7",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#B45309"}}>
          Record cash you took from collections for personal use today.
        </div>
        <Inp label="Amount (₹)" type="number" value={personalAmt} onChange={e=>setPersonalAmt(e.target.value)} placeholder="e.g. 500"/>
        <Inp label="Note (optional)" value={personalNote} onChange={e=>setPersonalNote(e.target.value)} placeholder="e.g. grocery, travel"/>
        <div style={{display:"flex",gap:10}}>
          <Btn variant="white" onClick={()=>setPersonalModal(false)} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={savePersonalUse} variant="gold" style={{flex:1}}>Save</Btn>
        </div>
      </Sheet>

      <div style={{background:"linear-gradient(135deg,#084D6E,#1A8ABF)",borderRadius:20,padding:"18px 20px",marginBottom:14,color:"#fff",boxShadow:"0 4px 20px #0B6E9E22"}}>
        <Row>
          <div>
            <div style={{fontSize:12,opacity:0.7}}>Good {new Date().getHours()<12?"Morning":"Afternoon"} 👋</div>
            <div style={{fontSize:19,fontWeight:900,marginTop:3}}>Sri Lakshmi Ganapati</div>
            <div style={{fontSize:12,opacity:0.6,marginTop:2}}>{todayDay}, {new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"})}</div>
          </div>
          <button onClick={onLock} style={{width:36,height:36,borderRadius:18,border:"1.5px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.1)",color:"#fff",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>🔐</button>
        </Row>
        {todayV.length>0&&<div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}><span style={{fontSize:11,opacity:0.7}}>Today's visits:</span>{todayV.map(v=><span key={v.id} style={{background:"rgba(255,255,255,0.18)",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>📍 {v.name}</span>)}</div>}
      </div>

      <Card style={{background:"linear-gradient(135deg,#FDF8E7,#fff8dc)",border:"1.5px solid #C8960C40",marginBottom:14,padding:18}}>
        <div style={{fontSize:11,color:"#C8960C",fontWeight:800,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>💫 Total Money Circulating</div>
        <div style={{fontSize:30,fontWeight:900,color:"#C8960C"}}>{fmt(totalLent)}</div>
        <div style={{display:"flex",gap:12,marginTop:12}}>
          {[{l:"Active Loans",v:active,c:"#0B6E9E"},{l:"Completed",v:complete,c:"#1A7F4B"},{l:"Villages",v:data.villages.length,c:"#C8960C"}].map((s,i)=>(
            <div key={i} style={{flex:1,textAlign:"center",background:"rgba(255,255,255,0.65)",borderRadius:10,padding:"8px 4px"}}>
              <div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,color:"#8FA3B8",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {[
          {icon:"💸",l:"Total Lent Out",v:fmt(totalLent),c:"#0B6E9E",bg:"#E6F3FA"},
          {icon:"💰",l:"Total Interest",v:fmt(totalInt),c:"#C8960C",bg:"#FDF8E7"},
          {icon:"✅",l:"Total Collected",v:fmt(totalColl),c:"#1A7F4B",bg:"#E8F7EF"},
          {icon:"📈",l:"Net Profit",v:fmt(netProfit),c:netProfit>=0?"#1A7F4B":"#C0392B",bg:netProfit>=0?"#E8F7EF":"#FDECEA"},
          {icon:"🏠",l:"Personal Use",v:fmt(totalPersonal),c:"#B45309",bg:"#FEF3C7"},
          {icon:"🧾",l:"Expenses",v:fmt(totalExp),c:"#C0392B",bg:"#FDECEA"},
        ].map((s,i)=>(
          <Card key={i} style={{marginBottom:0,padding:14}}>
            <div style={{width:34,height:34,borderRadius:10,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,marginBottom:8}}>{s.icon}</div>
            <div style={{fontSize:16,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:11,color:"#8FA3B8",marginTop:2}}>{s.l}</div>
          </Card>
        ))}
      </div>

      {/* Personal Use Quick Button */}
      <button onClick={()=>setPersonalModal(true)}
        style={{width:"100%",padding:"12px",borderRadius:14,border:"1.5px dashed #B4530960",background:"#FEF3C7",cursor:"pointer",fontWeight:700,fontSize:14,color:"#B45309",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        🏠 Record Personal Use From Today's Collection
      </button>

      {/* New Loans This Week — AUTO from borrower additions */}
      {thisWeekLoans.length>0&&(
        <>
          <SecLabel>📤 New Loans Given This Week</SecLabel>
          <Card style={{background:"linear-gradient(135deg,#FDF8E7,#fff8dc)",border:"1.5px solid #C8960C40",padding:16,marginBottom:12}}>
            <Row style={{marginBottom:12}}>
              <div>
                <div style={{fontSize:12,color:"#8FA3B8"}}>Total New Loans This Week</div>
                <div style={{fontSize:24,fontWeight:900,color:"#C8960C"}}>{fmt(thisWeekLoansTotal)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,color:"#8FA3B8"}}>Borrowers</div>
                <div style={{fontSize:22,fontWeight:900,color:"#0B6E9E"}}>{thisWeekLoans.length}</div>
              </div>
            </Row>
            {thisWeekLoans.map((l,i)=>(
              <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderTop:"1px solid #EBF0F5"}}>
                <div>
                  <div style={{fontWeight:700,color:"#0D1B2A",fontSize:13}}>
                    {l.seqNo?`#${l.seqNo} · `:""}{l.borrowerName}
                  </div>
                  <div style={{fontSize:11,color:"#8FA3B8"}}>{l.villageName} · {dayName(l.date)}, {dateLabel(l.date)}</div>
                </div>
                <div style={{fontWeight:800,color:"#C8960C",fontSize:14}}>{fmt(l.loanAmt)}</div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Completed Weeks on Dashboard */}
      {weeksList.length>0&&<>
        <SecLabel>📅 Completed Weeks ({weeksList.length})</SecLabel>
        {weeksList.map((monday,i)=>{
          const wColls=collsInWeek(monday);
          const wColl=wColls.reduce((s,c)=>s+(c.totalCollected||0),0);
          const wExp=wColls.reduce((s,c)=>s+(c.totalExpected||0),0);
          const weekNum=weeksList.length-i;
          const tue=new Date(monday+"T00:00:00"); tue.setDate(tue.getDate()+6);
          return (
            <Card key={monday} onClick={()=>setSelWeekHome(monday)} style={{cursor:"pointer",padding:14}}>
              <Row>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:36,height:36,borderRadius:10,background:"#E6F3FA",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#0B6E9E",fontSize:14}}>{weekNum}</div>
                  <div>
                    <div style={{fontWeight:700,color:"#0D1B2A",fontSize:14}}>Week {weekNum}</div>
                    <div style={{fontSize:11,color:"#8FA3B8"}}>{dateLabel(monday)} → {dateLabel(tue.toISOString().split("T")[0])}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:800,color:"#1A7F4B",fontSize:14}}>{fmt(wColl)}</div>
                  {wColl<wExp&&<div style={{fontSize:10,color:"#C0392B"}}>-{fmt(wExp-wColl)}</div>}
                </div>
              </Row>
            </Card>
          );
        })}
      </>}

      <SecLabel>Villages Overview</SecLabel>
      {data.villages.length===0&&<Card style={{textAlign:"center",padding:28,color:"#8FA3B8"}}>No villages yet. Go to Settings → Add Village.</Card>}
      {data.villages.map(v=>{
        const bs=data.borrowers[v.id]||[];
        const tL=bs.reduce((s,b)=>s+b.loanAmt,0);
        const ac=bs.filter(b=>b.weeksPaid<(b.durationWeeks||12)).length;
        const vCols=Object.values(collections).filter(c=>c.villageId===v.id);
        const vCollected=vCols.reduce((s,c)=>s+(c.totalCollected||0),0);
        const circulating=Math.max(tL-vCollected,0);
        return (
          <Card key={v.id} style={{padding:14,cursor:"pointer"}} onClick={()=>setTab("collect")}>
            <Row style={{marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:42,height:42,borderRadius:12,background:"#E6F3FA",border:"1.5px solid #0B6E9E25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🏘️</div>
                <div>
                  <div style={{fontWeight:700,color:"#0D1B2A",fontSize:15}}>{v.name}</div>
                  <div style={{fontSize:12,color:"#8FA3B8"}}>{v.day} · {bs.length} borrowers · {ac} active</div>
                </div>
              </div>
            </Row>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div style={{background:"#E6F3FA",borderRadius:10,padding:"8px 12px"}}>
                <div style={{fontWeight:800,color:"#0B6E9E",fontSize:14}}>{fmt(tL)}</div>
                <div style={{fontSize:10,color:"#8FA3B8"}}>Total Lent</div>
              </div>
              <div style={{background:"#FEF3C7",borderRadius:10,padding:"8px 12px"}}>
                <div style={{fontWeight:800,color:"#B45309",fontSize:14}}>{fmt(circulating)}</div>
                <div style={{fontSize:10,color:"#8FA3B8"}}>Still Circulating</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── COLLECT TAB ──
function CollectTab({data,setData,collections,setCollections}){
  const [screen,setScreen]=useState("villages");
  const [selV,setSelV]=useState(null);
  const [entries,setEntries]=useState({});
  const [shortModal,setShortModal]=useState(null);
  const [shortAmt,setShortAmt]=useState(""); const [shortNote,setShortNote]=useState("");
  const [extraModal,setExtraModal]=useState(null);
  const [extraAmt,setExtraAmt]=useState(""); const [extraNote,setExtraNote]=useState("");
  const [cashModal,setCashModal]=useState(false);
  const [newLoans,setNewLoans]=useState(""); const [personal,setPersonal]=useState("");
  const [toast,setToast]=useState({});
  const [payModal,setPayModal]=useState(null); // holds borrower when choosing pay method
  const [addBModal,setAddBModal]=useState(false);
  const [nbForm,setNbForm]=useState({name:"",phone:"",seqNo:"",loanAmt:"",durationWeeks:"12",interestPct:"20",weeklyOverride:"",weeksPaid:"0",startDate:todayStr(),isOngoing:false,partialHistory:[]});
  const [confirmDelBorrower,setConfirmDelBorrower]=useState(null);
  const [editBModal,setEditBModal]=useState(null); // holds borrower being edited
  const [editForm,setEditForm]=useState({name:"",phone:"",seqNo:""});

  const deleteBorrower=(bid)=>{
    if(!selV) return;
    const updB=(data.borrowers[selV.id]||[]).filter(b=>b.id!==bid);
    const updD={...data,borrowers:{...data.borrowers,[selV.id]:updB}};
    setData(updD);DB.set("slg_data",updD);
    setConfirmDelBorrower(null);showToast("Borrower deleted");
  };

  const saveEditBorrower=()=>{
    if(!editBModal||!selV) return;
    const updB=(data.borrowers[selV.id]||[]).map(b=>
      b.id===editBModal.id?{...b,name:editForm.name||b.name,phone:editForm.phone,seqNo:editForm.seqNo}:b
    );
    const updD={...data,borrowers:{...data.borrowers,[selV.id]:updB}};
    setData(updD);DB.set("slg_data",updD);
    setEditBModal(null);showToast("Borrower updated ✓");
  };

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast({}),2400);};
  const wk=v=>v?`${v.id}_${todayStr()}`:"";
  // FIX 1: Sort borrowers by seqNo numerically — 1,2,3... order always
  const borrowers=selV
    ? [...(data.borrowers[selV.id]||[])].sort((a,b)=>{
        const na=a.seqNo?parseInt(a.seqNo)||0:99999;
        const nb=b.seqNo?parseInt(b.seqNo)||0:99999;
        if(na!==nb) return na-nb;
        return (a.seqNo||"").localeCompare(b.seqNo||"");
      })
    : [];

  const openV=v=>{
    setSelV(v);
    const ex=collections[wk(v)];
    if(ex){const m={};(ex.entries||[]).forEach(e=>{m[e.borrowerId]=e;});setEntries(m);}
    else setEntries({});
    setScreen("detail");
  };

  const markPaid=b=>{
    const e=entries[b.id];
    if(e&&e.status==="paid"){const n={...entries};delete n[b.id];setEntries(n);}
    else setPayModal(b); // open payment method picker
  };
  const confirmPaid=(b,method)=>{
    setEntries(p=>({...p,[b.id]:{borrowerId:b.id,status:"paid",amtPaid:b.weeklyDue,payMethod:method}}));
    setPayModal(null);
  };
  const markSkip=b=>{
    const e=entries[b.id];
    if(e&&e.status==="skip"){const n={...entries};delete n[b.id];setEntries(n);}
    else setEntries(p=>({...p,[b.id]:{borrowerId:b.id,status:"skip",amtPaid:0}}));
  };
  const openShort=b=>{const e=entries[b.id];setShortAmt(e?.amtPaid?.toString()||"");setShortNote(e?.note||"");setShortModal(b);};
  const saveShort=()=>{
    if(!shortModal) return;
    setEntries(p=>({...p,[shortModal.id]:{borrowerId:shortModal.id,status:"short",amtPaid:parseInt(shortAmt)||0,note:shortNote||"Balance next week"}}));
    setShortModal(null);
  };
  const openExtra=b=>{const e=entries[b.id];setExtraAmt(e?.extraAmt?.toString()||"");setExtraNote(e?.note||"");setExtraModal(b);};
  const saveExtra=()=>{
    if(!extraModal) return;
    const extra=parseInt(extraAmt)||0;
    setEntries(p=>({...p,[extraModal.id]:{borrowerId:extraModal.id,status:"extra",amtPaid:extraModal.weeklyDue+extra,extraAmt:extra,note:extraNote||""}}));
    setExtraModal(null);
  };

  const totalExp=borrowers.reduce((s,b)=>s+b.weeklyDue,0);
  const totalColl=Object.values(entries).reduce((s,e)=>s+(e.amtPaid||0),0);
  const cP=Object.values(entries).filter(e=>e.status==="paid").length;
  const cS=Object.values(entries).filter(e=>e.status==="skip").length;
  const cSh=Object.values(entries).filter(e=>e.status==="short").length;
  const cEx=Object.values(entries).filter(e=>e.status==="extra").length;
  const cPend=borrowers.length-cP-cS-cSh-cEx;

  const calcW=(loan,pct,weeks)=>Math.ceil((parseInt(loan)||0)*(1+(parseInt(pct)||0)/100)/(parseInt(weeks)||12));

  const quickSave=()=>{
    if(!selV) return;
    // Save collection record
    const col={villageId:selV.id,villageName:selV.name,date:todayStr(),entries:Object.values(entries),totalExpected:totalExp,totalCollected:totalColl,newLoans:0,personalUse:0,savedAt:new Date().toISOString()};
    // ALSO update borrower week counts — same as finishSave
    const updB=[...(data.borrowers[selV.id]||[])];
    updB.forEach((b,idx)=>{
      const e=entries[b.id]; if(!e) return;
      // Don't double-count: check if we already saved today
      const alreadySavedToday=(b.history||[]).some(h=>h.date===todayStr());
      if(alreadySavedToday) return;
      const hist=[...(b.history||[]),{date:todayStr(),status:e.status,amtPaid:e.amtPaid,note:e.note||"",payMethod:e.payMethod||"cash"}];
      if(e.status==="paid")  updB[idx]={...b,weeksPaid:b.weeksPaid+1,history:hist};
      if(e.status==="skip")  updB[idx]={...b,durationWeeks:(b.durationWeeks||12)+1,history:hist};
      if(e.status==="short") updB[idx]={...b,weeksPaid:b.weeksPaid+1,durationWeeks:(b.durationWeeks||12)+1,history:hist};
      if(e.status==="extra") updB[idx]={...b,weeksPaid:b.weeksPaid+1,history:[...(b.history||[]),{date:todayStr(),status:"extra",amtPaid:e.amtPaid,extraAmt:e.extraAmt||0,note:e.note||"",payMethod:e.payMethod||"cash"}]};
    });
    const updD={...data,borrowers:{...data.borrowers,[selV.id]:updB}};
    const updC={...collections,[wk(selV)]:col};
    setData(updD);DB.set("slg_data",updD);
    setCollections(updC);DB.set("slg_cols",updC);
    showToast("Saved! Weeks updated ✓");
  };

  const finishSave=()=>{
    if(!selV) return;
    // Auto-calculate new loans given today from the newLoansLog
    const todayLoans=DB.get("slg_newloans",[]).filter(l=>l.date===todayStr()&&l.villageId===selV.id);
    const autoNewLoans=todayLoans.reduce((s,l)=>s+l.loanAmt,0);
    const col={villageId:selV.id,villageName:selV.name,date:todayStr(),entries:Object.values(entries),totalExpected:totalExp,totalCollected:totalColl,newLoans:autoNewLoans,personalUse:parseInt(personal)||0,savedAt:new Date().toISOString()};
    const updB=[...(data.borrowers[selV.id]||[])];
    updB.forEach((b,idx)=>{
      const e=entries[b.id]; if(!e) return;
      const alreadySavedToday=(b.history||[]).some(h=>h.date===todayStr());
      if(alreadySavedToday) return;
      const hist=[...(b.history||[]),{date:todayStr(),status:e.status,amtPaid:e.amtPaid,note:e.note||"",payMethod:e.payMethod||"cash"}];
      if(e.status==="paid")  updB[idx]={...b,weeksPaid:b.weeksPaid+1,history:hist};
      if(e.status==="skip")  updB[idx]={...b,durationWeeks:(b.durationWeeks||12)+1,history:hist};
      if(e.status==="short") updB[idx]={...b,weeksPaid:b.weeksPaid+1,durationWeeks:(b.durationWeeks||12)+1,history:hist};
    });
    const updD={...data,borrowers:{...data.borrowers,[selV.id]:updB}};
    const updC={...collections,[wk(selV)]:col};
    setData(updD);DB.set("slg_data",updD);
    setCollections(updC);DB.set("slg_cols",updC);
    setCashModal(false);showToast("Collection saved ✓");
    setTimeout(()=>setScreen("detail"),500);
  };

  const addBorrower=()=>{
    if(!nbForm.name||!nbForm.loanAmt||!selV) return;
    if(nbForm.seqNo){
      const existing=(data.borrowers[selV.id]||[]).find(b=>b.seqNo===nbForm.seqNo);
      if(existing){showToast(`#${nbForm.seqNo} already used by ${existing.name}`,"error");return;}
    }
    const loan=parseInt(nbForm.loanAmt);
    const weeks=parseInt(nbForm.durationWeeks)||12;
    const pct=parseInt(nbForm.interestPct)||0;
    const weekly=parseInt(nbForm.weeklyOverride)||calcW(loan,pct,weeks);
    const totalReturn=weekly*weeks;
    const weeksPaidSoFar=nbForm.isOngoing?(parseInt(nbForm.weeksPaid)||0):0;
    const builtHistory=(nbForm.partialHistory||[]).map((ph)=>({
      date:ph.date||nbForm.startDate,
      status:ph.status||(parseInt(ph.amtPaid||"0")===0?"skip":(parseInt(ph.amtPaid||"0")>=(parseInt(nbForm.weeklyOverride)||calcW(nbForm.loanAmt,nbForm.interestPct,nbForm.durationWeeks))?"paid":"short")),
      amtPaid:ph.status==="paid"?(parseInt(nbForm.weeklyOverride)||calcW(nbForm.loanAmt,nbForm.interestPct,nbForm.durationWeeks)):ph.status==="skip"?0:parseInt(ph.amtPaid)||0,
      note:ph.note||"",
      payMethod:ph.payMethod||"cash",
    }));
    const nb={id:"b"+Date.now(),seqNo:nbForm.seqNo||"",name:nbForm.name,phone:nbForm.phone,loanAmt:loan,durationWeeks:weeks,interestPct:pct,weeklyDue:weekly,totalReturn,weeksPaid:weeksPaidSoFar,startDate:nbForm.startDate||todayStr(),isOngoing:nbForm.isOngoing,history:builtHistory};
    const updD={...data,borrowers:{...data.borrowers,[selV.id]:[...(data.borrowers[selV.id]||[]),nb]}};
    // AUTO-TRACK new loan in newLoansLog (only for new loans, not ongoing)
    if(!nbForm.isOngoing){
      const logEntry={id:"nl"+Date.now(),borrowerName:nbForm.name,seqNo:nbForm.seqNo||"",villageName:selV.name,villageId:selV.id,loanAmt:loan,date:todayStr()};
      const existingLog=DB.get("slg_newloans",[]);
      DB.set("slg_newloans",[logEntry,...existingLog]);
    }
    setData(updD);DB.set("slg_data",updD);
    setNbForm({name:"",phone:"",seqNo:"",loanAmt:"",durationWeeks:"12",interestPct:"20",weeklyOverride:"",weeksPaid:"0",startDate:todayStr(),isOngoing:false,partialHistory:[]});
    setAddBModal(false);showToast("Borrower added ✓");
  };

  if(screen==="villages") return (
    <div style={{background:"#F0F4F8",minHeight:"100vh"}}>
      <Nav title="Collection"/>
      {toast.msg&&<Toast msg={toast.msg} type={toast.type}/>}
      <div style={{padding:"14px 14px 100px"}}>
        <Card style={{background:"linear-gradient(135deg,#084D6E,#1A8ABF)",border:"none",color:"#fff",padding:20,marginBottom:20}}>
          <div style={{fontSize:13,opacity:0.75}}>Select Village to Begin</div>
          <div style={{fontSize:20,fontWeight:800,marginTop:4}}>Today's Collection</div>
          <div style={{fontSize:12,opacity:0.6,marginTop:3}}>{new Date().toDateString()}</div>
        </Card>
        {["Monday","Tuesday"].map(day=>(
          <div key={day}>
            <SecLabel>{day} Villages</SecLabel>
            {data.villages.filter(v=>v.day===day).length===0&&<div style={{color:"#8FA3B8",fontSize:13,marginBottom:12,paddingLeft:4}}>No villages for {day}.</div>}
            {data.villages.filter(v=>v.day===day).map(v=>{
              const bs=data.borrowers[v.id]||[]; const done=!!collections[wk(v)];
              return (
                <Card key={v.id} onClick={()=>openV(v)} style={{cursor:"pointer",border:done?"1.5px solid #1A7F4B55":"1px solid #D8E4EE"}}>
                  <Row>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:44,height:44,borderRadius:14,background:"#E6F3FA",border:"1.5px solid #0B6E9E25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏘️</div>
                      <div>
                        <div style={{fontWeight:700,fontSize:15,color:"#0D1B2A"}}>{v.name}</div>
                        <div style={{fontSize:12,color:"#8FA3B8"}}>{bs.length} borrowers · {day}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {done&&<Chip color="#1A7F4B" bg="#E8F7EF">✓ Done</Chip>}
                      <span style={{color:"#0B6E9E",fontSize:22,fontWeight:200}}>›</span>
                    </div>
                  </Row>
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  if(screen==="detail"&&selV){
    const bs=borrowers;
    const tL=bs.reduce((s,b)=>s+b.loanAmt,0);
    const ac=bs.filter(b=>b.weeksPaid<(b.durationWeeks||12)).length;
    const co=bs.filter(b=>b.weeksPaid>=(b.durationWeeks||12)).length;
    const done=!!collections[wk(selV)];
    return (
      <div style={{background:"#F0F4F8",minHeight:"100vh"}}>
        <Nav title={selV.name} onBack={()=>setScreen("villages")}/>
        {toast.msg&&<Toast msg={toast.msg} type={toast.type}/>}
        <div style={{padding:"14px 14px 100px"}}>
          <Card style={{background:"linear-gradient(135deg,#084D6E,#1A8ABF)",border:"none",color:"#fff",padding:20,marginBottom:14}}>
            <div style={{fontSize:13,opacity:0.7}}>{selV.day} Village</div>
            <div style={{fontSize:22,fontWeight:900,marginTop:2}}>{selV.name}</div>
            <div style={{display:"flex",gap:12,marginTop:14}}>
              {[{l:"Borrowers",v:bs.length},{l:"Active",v:ac},{l:"Completed",v:co},{l:"Total Lent",v:fmt(tL)}].map((s,i)=>(
                <div key={i} style={{flex:1,textAlign:"center"}}>
                  <div style={{fontSize:i<3?18:13,fontWeight:800}}>{s.v}</div>
                  <div style={{fontSize:10,opacity:0.65,marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>
          </Card>
          {done&&(
            <Card style={{border:"1.5px solid #1A7F4B50",background:"#E8F7EF",marginBottom:8}}>
              <Row>
                <div><div style={{fontWeight:700,color:"#1A7F4B",fontSize:14}}>✅ Today's Collection Done</div><div style={{fontSize:12,color:"#8FA3B8",marginTop:2}}>Tap to view or edit</div></div>
                <Chip color="#1A7F4B" bg="#fff">{fmt(collections[wk(selV)]?.totalCollected||0)}</Chip>
              </Row>
            </Card>
          )}
          <Btn onClick={()=>setScreen("sheet")} variant={done?"outline":"primary"} style={{width:"100%",marginBottom:10,fontSize:15}}>
            {done?"📋 View / Edit Collection":"📋 Start Today's Collection"}
          </Btn>
          <Btn onClick={()=>setAddBModal(true)} variant="gold" style={{width:"100%",marginBottom:20}}>+ Add New Borrower</Btn>
          <SecLabel>Borrowers ({bs.length})</SecLabel>
          {bs.length===0&&<Card style={{textAlign:"center",padding:28,color:"#8FA3B8"}}>No borrowers yet. Add one above.</Card>}

          {/* Delete Borrower Confirmation Modal */}
          {confirmDelBorrower&&(
            <div style={{position:"fixed",inset:0,background:"#00000070",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
              <div style={{background:"#fff",borderRadius:20,padding:24,width:"100%",maxWidth:360,boxShadow:"0 8px 40px #0004"}}>
                <div style={{fontSize:36,textAlign:"center",marginBottom:12}}>🗑️</div>
                <div style={{fontWeight:800,fontSize:17,color:"#0D1B2A",textAlign:"center",marginBottom:8}}>Delete Borrower?</div>
                <div style={{fontSize:14,color:"#4A6080",textAlign:"center",marginBottom:6}}>Are you sure you want to delete</div>
                <div style={{fontSize:17,fontWeight:900,color:"#C0392B",textAlign:"center",marginBottom:6}}>
                  {confirmDelBorrower.seqNo?`#${confirmDelBorrower.seqNo} · `:""}{confirmDelBorrower.name}
                </div>
                <div style={{fontSize:13,color:"#8FA3B8",textAlign:"center",marginBottom:22}}>This will permanently delete this borrower and all their payment history.</div>
                <div style={{display:"flex",gap:10}}>
                  <Btn variant="white" onClick={()=>setConfirmDelBorrower(null)} style={{flex:1}}>Cancel</Btn>
                  <Btn onClick={()=>deleteBorrower(confirmDelBorrower.id)} style={{flex:1,background:"#C0392B",color:"#fff",border:"none"}}>Yes, Delete</Btn>
                </div>
              </div>
            </div>
          )}

          {bs.map((b,i)=>{
            const dw=b.durationWeeks||12; const pct=Math.min(b.weeksPaid/dw,1);
            const totalExtraPaid=(b.history||[]).filter(h=>h.status==="extra").reduce((s,h)=>s+(h.extraAmt||0),0);
            const rem=Math.max((b.totalReturn||0)-(b.weeksPaid*b.weeklyDue)-totalExtraPaid,0); const fin=b.weeksPaid>=dw;
            return (
              <Card key={b.id} style={{padding:14}}>
                <Row style={{marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:38,height:38,borderRadius:10,background:"#E6F3FA",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#0B6E9E",fontSize:b.seqNo?11:13,lineHeight:1.1}}>
                      {b.seqNo
                        ? <><div style={{fontSize:9,color:"#8FA3B8",fontWeight:600}}>#</div><div>{b.seqNo}</div></>
                        : <div>{i+1}</div>
                      }
                    </div>
                    <div><div style={{fontWeight:700,color:"#0D1B2A",fontSize:14}}>{b.name}</div><div style={{fontSize:11,color:"#8FA3B8"}}>{b.phone||"No phone"}</div></div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {fin?<Chip color="#1A7F4B" bg="#E8F7EF">✓ Done</Chip>:(
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <Chip>Wk {b.weeksPaid}/{b.durationWeeks||12}</Chip>
                        {(()=>{const skips=(b.history||[]).filter(h=>h.status==="skip").length; return skips>0?<span style={{background:"#FDECEA",color:"#C0392B",borderRadius:20,padding:"3px 8px",fontSize:11,fontWeight:800}}>+{skips} skip</span>:null;})()}
                      </div>
                    )}
                    <button onClick={()=>{setEditBModal(b);setEditForm({name:b.name,phone:b.phone||"",seqNo:b.seqNo||""});}}
                      style={{width:28,height:28,borderRadius:14,border:"1px solid #0B6E9E30",background:"#E6F3FA",color:"#0B6E9E",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      ✏️
                    </button>
                    <button onClick={()=>setConfirmDelBorrower(b)}
                      style={{width:28,height:28,borderRadius:14,border:"1px solid #C0392B30",background:"#FDECEA",color:"#C0392B",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      🗑
                    </button>
                  </div>
                </Row>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
                  {[{l:"Loan",v:fmt(b.loanAmt),c:"#0B6E9E"},{l:"Weekly",v:fmt(b.weeklyDue),c:"#C8960C"},{l:"Remaining",v:fmt(rem),c:rem>0?"#B45309":"#1A7F4B"}].map((s,j)=>(
                    <div key={j} style={{background:"#F7F9FC",borderRadius:8,padding:"7px",textAlign:"center",border:"1px solid #EBF0F5"}}>
                      <div style={{fontWeight:800,fontSize:12,color:s.c}}>{s.v}</div>
                      <div style={{fontSize:9,color:"#8FA3B8",marginTop:1}}>{s.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{background:"#EBF0F5",borderRadius:4,height:4}}>
                  <div style={{width:`${pct*100}%`,height:4,borderRadius:4,background:fin?"#1A7F4B":"#0B6E9E",transition:"width 0.5s"}}/>
                </div>
                {b.isOngoing&&<div style={{fontSize:10,color:"#B45309",marginTop:4}}>⚡ Pre-existing loan</div>}
              </Card>
            );
          })}
        </div>
        {/* Edit Borrower Modal */}
        <Sheet open={!!editBModal} onClose={()=>setEditBModal(null)} title="✏️ Edit Borrower">
          {editBModal&&<>
            <div style={{background:"#E6F3FA",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#0B6E9E",fontWeight:600}}>
              Editing: {editBModal.seqNo?`#${editBModal.seqNo} · `:""}{editBModal.name}
            </div>
            <Inp label="Sequence / Roll Number" value={editForm.seqNo} onChange={e=>setEditForm(f=>({...f,seqNo:e.target.value}))} placeholder="e.g. 123"/>
            <Inp label="Full Name *" value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} placeholder="Borrower name"/>
            <Inp label="Phone Number" value={editForm.phone} type="tel" onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))} placeholder="10-digit number"/>
            <div style={{background:"#FEF3C7",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#B45309"}}>
              ⚠️ Loan amount, duration and interest cannot be edited. To change those, delete and re-add the borrower.
            </div>
            <div style={{display:"flex",gap:10}}>
              <Btn variant="white" onClick={()=>setEditBModal(null)} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={saveEditBorrower} style={{flex:1}}>Save Changes</Btn>
            </div>
          </>}
        </Sheet>

        <Sheet open={addBModal} onClose={()=>setAddBModal(false)} title="👤 Add Borrower">
          <div style={{display:"flex",background:"#F7F9FC",borderRadius:10,padding:4,marginBottom:14,border:"1px solid #D8E4EE"}}>
            {[false,true].map(isOng=>(
              <button key={String(isOng)} onClick={()=>setNbForm(f=>({...f,isOngoing:isOng}))}
                style={{flex:1,padding:"9px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:nbForm.isOngoing===isOng?"#0B6E9E":"transparent",color:nbForm.isOngoing===isOng?"#fff":"#8FA3B8",transition:"all 0.2s"}}>
                {isOng?"⚡ Ongoing (existing)":"🆕 New Loan"}
              </button>
            ))}
          </div>
          {nbForm.isOngoing&&<div style={{background:"#FEF3C7",border:"1px solid #B4530930",borderRadius:10,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#B45309",fontWeight:600}}>For borrowers already paying before you started using this app. Enter how many weeks they have already paid.</div>}
          <Inp label="Sequence / Roll Number" value={nbForm.seqNo} onChange={e=>setNbForm(f=>({...f,seqNo:e.target.value}))} placeholder="e.g. 123 or A-45" note="Your own numbering system — leave blank if not needed"/>
          <Inp label="Full Name *" value={nbForm.name} onChange={e=>setNbForm(f=>({...f,name:e.target.value}))} placeholder="పేరు నమోదు చేయండి"/>
          <Inp label="Phone Number" value={nbForm.phone} type="tel" onChange={e=>setNbForm(f=>({...f,phone:e.target.value}))} placeholder="10-digit number"/>
          <Inp label="Loan Amount (₹) *" value={nbForm.loanAmt} type="number" onChange={e=>setNbForm(f=>({...f,loanAmt:e.target.value,weeklyOverride:""}))} placeholder="e.g. 10000"/>
          <Sel label="Interest Rate" value={nbForm.interestPct} onChange={e=>setNbForm(f=>({...f,interestPct:e.target.value,weeklyOverride:""}))}>
            {[0,5,10,15,20,25,30].map(p=><option key={p} value={p}>{p}% interest</option>)}
          </Sel>
          <Sel label="Duration (Weeks)" value={nbForm.durationWeeks} onChange={e=>setNbForm(f=>({...f,durationWeeks:e.target.value,weeklyOverride:""}))}>
            {[4,6,8,10,12,16,20,24].map(w=><option key={w} value={w}>{w} weeks ({Math.round(w/4)} months)</option>)}
          </Sel>
          {nbForm.isOngoing&&<>
            <Inp label="Loan Start Date *" value={nbForm.startDate} type="date" onChange={e=>setNbForm(f=>({...f,startDate:e.target.value}))}/>
            <Inp label="Weeks Already Paid/Attempted *" value={nbForm.weeksPaid} type="number" onChange={e=>setNbForm(f=>({...f,weeksPaid:e.target.value}))} placeholder="e.g. 4" note="Total weeks attempted (including skips and short payments)"/>

            {/* FIX 2 — Clear week-by-week entry with tap buttons */}
            {parseInt(nbForm.weeksPaid)>0&&<>
              <div style={{fontSize:11,fontWeight:700,color:"#8FA3B8",marginBottom:8,textTransform:"uppercase",letterSpacing:0.7}}>Week-by-Week Payment Details</div>
              <div style={{background:"#E6F3FA",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:12,color:"#0B6E9E"}}>
                Tap the status for each week. For ⚡ Short, enter how much was paid that week.
              </div>
              {Array.from({length:parseInt(nbForm.weeksPaid)||0}).map((_,wi)=>{
                const ph=(nbForm.partialHistory||[])[wi]||{status:"paid",amtPaid:"",date:"",note:""};
                const weekly=parseInt(nbForm.weeklyOverride)||calcW(nbForm.loanAmt,nbForm.interestPct,nbForm.durationWeeks);
                const updatePh=(newPh)=>{const h=[...(nbForm.partialHistory||[])];h[wi]={...ph,...newPh};setNbForm(f=>({...f,partialHistory:h}));};
                const st=ph.status||"paid";
                const shortPaid=parseInt(ph.amtPaid)||0;
                const shortfall=st==="short"?Math.max(weekly-shortPaid,0):0;
                const borderCol=st==="paid"?"#1A7F4B":st==="skip"?"#C0392B":"#B45309";
                const bgCol=st==="paid"?"#E8F7EF":st==="skip"?"#FDECEA":"#FEF3C7";
                return (
                  <div key={wi} style={{background:bgCol,borderRadius:12,padding:"12px 14px",marginBottom:10,border:`1.5px solid ${borderCol}30`}}>
                    <Row style={{marginBottom:10}}>
                      <div style={{fontWeight:800,color:"#0D1B2A",fontSize:14}}>Week {wi+1}</div>
                      <div style={{fontSize:11,color:borderCol,fontWeight:700}}>
                        {st==="paid"?"✅ Fully Paid":st==="skip"?"❌ Skipped":`⚡ Short — ${fmt(shortfall)} unpaid`}
                      </div>
                    </Row>
                    {/* 3 tap buttons */}
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      {[{id:"paid",label:"✅ Paid",ac:"#1A7F4B",ic:"#E8F7EF"},{id:"skip",label:"❌ Skip",ac:"#C0392B",ic:"#FDECEA"},{id:"short",label:"⚡ Short",ac:"#B45309",ic:"#FEF3C7"}].map(btn=>(
                        <button key={btn.id} onClick={()=>updatePh({status:btn.id,amtPaid:btn.id==="paid"?String(weekly):btn.id==="skip"?"0":ph.amtPaid})}
                          style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,transition:"all 0.15s",
                            background:st===btn.id?btn.ac:btn.ic,
                            color:st===btn.id?"#fff":btn.ac}}>
                          {btn.label}
                        </button>
                      ))}
                    </div>
                    {/* Short amount entry */}
                    {st==="short"&&(
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:10,color:"#8FA3B8",marginBottom:4,fontWeight:700}}>HOW MUCH DID THEY PAY? (₹)</div>
                        <input type="number" value={ph.amtPaid} placeholder={`Less than ₹${weekly}`}
                          onChange={e=>updatePh({amtPaid:e.target.value})}
                          style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1.5px solid #B4530950",background:"#fff",fontSize:15,fontWeight:700,outline:"none",boxSizing:"border-box",color:"#B45309"}}/>
                        {shortPaid>0&&(
                          <div style={{background:"#fff",borderRadius:8,padding:"8px 12px",marginTop:6,border:"1px solid #B4530920"}}>
                            <Row><span style={{fontSize:12,color:"#8FA3B8"}}>Weekly due</span><span style={{fontSize:13,fontWeight:700}}>{fmt(weekly)}</span></Row>
                            <Row style={{marginTop:3}}><span style={{fontSize:12,color:"#8FA3B8"}}>Paid</span><span style={{fontSize:13,fontWeight:700,color:"#1A7F4B"}}>{fmt(shortPaid)}</span></Row>
                            <div style={{height:1,background:"#EBF0F5",margin:"5px 0"}}/>
                            <Row><span style={{fontSize:12,fontWeight:700,color:"#C0392B"}}>Not paid (short)</span><span style={{fontSize:15,fontWeight:900,color:"#C0392B"}}>{fmt(shortfall)}</span></Row>
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div>
                        <div style={{fontSize:10,color:"#8FA3B8",marginBottom:4,fontWeight:700}}>DATE</div>
                        <input type="date" value={ph.date} onChange={e=>updatePh({date:e.target.value})}
                          style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #D8E4EE",background:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:"#8FA3B8",marginBottom:4,fontWeight:700}}>NOTE</div>
                        <input type="text" value={ph.note} placeholder={st==="short"?`Will pay ₹${shortfall} next week`:""}
                          onChange={e=>updatePh({note:e.target.value})}
                          style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #D8E4EE",background:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Summary */}
              {(nbForm.partialHistory||[]).length>0&&(()=>{
                const weekly=parseInt(nbForm.weeklyOverride)||calcW(nbForm.loanAmt,nbForm.interestPct,nbForm.durationWeeks);
                const totalPaid=(nbForm.partialHistory||[]).reduce((s,ph)=>s+(ph.status==="skip"?0:parseInt(ph.amtPaid)||0),0);
                const totalShortfall=(nbForm.partialHistory||[]).reduce((s,ph)=>ph.status==="short"?s+Math.max(weekly-(parseInt(ph.amtPaid)||0),0):s,0);
                const skips=(nbForm.partialHistory||[]).filter(ph=>ph.status==="skip").length;
                return (
                  <div style={{background:"linear-gradient(135deg,#084D6E,#1A8ABF)",borderRadius:12,padding:"12px 16px",marginBottom:10,color:"#fff"}}>
                    <div style={{fontSize:12,opacity:0.8,marginBottom:8}}>📊 Summary</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,textAlign:"center"}}>
                      <div><div style={{fontSize:16,fontWeight:800}}>{fmt(totalPaid)}</div><div style={{fontSize:10,opacity:0.7}}>Total Paid</div></div>
                      <div><div style={{fontSize:16,fontWeight:800,color:"#F5C842"}}>{fmt(totalShortfall)}</div><div style={{fontSize:10,opacity:0.7}}>Total Short</div></div>
                      <div><div style={{fontSize:16,fontWeight:800,color:"#ff9999"}}>{skips}</div><div style={{fontSize:10,opacity:0.7}}>Skipped</div></div>
                    </div>
                  </div>
                );
              })()}
            </>}
          </>}
          {nbForm.loanAmt&&(
            <Card style={{background:"#FDF8E7",border:"1px solid #C8960C30",marginBottom:14,padding:14}}>
              <div style={{fontSize:11,color:"#C8960C",fontWeight:800,marginBottom:8}}>AUTO CALCULATED</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[{l:"Total Return",v:fmt((parseInt(nbForm.loanAmt)||0)*(1+(parseInt(nbForm.interestPct)||0)/100))},{l:"Weekly Due",v:fmt(calcW(nbForm.loanAmt,nbForm.interestPct,nbForm.durationWeeks))},{l:"Duration",v:`${nbForm.durationWeeks} wks`}].map((s,i)=>(
                  <div key={i} style={{textAlign:"center"}}>
                    <div style={{fontWeight:800,fontSize:14,color:"#0D1B2A"}}>{s.v}</div>
                    <div style={{fontSize:10,color:"#8FA3B8"}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Inp label="Override Weekly Amount (optional)" value={nbForm.weeklyOverride} type="number" onChange={e=>setNbForm(f=>({...f,weeklyOverride:e.target.value}))} placeholder={`Auto: ${fmt(calcW(nbForm.loanAmt,nbForm.interestPct,nbForm.durationWeeks))}`} note="Leave blank to use auto-calculated amount"/>
          <div style={{display:"flex",gap:10}}>
            <Btn variant="white" onClick={()=>setAddBModal(false)} style={{flex:1}}>Cancel</Btn>
            <Btn onClick={addBorrower} style={{flex:1}}>Add Borrower</Btn>
          </div>
        </Sheet>
      </div>
    );
  }

  if(screen==="sheet"&&selV) return (
    <div style={{background:"#F0F4F8",minHeight:"100vh"}}>
      <Nav title={selV.name} onBack={()=>setScreen("detail")} right={<span style={{fontSize:12,fontWeight:700,color:"#0B6E9E"}}>{cP+cSh+cEx}/{borrowers.length}</span>}/>
      {toast.msg&&<Toast msg={toast.msg} type={toast.type}/>}
      <div style={{background:"#fff",padding:"12px 16px",borderBottom:"1px solid #EBF0F5"}}>
        <Row style={{marginBottom:8}}>
          <div style={{display:"flex",gap:12,fontSize:13}}>
            <span style={{color:"#1A7F4B",fontWeight:700}}>✅ {cP}</span>
            <span style={{color:"#B45309",fontWeight:700}}>⚡ {cSh}</span>
            <span style={{color:"#C0392B",fontWeight:700}}>❌ {cS}</span>
            <span style={{color:"#0B6E9E",fontWeight:700}}>➕ {cEx}</span>
            <span style={{color:"#8FA3B8"}}>⏳ {cPend}</span>
          </div>
          <span style={{fontWeight:800,color:"#1A7F4B",fontSize:14}}>{fmt(totalColl)}</span>
        </Row>
        <div style={{background:"#EBF0F5",borderRadius:4,height:5}}>
          <div style={{width:`${Math.min((totalColl/Math.max(totalExp,1))*100,100)}%`,height:5,borderRadius:4,background:"#1A7F4B",transition:"width 0.4s"}}/>
        </div>
        <Row style={{marginTop:6}}>
          <span style={{fontSize:11,color:"#8FA3B8"}}>Expected: {fmt(totalExp)}</span>
          <span style={{fontSize:11,color:"#8FA3B8"}}>Shortfall: {fmt(Math.max(totalExp-totalColl,0))}</span>
        </Row>
      </div>
      <div style={{padding:"12px 12px 200px"}}>  {/* Extra bottom padding so content clears the fixed bar */}
        {borrowers.length===0&&<Card style={{textAlign:"center",padding:28,color:"#8FA3B8"}}>No borrowers in this village.</Card>}
        {borrowers.map((b,i)=>{
          const e=entries[b.id]; const st=e?.status; const dw=b.durationWeeks||12;
          const bc=st==="paid"?"#1A7F4B":st==="skip"?"#C0392B":st==="short"?"#B45309":st==="extra"?"#0B6E9E":"#D8E4EE";
          const bbg=st==="paid"?"#E8F7EF":st==="skip"?"#FDECEA":st==="short"?"#FEF3C7":st==="extra"?"#E6F3FA":"#fff";
          return (
            <div key={b.id} style={{background:bbg,borderRadius:16,border:`1.5px solid ${bc}`,marginBottom:10,padding:14,transition:"all 0.2s"}}>
              <Row style={{marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:30,height:30,borderRadius:10,background:"#E6F3FA",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#0B6E9E",fontSize:b.seqNo?10:13,lineHeight:1.1,flexShrink:0}}>
                    {b.seqNo?<><div style={{fontSize:8,color:"#8FA3B8",fontWeight:600}}>#</div><div>{b.seqNo}</div></>:<div>{i+1}</div>}
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:15,color:"#0D1B2A"}}>{b.name}</div>
                    <div style={{fontSize:11,color:"#8FA3B8"}}>Week {b.weeksPaid+1}/{dw} · Due: {fmt(b.weeklyDue)}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  {st==="paid"&&<div style={{fontSize:24,animation:"pop 0.3s ease"}}>✅</div>}
                  {st==="skip"&&<div style={{fontSize:24}}>❌</div>}
                  {st==="short"&&<div><div style={{fontWeight:800,color:"#B45309",fontSize:14}}>{fmt(e.amtPaid)}</div><div style={{fontSize:10,color:"#8FA3B8"}}>short</div></div>}
                  {st==="extra"&&<div><div style={{fontWeight:800,color:"#0B6E9E",fontSize:14}}>{fmt(e.amtPaid)}</div><div style={{fontSize:10,color:"#8FA3B8"}}>+{fmt(e.extraAmt)} extra</div></div>}
                </div>
              </Row>
              {st==="short"&&e?.note&&<div style={{background:"#FEF3C7",borderRadius:8,padding:"5px 10px",fontSize:12,color:"#B45309",marginBottom:10,border:"1px solid #B4530925"}}>📝 {e.note}</div>}
              {st==="extra"&&(
                <div style={{background:"#E6F3FA",borderRadius:8,padding:"6px 10px",marginBottom:10,border:"1px solid #0B6E9E25",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:12,color:"#0B6E9E",fontWeight:600}}>➕ Extra paid: {fmt(e.extraAmt)}</span>
                  {e.note&&<span style={{fontSize:11,color:"#8FA3B8"}}>📝 {e.note}</span>}
                </div>
              )}
              {st==="paid"&&e?.payMethod&&(
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                  {e.payMethod==="phonepe"
                    ? <div style={{display:"inline-flex",alignItems:"center",gap:5,background:"#6739B7",borderRadius:20,padding:"4px 12px"}}><span style={{fontSize:13}}>📱</span><span style={{fontSize:12,fontWeight:700,color:"#fff"}}>PhonePe</span></div>
                    : e.payMethod==="online"
                    ? <div style={{display:"inline-flex",alignItems:"center",gap:5,background:"#0B6E9E",borderRadius:20,padding:"4px 12px"}}><span style={{fontSize:13}}>🌐</span><span style={{fontSize:12,fontWeight:700,color:"#fff"}}>Online</span></div>
                    : <div style={{display:"inline-flex",alignItems:"center",gap:5,background:"#1A7F4B",borderRadius:20,padding:"4px 12px"}}><span style={{fontSize:13}}>💵</span><span style={{fontSize:12,fontWeight:700,color:"#fff"}}>Cash</span></div>
                  }
                  <span style={{fontSize:11,color:"#8FA3B8"}}>· tap ✅ to change</span>
                </div>
              )}
              {/* 4 action buttons in 2x2 grid */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <button onClick={()=>markPaid(b)} style={{padding:"10px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,transition:"all 0.2s",background:st==="paid"?"#1A7F4B":"#E8F7EF",color:st==="paid"?"#fff":"#1A7F4B"}}>✅ Paid</button>
                <button onClick={()=>markSkip(b)} style={{padding:"10px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,transition:"all 0.2s",background:st==="skip"?"#C0392B":"#FDECEA",color:st==="skip"?"#fff":"#C0392B"}}>❌ Skip</button>
                <button onClick={()=>openShort(b)} style={{padding:"10px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,transition:"all 0.2s",background:st==="short"?"#B45309":"#FEF3C7",color:st==="short"?"#fff":"#B45309"}}>⚡ Short</button>
                <button onClick={()=>openExtra(b)} style={{padding:"10px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,transition:"all 0.2s",background:st==="extra"?"#0B6E9E":"#E6F3FA",color:st==="extra"?"#fff":"#0B6E9E"}}>➕ Extra</button>
              </div>
            </div>
          );
        })}
      </div>
      {/* FIXED BOTTOM BAR — compact, always visible */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#fff",borderTop:"2px solid #D8E4EE",zIndex:300,boxShadow:"0 -4px 20px #0B6E9E15"}}>
        <div style={{padding:"10px 14px 6px"}}>
          <Row style={{marginBottom:8}}>
            <div>
              <div style={{fontSize:10,color:"#8FA3B8"}}>COLLECTED</div>
              <div style={{fontSize:20,fontWeight:900,color:"#1A7F4B",lineHeight:1.1}}>{fmt(totalColl)}</div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:10,color:"#8FA3B8"}}>EXPECTED</div>
              <div style={{fontSize:16,fontWeight:700,color:"#0D1B2A",lineHeight:1.1}}>{fmt(totalExp)}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:"#8FA3B8"}}>SHORTFALL</div>
              <div style={{fontSize:16,fontWeight:700,color:totalExp>totalColl?"#C0392B":"#1A7F4B",lineHeight:1.1}}>{fmt(Math.max(totalExp-totalColl,0))}</div>
            </div>
          </Row>
          <div style={{display:"flex",gap:10,paddingBottom:10}}>
            <button onClick={quickSave}
              style={{flex:1,padding:"13px 0",borderRadius:12,border:"2px solid #1A7F4B",background:"#E8F7EF",cursor:"pointer",fontWeight:800,fontSize:14,color:"#1A7F4B",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              💾 Save & Update
            </button>
            <button onClick={()=>setCashModal(true)}
              style={{flex:1,padding:"13px 0",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1A8ABF,#084D6E)",cursor:"pointer",fontWeight:800,fontSize:14,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:"0 3px 12px #0B6E9E30"}}>
              💰 Record Cash
            </button>
          </div>
        </div>
      </div>
      {/* Payment Method Modal */}
      {payModal&&(
        <div style={{position:"fixed",inset:0,background:"#00000065",zIndex:650,display:"flex",alignItems:"flex-end",justifyContent:"center",animation:"fadeIn 0.18s ease"}}
          onClick={e=>e.target===e.currentTarget&&setPayModal(null)}>
          <div style={{background:"#fff",borderRadius:"22px 22px 0 0",padding:"20px 18px 36px",width:"100%",maxWidth:480,animation:"slideUp 0.25s ease"}}>
            <div style={{fontWeight:800,fontSize:16,color:"#0D1B2A",marginBottom:4}}>💳 How did they pay?</div>
            <div style={{fontSize:13,color:"#8FA3B8",marginBottom:20}}>{payModal.name} · {fmt(payModal.weeklyDue)}</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[
                {id:"cash",   label:"Cash",    icon:"💵", desc:"Paid in hand / cash",        bg:"#E8F7EF", color:"#1A7F4B", border:"#1A7F4B"},
                {id:"phonepe",label:"PhonePe", icon:"📱", desc:"Paid via PhonePe",            bg:"#F3EEFF", color:"#6739B7", border:"#6739B7"},
                {id:"online", label:"Online",  icon:"🌐", desc:"Other UPI / bank transfer",   bg:"#E6F3FA", color:"#0B6E9E", border:"#0B6E9E"},
              ].map(m=>(
                <button key={m.id} onClick={()=>confirmPaid(payModal,m.id)}
                  style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:14,border:`1.5px solid ${m.border}30`,background:m.bg,cursor:"pointer",textAlign:"left",width:"100%",transition:"all 0.15s"}}
                  onMouseDown={e=>e.currentTarget.style.opacity="0.8"}
                  onMouseUp={e=>e.currentTarget.style.opacity="1"}
                  onTouchStart={e=>e.currentTarget.style.opacity="0.8"}
                  onTouchEnd={e=>e.currentTarget.style.opacity="1"}>
                  <div style={{width:46,height:46,borderRadius:14,background:"#fff",border:`1.5px solid ${m.border}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
                    {m.icon}
                  </div>
                  <div>
                    <div style={{fontWeight:800,fontSize:15,color:m.color}}>{m.label}</div>
                    <div style={{fontSize:12,color:"#8FA3B8",marginTop:2}}>{m.desc}</div>
                  </div>
                  <div style={{marginLeft:"auto",fontSize:20,color:m.color}}>›</div>
                </button>
              ))}
            </div>
            <button onClick={()=>setPayModal(null)}
              style={{marginTop:14,width:"100%",padding:"12px",borderRadius:12,border:"1px solid #D8E4EE",background:"#F7F9FC",cursor:"pointer",fontWeight:700,fontSize:14,color:"#8FA3B8"}}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <Sheet open={!!shortModal} onClose={()=>setShortModal(null)} title="⚡ Short Payment">
        {shortModal&&<>
          <div style={{color:"#8FA3B8",fontSize:13,marginBottom:14}}>{shortModal.name} · Full due: {fmt(shortModal.weeklyDue)}</div>
          <Inp label="Amount Paid Today (₹)" type="number" value={shortAmt} onChange={e=>setShortAmt(e.target.value)} placeholder={`Max ₹${shortModal.weeklyDue}`}/>
          <Inp label="Note" value={shortNote} onChange={e=>setShortNote(e.target.value)} placeholder="e.g. Balance next week"/>
          <Card style={{background:"#FEF3C7",border:"1px solid #B4530925",marginBottom:14}}>
            <div style={{fontSize:11,color:"#B45309",fontWeight:700}}>Balance Carry Forward</div>
            <div style={{fontSize:20,fontWeight:800,color:"#B45309",marginTop:4}}>{fmt((shortModal.weeklyDue)-(parseInt(shortAmt)||0))}</div>
          </Card>
          <div style={{display:"flex",gap:10}}>
            <Btn variant="white" onClick={()=>setShortModal(null)} style={{flex:1}}>Cancel</Btn>
            <Btn onClick={saveShort} style={{flex:1}}>Save</Btn>
          </div>
        </>}
      </Sheet>
      {/* Extra Payment Modal */}
      <Sheet open={!!extraModal} onClose={()=>setExtraModal(null)} title="➕ Extra Payment">
        {extraModal&&<>
          <div style={{background:"#E6F3FA",borderRadius:10,padding:"10px 14px",marginBottom:14}}>
            <div style={{fontSize:13,color:"#0B6E9E",fontWeight:700}}>{extraModal.name}</div>
            <div style={{fontSize:12,color:"#8FA3B8",marginTop:2}}>Weekly due: {fmt(extraModal.weeklyDue)} · They paid MORE than this</div>
          </div>
          <div style={{background:"#E8F7EF",borderRadius:10,padding:"10px 14px",marginBottom:14,border:"1px solid #1A7F4B30"}}>
            <Row>
              <span style={{fontSize:13,color:"#8FA3B8"}}>Weekly EMI (auto-included)</span>
              <span style={{fontSize:14,fontWeight:800,color:"#1A7F4B"}}>{fmt(extraModal.weeklyDue)}</span>
            </Row>
          </div>
          <div style={{fontSize:11,fontWeight:700,color:"#8FA3B8",marginBottom:6,textTransform:"uppercase",letterSpacing:0.7}}>Extra Amount Paid (₹)</div>
          <input type="number" value={extraAmt} placeholder="e.g. 500"
            onChange={e=>setExtraAmt(e.target.value)}
            style={{width:"100%",padding:"13px 14px",borderRadius:10,border:"1.5px solid #0B6E9E50",background:"#F7F9FC",fontSize:16,fontWeight:700,outline:"none",boxSizing:"border-box",color:"#0B6E9E",marginBottom:12}}/>
          {extraAmt&&parseInt(extraAmt)>0&&(
            <div style={{background:"#E6F3FA",borderRadius:10,padding:"12px 14px",marginBottom:12,border:"1px solid #0B6E9E30"}}>
              <Row>
                <span style={{fontSize:13,color:"#8FA3B8"}}>EMI collected</span>
                <span style={{fontSize:14,fontWeight:700,color:"#1A7F4B"}}>{fmt(extraModal.weeklyDue)}</span>
              </Row>
              <Row style={{marginTop:4}}>
                <span style={{fontSize:13,color:"#8FA3B8"}}>Extra collected</span>
                <span style={{fontSize:14,fontWeight:700,color:"#0B6E9E"}}>{fmt(parseInt(extraAmt)||0)}</span>
              </Row>
              <div style={{height:1,background:"#D8E4EE",margin:"6px 0"}}/>
              <Row>
                <span style={{fontSize:13,fontWeight:700,color:"#0D1B2A"}}>Total collected</span>
                <span style={{fontSize:16,fontWeight:900,color:"#0B6E9E"}}>{fmt(extraModal.weeklyDue+(parseInt(extraAmt)||0))}</span>
              </Row>
            </div>
          )}
          <div style={{fontSize:11,fontWeight:700,color:"#8FA3B8",marginBottom:6,textTransform:"uppercase",letterSpacing:0.7}}>Note (optional)</div>
          <input type="text" value={extraNote} placeholder="e.g. paid 2 weeks together"
            onChange={e=>setExtraNote(e.target.value)}
            style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid #D8E4EE",background:"#F7F9FC",fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:16}}/>
          <div style={{display:"flex",gap:10}}>
            <Btn variant="white" onClick={()=>setExtraModal(null)} style={{flex:1}}>Cancel</Btn>
            <Btn onClick={saveExtra} style={{flex:1,background:"linear-gradient(135deg,#1A8ABF,#084D6E)"}}>Save Extra</Btn>
          </div>
        </>}
      </Sheet>

      <Sheet open={cashModal} onClose={()=>setCashModal(false)} title="💰 Record Cash Usage">
        <Card style={{background:"#E8F7EF",border:"1px solid #1A7F4B25",marginBottom:14}}>
          <div style={{fontSize:11,color:"#8FA3B8"}}>Cash Collected Today</div>
          <div style={{fontSize:26,fontWeight:900,color:"#1A7F4B"}}>{fmt(totalColl)}</div>
        </Card>
        <div style={{background:"#E6F3FA",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#0B6E9E"}}>
          💡 New loans given are automatically tracked when you add a new borrower.
        </div>
        <Inp label="Taken for Personal Use (₹)" type="number" value={personal} onChange={e=>setPersonal(e.target.value)} placeholder="0" note="Amount you kept for personal use from today's collection"/>
        <Card style={{background:"#E6F3FA",border:"1px solid #0B6E9E25",marginBottom:14}}>
          <Row>
            <div style={{fontSize:13,color:"#4A6080"}}>Remaining Cash Balance</div>
            <div style={{fontWeight:900,fontSize:18,color:"#0B6E9E"}}>{fmt(totalColl-(parseInt(personal)||0))}</div>
          </Row>
        </Card>
        <div style={{display:"flex",gap:10}}>
          <Btn variant="white" onClick={()=>setCashModal(false)} style={{flex:1}}>Back</Btn>
          <Btn onClick={finishSave} variant="gold" style={{flex:1}}>Save & Close ✓</Btn>
        </div>
      </Sheet>
    </div>
  );
  return null;
}

// ── BORROWERS TAB ──
function BorrowersTab({data}){
  const [search,setSearch]=useState("");
  const [selB,setSelB]=useState(null);
  const allB=Object.entries(data.borrowers).flatMap(([vid,bs])=>bs.map(b=>({...b,villageId:vid,vName:data.villages.find(v=>v.id===vid)?.name||""})));
  const fil=allB.filter(b=>b.name.toLowerCase().includes(search.toLowerCase())||(b.phone||"").includes(search)||b.vName.toLowerCase().includes(search.toLowerCase()));
  return (
    <div style={{background:"#F0F4F8",minHeight:"100vh"}}>
      <Nav title="All Borrowers"/>
      <div style={{padding:"14px 14px 100px"}}>
        <div style={{position:"relative",marginBottom:14}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:15}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, village..." style={{width:"100%",padding:"11px 14px 11px 36px",borderRadius:12,border:"1.5px solid #D8E4EE",background:"#fff",color:"#0D1B2A",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{fontSize:12,color:"#8FA3B8",marginBottom:12,fontWeight:600}}>{fil.length} borrower{fil.length!==1?"s":""} {search?"found":"total"}</div>
        {fil.length===0&&<Card style={{textAlign:"center",padding:32,color:"#8FA3B8"}}>No borrowers found.</Card>}
        {fil.map((b,i)=>{
          const dw=b.durationWeeks||12; const fin=b.weeksPaid>=dw;
          const pct=Math.min(b.weeksPaid/dw,1);
          const totalExtraPaid=(b.history||[]).filter(h=>h.status==="extra").reduce((s,h)=>s+(h.extraAmt||0),0);
          const rem=Math.max((b.totalReturn||0)-(b.weeksPaid*b.weeklyDue)-totalExtraPaid,0);
          return (
            <Card key={b.id} style={{padding:14,cursor:"pointer"}} onClick={()=>setSelB(b)}>
              <Row style={{marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:38,height:38,borderRadius:12,background:"#E6F3FA",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#0B6E9E",fontSize:b.seqNo?10:13,lineHeight:1.1,flexShrink:0}}>
                    {b.seqNo?<><div style={{fontSize:8,color:"#8FA3B8",fontWeight:600}}>#</div><div>{b.seqNo}</div></>:<div>{String(i+1).padStart(2,"0")}</div>}
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#0D1B2A"}}>{b.name}</div>
                    <div style={{fontSize:11,color:"#8FA3B8"}}>{b.vName} · {b.phone||"No phone"}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {fin?<Chip color="#1A7F4B" bg="#E8F7EF">✓ Done</Chip>:<Chip>Wk {b.weeksPaid}/{dw}</Chip>}
                  <span style={{color:"#0B6E9E",fontSize:18}}>›</span>
                </div>
              </Row>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:8}}>
                {[{l:"Loan",v:fmt(b.loanAmt),c:"#0B6E9E"},{l:"Weekly",v:fmt(b.weeklyDue),c:"#C8960C"},{l:"Return",v:fmt(b.totalReturn||0),c:"#1A7F4B"},{l:"Remaining",v:fmt(rem),c:rem>0?"#B45309":"#1A7F4B"}].map((s,j)=>(
                  <div key={j} style={{background:"#F7F9FC",borderRadius:8,padding:"6px 4px",textAlign:"center",border:"1px solid #EBF0F5"}}>
                    <div style={{fontWeight:800,fontSize:11,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:9,color:"#8FA3B8",marginTop:1}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{background:"#EBF0F5",borderRadius:4,height:4}}>
                <div style={{width:`${pct*100}%`,height:4,borderRadius:4,background:fin?"#1A7F4B":"#0B6E9E"}}/>
              </div>
            </Card>
          );
        })}
      </div>
      <Sheet open={!!selB} onClose={()=>setSelB(null)} title={selB?.name||""}>
        {selB&&(()=>{
          const dw=selB.durationWeeks||12;
          const hist=selB.history||[];
          const totalExtraPaid=hist.filter(h=>h.status==="extra").reduce((s,h)=>s+(h.extraAmt||0),0);
          const rem=Math.max((selB.totalReturn||0)-(selB.weeksPaid*selB.weeklyDue)-totalExtraPaid,0);
          const paidCount=hist.filter(h=>h.status==="paid").length;
          const skipCount=hist.filter(h=>h.status==="skip").length;
          const shortCount=hist.filter(h=>h.status==="short").length;
          const extraCount=hist.filter(h=>h.status==="extra").length;
          const totalPaidAmt=hist.reduce((s,h)=>s+(h.amtPaid||0),0);
          const totalShortfall=hist.filter(h=>h.status==="short").reduce((s,h)=>s+((selB.weeklyDue-(h.amtPaid||0))),0);
          return (
            <>
              <Card style={{background:"linear-gradient(135deg,#084D6E,#1A8ABF)",border:"none",color:"#fff",padding:16,marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                  {selB.seqNo&&<div style={{background:"rgba(245,200,66,0.25)",borderRadius:8,padding:"2px 10px",fontSize:12,fontWeight:800,color:"#F5C842"}}>#{selB.seqNo}</div>}
                  <div style={{fontSize:18,fontWeight:900}}>{selB.name}</div>
                </div>
                <div style={{fontSize:12,opacity:0.7,marginTop:2}}>{selB.vName} · {selB.phone||"No phone"}</div>
                <div style={{fontSize:11,opacity:0.6,marginTop:2}}>Started: {dateLabel(selB.startDate)}</div>
                {selB.isOngoing&&<div style={{marginTop:6,background:"rgba(245,200,66,0.2)",borderRadius:8,padding:"4px 10px",fontSize:11,color:"#F5C842",display:"inline-block"}}>⚡ Pre-existing loan</div>}
              </Card>

              {/* Point 7 — Skip alert */}
              {skipCount>0&&(
                <div style={{background:"#FDECEA",border:"1.5px solid #C0392B40",borderRadius:12,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>🚨</span>
                  <div>
                    <div style={{fontWeight:800,color:"#C0392B",fontSize:13}}>{skipCount} Week{skipCount>1?"s":""} Skipped</div>
                    <div style={{fontSize:12,color:"#C0392B",opacity:0.8}}>Duration extended to {dw} weeks · {dw-selB.weeksPaid} weeks remaining</div>
                  </div>
                </div>
              )}

              {/* Point 1 — Total paid and outstanding balance */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                <div style={{background:"#E8F7EF",borderRadius:12,padding:"12px 14px",border:"1px solid #1A7F4B30"}}>
                  <div style={{fontSize:11,color:"#8FA3B8",marginBottom:4}}>Total Paid So Far</div>
                  <div style={{fontWeight:900,fontSize:18,color:"#1A7F4B"}}>{fmt(totalPaidAmt)}</div>
                  <div style={{fontSize:11,color:"#8FA3B8",marginTop:2}}>{paidCount+shortCount} payments recorded</div>
                </div>
                <div style={{background:rem>0?"#FEF3C7":"#E8F7EF",borderRadius:12,padding:"12px 14px",border:`1px solid ${rem>0?"#B4530930":"#1A7F4B30"}`}}>
                  <div style={{fontSize:11,color:"#8FA3B8",marginBottom:4}}>Balance Remaining</div>
                  <div style={{fontWeight:900,fontSize:18,color:rem>0?"#B45309":"#1A7F4B"}}>{fmt(rem)}</div>
                  <div style={{fontSize:11,color:"#8FA3B8",marginTop:2}}>{dw-selB.weeksPaid} weeks left</div>
                </div>
              </div>
              {totalShortfall>0&&(
                <div style={{background:"#FEF3C7",border:"1px solid #B4530930",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                  <div style={{fontWeight:700,color:"#B45309",fontSize:13}}>⚡ Total Unpaid Short Amount</div>
                  <div style={{fontWeight:900,fontSize:18,color:"#B45309",marginTop:2}}>{fmt(totalShortfall)}</div>
                  <div style={{fontSize:11,color:"#8FA3B8",marginTop:2}}>Across {shortCount} short payment week{shortCount>1?"s":""}</div>
                </div>
              )}

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                {[{l:"Loan Given",v:fmt(selB.loanAmt),c:"#0B6E9E"},{l:"Weekly Due",v:fmt(selB.weeklyDue),c:"#C8960C"},{l:"Total Return",v:fmt(selB.totalReturn||0),c:"#1A7F4B"},{l:"Wks Paid",v:`${selB.weeksPaid}/${dw}`,c:"#0B6E9E"},{l:"Interest",v:`${selB.interestPct||0}%`,c:"#B45309"},{l:"Skipped",v:skipCount,c:skipCount>0?"#C0392B":"#8FA3B8"}].map((s,i)=>(
                  <div key={i} style={{background:"#F7F9FC",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid #EBF0F5"}}>
                    <div style={{fontWeight:800,fontSize:13,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:10,color:"#8FA3B8",marginTop:2}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                <Chip color="#1A7F4B" bg="#E8F7EF">✅ {paidCount} paid</Chip>
                <Chip color="#C0392B" bg="#FDECEA">❌ {skipCount} skipped</Chip>
                <Chip color="#B45309" bg="#FEF3C7">⚡ {shortCount} short</Chip>
                {extraCount>0&&<Chip color="#0B6E9E" bg="#E6F3FA">➕ {extraCount} extra</Chip>}
                {totalExtraPaid>0&&<Chip color="#0B6E9E" bg="#E6F3FA">+{fmt(totalExtraPaid)} extra paid</Chip>}
              </div>
              <div style={{marginBottom:14}}>
                <Row style={{marginBottom:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#4A6080"}}>Payment Progress</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#0B6E9E"}}>{Math.round((selB.weeksPaid/dw)*100)}%</span>
                </Row>
                <div style={{background:"#EBF0F5",borderRadius:6,height:8}}>
                  <div style={{width:`${Math.min((selB.weeksPaid/dw)*100,100)}%`,height:8,borderRadius:6,background:selB.weeksPaid>=dw?"#1A7F4B":"#0B6E9E"}}/>
                </div>
              </div>

              {/* Point 2 — Full week by week history with all details */}
              <SecLabel>Full Week-by-Week History</SecLabel>
              {hist.length===0&&<div style={{color:"#8FA3B8",fontSize:13,textAlign:"center",padding:"16px 0"}}>No payment history recorded yet via app.</div>}
              {selB.isOngoing&&selB.weeksPaid>hist.length&&(
                <div style={{background:"#FEF3C7",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:12,color:"#B45309"}}>⚡ {selB.weeksPaid-hist.length} week(s) paid before app was started (pre-existing)</div>
              )}
              {hist.map((h,i)=>{
                const ic=h.status==="paid"?"✅":h.status==="skip"?"❌":h.status==="extra"?"➕":"⚡";
                const col=h.status==="paid"?"#1A7F4B":h.status==="skip"?"#C0392B":h.status==="extra"?"#0B6E9E":"#B45309";
                const bg2=h.status==="paid"?"#E8F7EF":h.status==="skip"?"#FDECEA":h.status==="extra"?"#E6F3FA":"#FEF3C7";
                const wkNum=(selB.isOngoing?(selB.weeksPaid-hist.length):0)+i+1;
                const shortAmt2=h.status==="short"?(selB.weeklyDue-(h.amtPaid||0)):0;
                return (
                  <div key={i} style={{background:bg2,borderRadius:12,padding:"12px 14px",marginBottom:8,border:`1px solid ${col}25`}}>
                    <Row style={{marginBottom:h.status==="short"?8:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:20}}>{ic}</div>
                        <div>
                          <div style={{fontWeight:800,fontSize:13,color:"#0D1B2A"}}>
                            Week {wkNum}
                          </div>
                          <div style={{fontSize:11,color:"#8FA3B8",marginTop:1}}>
                            {h.date?`${dayName(h.date)}, ${dateLabel(h.date)}`:"Date not recorded"}
                          </div>
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontWeight:800,fontSize:14,color:col}}>{h.status!=="skip"?fmt(h.amtPaid):"—"}</div>
                        <div style={{fontSize:10,color:"#8FA3B8",marginTop:1}}>
                          {h.status==="paid"&&"Full payment"}
                          {h.status==="skip"&&"+1 week extended"}
                          {h.status==="short"&&"Short paid"}
                          {h.status==="extra"&&`+${fmt(h.extraAmt||0)} extra`}
                        </div>
                      </div>
                    </Row>
                    {h.status==="short"&&(
                      <div style={{background:"rgba(255,255,255,0.6)",borderRadius:8,padding:"6px 10px",marginTop:4}}>
                        <Row>
                          <span style={{fontSize:12,color:"#B45309",fontWeight:600}}>Balance unpaid this week:</span>
                          <span style={{fontSize:13,fontWeight:800,color:"#C0392B"}}>{fmt(shortAmt2)}</span>
                        </Row>
                        {h.note&&<div style={{fontSize:11,color:"#8FA3B8",marginTop:3}}>📝 {h.note}</div>}
                      </div>
                    )}
                    {h.status==="extra"&&(
                      <div style={{background:"rgba(255,255,255,0.6)",borderRadius:8,padding:"8px 10px",marginTop:4,border:"1px solid #0B6E9E20"}}>
                        <Row>
                          <span style={{fontSize:12,color:"#8FA3B8"}}>Weekly EMI</span>
                          <span style={{fontSize:13,fontWeight:700,color:"#1A7F4B"}}>{fmt((h.amtPaid||0)-(h.extraAmt||0))}</span>
                        </Row>
                        <Row style={{marginTop:3}}>
                          <span style={{fontSize:12,color:"#0B6E9E",fontWeight:600}}>➕ Extra paid</span>
                          <span style={{fontSize:13,fontWeight:800,color:"#0B6E9E"}}>{fmt(h.extraAmt||0)}</span>
                        </Row>
                        {h.note&&<div style={{fontSize:11,color:"#8FA3B8",marginTop:3}}>📝 {h.note}</div>}
                      </div>
                    )}
                    {h.status==="paid"&&h.payMethod&&(
                      <div style={{marginTop:6}}>
                        {h.payMethod==="phonepe"
                          ? <span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#6739B7",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700,color:"#fff"}}>📱 PhonePe</span>
                          : h.payMethod==="online"
                          ? <span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#0B6E9E",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700,color:"#fff"}}>🌐 Online</span>
                          : <span style={{display:"inline-flex",alignItems:"center",gap:4,background:"#1A7F4B",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:700,color:"#fff"}}>💵 Cash</span>
                        }
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          );
        })()}
      </Sheet>
    </div>
  );
}

// ── REPORTS TAB ──
function ReportsTab({data,collections,expenses}){
  const [view,setView]=useState("summary");
  const [selWeek,setSelWeek]=useState(null);
  const allC=Object.values(collections); const allB=Object.values(data.borrowers).flat();
  const tLent=allB.reduce((s,b)=>s+b.loanAmt,0);
  const tRet=allB.reduce((s,b)=>s+(b.totalReturn||0),0);
  const tInt=tRet-tLent;
  const tColl=allC.reduce((s,c)=>s+(c.totalCollected||0),0);
  const tShort=allC.reduce((s,c)=>s+Math.max((c.totalExpected||0)-(c.totalCollected||0),0),0);
  const tExp=expenses.reduce((s,e)=>s+e.amt,0);
  const tPer=allC.reduce((s,c)=>s+(c.personalUse||0),0);
  const net=tColl-tExp-tPer;
  const weeksList=useMemo(()=>getWeeksList(collections),[collections]);
  // FIX 3: Cover full Mon→Sun week
  const collsInWeek=monday=>{
    const start=new Date(monday+"T00:00:00");
    const weekDates=[];
    for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);weekDates.push(d.toISOString().split("T")[0]);}
    return allC.filter(c=>weekDates.includes(c.date));
  };
  return (
    <div style={{background:"#F0F4F8",minHeight:"100vh"}}>
      <Nav title={selWeek?`Week of ${dateLabel(selWeek)}`:"Reports"} onBack={selWeek?()=>setSelWeek(null):undefined}/>
      <div style={{padding:"14px 14px 100px"}}>
        {!selWeek&&(
          <div style={{display:"flex",background:"#fff",borderRadius:14,padding:4,marginBottom:16,border:"1px solid #D8E4EE"}}>
            {[["summary","📊 Summary"],["weeks","📅 Weeks"],["villages","🏘️ Villages"],["history","🗂 History"]].map(([k,l])=>(
              <button key={k} onClick={()=>setView(k)} style={{flex:1,padding:"9px 4px",borderRadius:11,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,transition:"all 0.2s",background:view===k?"#0B6E9E":"transparent",color:view===k?"#fff":"#8FA3B8"}}>{l}</button>
            ))}
          </div>
        )}
        {!selWeek&&view==="summary"&&<>
          <Card style={{background:"linear-gradient(135deg,#084D6E,#1A8ABF)",border:"none",color:"#fff",padding:20,marginBottom:14}}>
            <div style={{fontSize:12,opacity:0.7}}>Overall Net Profit</div>
            <div style={{fontSize:28,fontWeight:900,marginTop:4}}>{fmt(net)}</div>
            <div style={{fontSize:11,opacity:0.6,marginTop:2}}>Collected – Expenses – Personal Use</div>
          </Card>
          {[{ic:"💸",l:"Total Lent Out",v:fmt(tLent),c:"#0B6E9E",bg:"#E6F3FA"},{ic:"📈",l:"Expected Return",v:fmt(tRet),c:"#1A7F4B",bg:"#E8F7EF"},{ic:"💰",l:"Total Interest",v:fmt(tInt),c:"#C8960C",bg:"#FDF8E7"},{ic:"✅",l:"Total Collected",v:fmt(tColl),c:"#1A7F4B",bg:"#E8F7EF"},{ic:"⚠️",l:"Total Shortfall",v:fmt(tShort),c:"#C0392B",bg:"#FDECEA"},{ic:"🏠",l:"Personal Withdrawals",v:fmt(tPer),c:"#B45309",bg:"#FEF3C7"},{ic:"🧾",l:"Total Expenses",v:fmt(tExp),c:"#C0392B",bg:"#FDECEA"}].map((s,i)=>(
            <Card key={i} style={{padding:14}}>
              <Row>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:34,height:34,borderRadius:10,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{s.ic}</div>
                  <div style={{fontWeight:600,color:"#4A6080",fontSize:14}}>{s.l}</div>
                </div>
                <div style={{fontWeight:800,fontSize:15,color:s.c}}>{s.v}</div>
              </Row>
            </Card>
          ))}
        </>}
        {!selWeek&&view==="weeks"&&<>
          <Card style={{background:"#FDF8E7",border:"1px solid #C8960C30",padding:14,marginBottom:14}}>
            <div style={{fontSize:12,color:"#C8960C",fontWeight:700}}>📅 Weekly Records</div>
            <div style={{fontSize:13,color:"#4A6080",marginTop:4}}>Tap any week to view full report & borrower-wise breakdown</div>
          </Card>
          {weeksList.length===0&&<Card style={{textAlign:"center",padding:32,color:"#8FA3B8"}}>No weekly records yet. Complete a collection first.</Card>}
          {weeksList.map((monday,i)=>{
            const wColls=collsInWeek(monday);
            const wColl=wColls.reduce((s,c)=>s+(c.totalCollected||0),0);
            const wExp=wColls.reduce((s,c)=>s+(c.totalExpected||0),0);
            const wSkip=wColls.reduce((s,c)=>s+(c.entries||[]).filter(e=>e.status==="skip").length,0);
            const tue=new Date(monday+"T00:00:00"); tue.setDate(tue.getDate()+6);
            const weekNum=weeksList.length-i;
            return (
              <Card key={monday} onClick={()=>setSelWeek(monday)} style={{cursor:"pointer",padding:14}}>
                <Row style={{marginBottom:8}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:28,height:28,borderRadius:8,background:"#E6F3FA",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#0B6E9E",fontSize:13}}>{weekNum}</div>
                      <div style={{fontWeight:700,color:"#0D1B2A"}}>Week {weekNum}</div>
                    </div>
                    <div style={{fontSize:12,color:"#8FA3B8",marginTop:4}}>{dateLabel(monday)} → {dateLabel(tue.toISOString().split("T")[0])}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontWeight:800,color:"#1A7F4B",fontSize:14}}>{fmt(wColl)}</div>
                    <div style={{fontSize:11,color:"#8FA3B8"}}>collected</div>
                  </div>
                </Row>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <Chip>{wColls.length} visit{wColls.length!==1?"s":""}</Chip>
                  {wSkip>0&&<Chip color="#C0392B" bg="#FDECEA">❌ {wSkip} skipped</Chip>}
                  {wColl<wExp&&wExp>0&&<Chip color="#B45309" bg="#FEF3C7">⚠️ {fmt(wExp-wColl)} shortfall</Chip>}
                </div>
                <div style={{float:"right",color:"#0B6E9E",fontSize:18,marginTop:-22}}>›</div>
              </Card>
            );
          })}
        </>}
        {selWeek&&(()=>{
          const wColls=collsInWeek(selWeek);
          const wColl=wColls.reduce((s,c)=>s+(c.totalCollected||0),0);
          const wExp=wColls.reduce((s,c)=>s+(c.totalExpected||0),0);
          const wNew=wColls.reduce((s,c)=>s+(c.newLoans||0),0);
          const wPers=wColls.reduce((s,c)=>s+(c.personalUse||0),0);
          const weekNum=weeksList.length-weeksList.indexOf(selWeek);
          const tue=new Date(selWeek+"T00:00:00"); tue.setDate(tue.getDate()+6);
          return <>
            <Card style={{background:"linear-gradient(135deg,#084D6E,#1A8ABF)",border:"none",color:"#fff",padding:18,marginBottom:14}}>
              <div style={{fontSize:12,opacity:0.7}}>Week {weekNum} Report</div>
              <div style={{fontSize:20,fontWeight:900,marginTop:2}}>{fmt(wColl)} Collected</div>
              <div style={{fontSize:12,opacity:0.6,marginTop:4}}>{dateLabel(selWeek)} → {dateLabel(tue.toISOString().split("T")[0])}</div>
            </Card>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[{l:"Collected",v:fmt(wColl),c:"#1A7F4B",bg:"#E8F7EF"},{l:"Expected",v:fmt(wExp),c:"#0B6E9E",bg:"#E6F3FA"},{l:"Shortfall",v:fmt(Math.max(wExp-wColl,0)),c:"#C0392B",bg:"#FDECEA"},{l:"New Loans",v:fmt(wNew),c:"#B45309",bg:"#FEF3C7"},{l:"Personal Use",v:fmt(wPers),c:"#B45309",bg:"#FEF3C7"},{l:"Village Visits",v:wColls.length,c:"#0B6E9E",bg:"#E6F3FA"}].map((s,i)=>(
                <Card key={i} style={{marginBottom:0,padding:14}}>
                  <div style={{fontWeight:800,fontSize:16,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:11,color:"#8FA3B8",marginTop:3}}>{s.l}</div>
                </Card>
              ))}
            </div>
            <SecLabel>Village Collections This Week</SecLabel>
            {wColls.map((c,i)=>(
              <Card key={i} style={{padding:14}}>
                <Row style={{marginBottom:8}}>
                  <div><div style={{fontWeight:700,color:"#0D1B2A"}}>{c.villageName}</div><div style={{fontSize:12,color:"#8FA3B8"}}>{dayName(c.date)}, {dateLabel(c.date)}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontWeight:800,color:"#1A7F4B"}}>{fmt(c.totalCollected)}</div><div style={{fontSize:11,color:"#8FA3B8"}}>of {fmt(c.totalExpected)}</div></div>
                </Row>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                  {(c.entries||[]).filter(e=>e.status==="paid").length>0&&<Chip color="#1A7F4B" bg="#E8F7EF">✅ {(c.entries||[]).filter(e=>e.status==="paid").length}</Chip>}
                  {(c.entries||[]).filter(e=>e.status==="skip").length>0&&<Chip color="#C0392B" bg="#FDECEA">❌ {(c.entries||[]).filter(e=>e.status==="skip").length}</Chip>}
                  {(c.entries||[]).filter(e=>e.status==="short").length>0&&<Chip color="#B45309" bg="#FEF3C7">⚡ {(c.entries||[]).filter(e=>e.status==="short").length}</Chip>}
                </div>
                {(c.entries||[]).map((e,j)=>{
                  const b=(data.borrowers[c.villageId]||[]).find(x=>x.id===e.borrowerId);
                  if(!b) return null;
                  const ic=e.status==="paid"?"✅":e.status==="skip"?"❌":"⚡";
                  const col=e.status==="paid"?"#1A7F4B":e.status==="skip"?"#C0392B":"#B45309";
                  return (
                    <div key={j} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderTop:"1px solid #EBF0F5"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:13,color:"#0D1B2A"}}>{ic} {b.name}</span>
                        {e.status==="paid"&&e.payMethod&&(
                          e.payMethod==="phonepe"
                            ? <span style={{fontSize:10,background:"#6739B7",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>📱 PhonePe</span>
                            : e.payMethod==="online"
                            ? <span style={{fontSize:10,background:"#0B6E9E",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>🌐 Online</span>
                            : <span style={{fontSize:10,background:"#1A7F4B",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>💵 Cash</span>
                        )}
                      </div>
                      <span style={{fontSize:13,fontWeight:700,color:col}}>{e.status!=="skip"?fmt(e.amtPaid):"—"}</span>
                    </div>
                  );
                })}
              </Card>
            ))}
          </>;
        })()}
        {!selWeek&&view==="villages"&&data.villages.map(v=>{
          const bs=data.borrowers[v.id]||[];
          const tL=bs.reduce((s,b)=>s+b.loanAmt,0); const tR=bs.reduce((s,b)=>s+(b.totalReturn||0),0);
          const vC=allC.filter(c=>c.villageId===v.id); const vCol=vC.reduce((s,c)=>s+(c.totalCollected||0),0);
          const ac=bs.filter(b=>b.weeksPaid<(b.durationWeeks||12)).length;
          return (
            <Card key={v.id} style={{padding:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <div style={{width:40,height:40,borderRadius:12,background:"#E6F3FA",border:"1.5px solid #0B6E9E25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🏘️</div>
                <div><div style={{fontWeight:800,fontSize:15,color:"#0D1B2A"}}>{v.name}</div><div style={{fontSize:12,color:"#8FA3B8"}}>{v.day} · {bs.length} borrowers · {ac} active</div></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[{l:"Total Lent",v:fmt(tL),c:"#0B6E9E"},{l:"Expected Return",v:fmt(tR),c:"#1A7F4B"},{l:"Collected So Far",v:fmt(vCol),c:"#C8960C"},{l:"Collection Visits",v:vC.length,c:"#0D1B2A"}].map((s,j)=>(
                  <div key={j} style={{background:"#F7F9FC",borderRadius:10,padding:"10px 12px",border:"1px solid #EBF0F5"}}>
                    <div style={{fontWeight:800,fontSize:14,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:11,color:"#8FA3B8",marginTop:2}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
        {!selWeek&&view==="history"&&<>
          {allC.length===0&&<Card style={{textAlign:"center",padding:32,color:"#8FA3B8"}}>No collections recorded yet.</Card>}
          {allC.sort((a,b)=>b.date.localeCompare(a.date)).map((c,i)=>(
            <Card key={i} style={{padding:14}}>
              <Row style={{marginBottom:8}}>
                <div><div style={{fontWeight:700,color:"#0D1B2A"}}>{c.villageName}</div><div style={{fontSize:12,color:"#8FA3B8"}}>{dayName(c.date)}, {dateLabel(c.date)}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontWeight:800,color:"#1A7F4B"}}>{fmt(c.totalCollected)}</div><div style={{fontSize:11,color:"#8FA3B8"}}>of {fmt(c.totalExpected)}</div></div>
              </Row>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {(c.entries||[]).filter(e=>e.status==="paid").length>0&&<Chip color="#1A7F4B" bg="#E8F7EF">✅ {(c.entries||[]).filter(e=>e.status==="paid").length} paid</Chip>}
                {(c.entries||[]).filter(e=>e.status==="skip").length>0&&<Chip color="#C0392B" bg="#FDECEA">❌ {(c.entries||[]).filter(e=>e.status==="skip").length} skip</Chip>}
                {(c.entries||[]).filter(e=>e.status==="short").length>0&&<Chip color="#B45309" bg="#FEF3C7">⚡ {(c.entries||[]).filter(e=>e.status==="short").length} short</Chip>}
              </div>
            </Card>
          ))}
        </>}
      </div>
    </div>
  );
}

// ── CALENDAR TAB ──
function CalendarTab({collections}){
  const now=new Date();
  const [year,setYear]=useState(now.getFullYear());
  const [month,setMonth]=useState(now.getMonth());
  const collDates=new Set(Object.values(collections).map(c=>c.date));
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const cells=[]; for(let i=0;i<firstDay;i++) cells.push(null); for(let d=1;d<=daysInMonth;d++) cells.push(d);
  const isMonday=d=>new Date(year,month,d).getDay()===1;
  const isTuesday=d=>new Date(year,month,d).getDay()===2;
  const isToday=d=>d===now.getDate()&&month===now.getMonth()&&year===now.getFullYear();
  const isCollected=d=>{const ds=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;return collDates.has(ds);};
  const prevMonth=()=>{if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);};
  const nextMonth=()=>{if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);};
  return (
    <div style={{background:"#F0F4F8",minHeight:"100vh"}}>
      <Nav title="Calendar"/>
      <div style={{padding:"14px 14px 100px"}}>
        <Card style={{padding:0,overflow:"hidden",marginBottom:14}}>
          <div style={{background:"linear-gradient(135deg,#084D6E,#1A8ABF)",padding:"16px 20px"}}>
            <Row>
              <button onClick={prevMonth} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:10,width:36,height:36,color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              <div style={{color:"#fff",fontWeight:800,fontSize:18}}>{MONTHS[month]} {year}</div>
              <button onClick={nextMonth} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:10,width:36,height:36,color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </Row>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:"#E6F3FA"}}>
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d,i)=>(
              <div key={d} style={{textAlign:"center",padding:"8px 0",fontSize:12,fontWeight:800,color:(i===1||i===2)?"#0B6E9E":"#8FA3B8"}}>{d}</div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"8px 4px 12px",gap:2}}>
            {cells.map((d,i)=>{
              if(!d) return <div key={i}/>;
              const mon=isMonday(d),tue=isTuesday(d),tod=isToday(d),col=isCollected(d),visit=mon||tue;
              return (
                <div key={i} style={{textAlign:"center",padding:"6px 2px",borderRadius:10,background:col?"#1A7F4B":tod?"#0B6E9E":visit?"#E6F3FA":"transparent",border:tod?"2px solid #0B6E9E":"none"}}>
                  <div style={{fontSize:14,fontWeight:(visit||tod||col)?800:400,color:col?"#fff":tod?"#fff":visit?"#0B6E9E":"#0D1B2A"}}>{d}</div>
                  {visit&&!col&&<div style={{width:5,height:5,borderRadius:3,background:"#0B6E9E",margin:"2px auto 0"}}/>}
                  {col&&<div style={{width:5,height:5,borderRadius:3,background:"#fff",margin:"2px auto 0"}}/>}
                </div>
              );
            })}
          </div>
        </Card>
        <Card style={{padding:14}}>
          <div style={{fontWeight:700,color:"#0D1B2A",marginBottom:12}}>Legend</div>
          {[{bg:"#E6F3FA",label:"Monday / Tuesday — Village Visit Days",dot:"#0B6E9E"},{bg:"#1A7F4B",label:"Collection Done ✓",dot:"#fff"},{bg:"#0B6E9E",label:"Today",dot:"#fff"}].map((item,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:32,height:32,borderRadius:10,background:item.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{width:8,height:8,borderRadius:4,background:item.dot}}/>
              </div>
              <div style={{fontSize:13,color:"#4A6080"}}>{item.label}</div>
            </div>
          ))}
        </Card>
        <SecLabel>This Month's Collections</SecLabel>
        {Object.values(collections).filter(c=>{const cd=new Date(c.date+"T00:00:00");return cd.getMonth()===month&&cd.getFullYear()===year;}).sort((a,b)=>b.date.localeCompare(a.date)).map((c,i)=>(
          <Card key={i} style={{padding:14}}>
            <Row>
              <div><div style={{fontWeight:700,color:"#0D1B2A"}}>{c.villageName}</div><div style={{fontSize:12,color:"#8FA3B8"}}>{dayName(c.date)}, {dateLabel(c.date)}</div></div>
              <Chip color="#1A7F4B" bg="#E8F7EF">{fmt(c.totalCollected)}</Chip>
            </Row>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── CALCULATOR TAB ──
function CalculatorTab(){
  const [display,setDisplay]=useState("0");
  const [prev,setPrev]=useState(null);
  const [op,setOp]=useState(null);
  const [newNum,setNewNum]=useState(true);
  const [calcHistory,setCalcHistory]=useState([]);
  const [lAmt,setLAmt]=useState(""); const [lPct,setLPct]=useState("20"); const [lWks,setLWks]=useState("12");

  const pressNum=n=>{if(newNum){setDisplay(String(n));setNewNum(false);}else setDisplay(d=>d==="0"?String(n):d+n);};
  const pressDot=()=>{if(newNum){setDisplay("0.");setNewNum(false);return;}if(!display.includes("."))setDisplay(d=>d+".");};
  const calc=(a,b,o)=>{
    if(o==="+") return Math.round((a+b)*1e10)/1e10;
    if(o==="−") return Math.round((a-b)*1e10)/1e10;
    if(o==="×") return Math.round((a*b)*1e10)/1e10;
    if(o==="÷") return b!==0?Math.round((a/b)*1e10)/1e10:"Error";
    return b;
  };
  const pressOp=o=>{
    const cur=parseFloat(display);
    if(prev!==null&&!newNum){const res=calc(prev,cur,op);setDisplay(String(res));setPrev(res);}
    else setPrev(cur);
    setOp(o);setNewNum(true);
  };
  const pressEq=()=>{
    if(prev===null||op===null) return;
    const cur=parseFloat(display);
    const res=calc(prev,cur,op);
    setCalcHistory(h=>[`${prev} ${op} ${cur} = ${res}`,...h.slice(0,9)]);
    setDisplay(String(res));setPrev(null);setOp(null);setNewNum(true);
  };
  const pressC=()=>{setDisplay("0");setPrev(null);setOp(null);setNewNum(true);};
  const pressPct=()=>setDisplay(d=>String(parseFloat(d)/100));
  const pressSign=()=>setDisplay(d=>d.startsWith("-")?d.slice(1):"-"+d);

  const keys=[
    {l:"C",a:pressC,v:"ghost"},{l:"+/−",a:pressSign,v:"ghost"},{l:"%",a:pressPct,v:"ghost"},{l:"÷",a:()=>pressOp("÷"),v:"op"},
    {l:"7",a:()=>pressNum("7")},{l:"8",a:()=>pressNum("8")},{l:"9",a:()=>pressNum("9")},{l:"×",a:()=>pressOp("×"),v:"op"},
    {l:"4",a:()=>pressNum("4")},{l:"5",a:()=>pressNum("5")},{l:"6",a:()=>pressNum("6")},{l:"−",a:()=>pressOp("−"),v:"op"},
    {l:"1",a:()=>pressNum("1")},{l:"2",a:()=>pressNum("2")},{l:"3",a:()=>pressNum("3")},{l:"+",a:()=>pressOp("+"),v:"op"},
    {l:"0",a:()=>pressNum("0"),wide:true},{l:".",a:pressDot},{l:"=",a:pressEq,v:"eq"},
  ];
  const bStyle=(v,wide)=>{
    const base={height:68,borderRadius:16,border:"none",cursor:"pointer",fontSize:22,fontWeight:600,transition:"all 0.12s",display:"flex",alignItems:"center",justifyContent:"center"};
    if(v==="op") return {...base,background:"#FDF8E7",color:"#C8960C",border:"1px solid #C8960C30",fontSize:24,fontWeight:700};
    if(v==="eq") return {...base,background:"linear-gradient(135deg,#F5C842,#C8960C)",color:"#fff",boxShadow:"0 3px 14px #C8960C30"};
    if(v==="ghost") return {...base,background:"#E6F3FA",color:"#0B6E9E",fontSize:18,fontWeight:700};
    return {...base,background:"#fff",color:"#0D1B2A",border:"1px solid #D8E4EE",boxShadow:"0 1px 4px #0001"};
  };
  const lTotal=(parseInt(lAmt)||0)*(1+(parseInt(lPct)||0)/100);
  const lWeekly=lAmt?Math.ceil(lTotal/(parseInt(lWks)||12)):0;
  return (
    <div style={{background:"#F0F4F8",minHeight:"100vh"}}>
      <Nav title="Calculator"/>
      <div style={{padding:"14px 14px 100px"}}>
        <Card style={{padding:"20px 20px 16px",marginBottom:14,minHeight:110,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          {op&&<div style={{fontSize:14,color:"#8FA3B8",marginBottom:4}}>{prev} {op}</div>}
          <div style={{fontSize:display.length>12?22:display.length>8?30:40,fontWeight:800,color:"#0D1B2A",textAlign:"right",wordBreak:"break-all"}}>{display}</div>
        </Card>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {keys.map((k,i)=>k.wide
            ?<button key={i} onClick={k.a} style={{...bStyle(k.v,true),gridColumn:"span 2"}}>0</button>
            :<button key={i} onClick={k.a} style={bStyle(k.v,false)}>{k.l}</button>
          )}
        </div>
        <Card style={{marginTop:14,padding:14,background:"#FDF8E7",border:"1px solid #C8960C25"}}>
          <div style={{fontWeight:700,color:"#C8960C",marginBottom:10,fontSize:13}}>💡 Loan Quick Calculator</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            {[{l:"LOAN (₹)",val:lAmt,set:setLAmt,ph:"10000"},{l:"INTEREST %",val:lPct,set:setLPct,ph:"20"},{l:"WEEKS",val:lWks,set:setLWks,ph:"12"}].map((f,i)=>(
              <div key={i}>
                <div style={{fontSize:10,color:"#8FA3B8",marginBottom:4}}>{f.l}</div>
                <input type="number" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #D8E4EE",background:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
          </div>
          {lAmt&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div style={{background:"#fff",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontWeight:800,fontSize:15,color:"#1A7F4B"}}>{fmt(lTotal)}</div>
                <div style={{fontSize:10,color:"#8FA3B8"}}>Total Return</div>
              </div>
              <div style={{background:"#fff",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontWeight:800,fontSize:15,color:"#0B6E9E"}}>{fmt(lWeekly)}</div>
                <div style={{fontSize:10,color:"#8FA3B8"}}>Weekly Due</div>
              </div>
            </div>
          )}
        </Card>
        {calcHistory.length>0&&(
          <Card style={{marginTop:14,padding:14}}>
            <div style={{fontWeight:700,color:"#4A6080",marginBottom:10,fontSize:13}}>Recent Calculations</div>
            {calcHistory.map((h,i)=>(
              <div key={i} style={{fontSize:13,color:i===0?"#0D1B2A":"#8FA3B8",padding:"5px 0",borderBottom:i<calcHistory.length-1?"1px solid #EBF0F5":"none",fontWeight:i===0?700:400}}>{h}</div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

// ── EXPENSES TAB ──
function ExpensesTab({expenses,setExpenses}){
  const [showAdd,setShowAdd]=useState(false);
  const [desc,setDesc]=useState(""); const [amt,setAmt]=useState(""); const [cat,setCat]=useState("travel");
  const [toast,setToast]=useState({});
  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast({}),2000);};
  const CATS=[{id:"travel",l:"Travel",ic:"🚗"},{id:"food",l:"Food",ic:"🍱"},{id:"rent",l:"Rent",ic:"🏠"},{id:"fuel",l:"Fuel",ic:"⛽"},{id:"other",l:"Other",ic:"📦"}];
  const add=()=>{
    if(!amt) return;
    const e={id:Date.now(),desc:desc||CATS.find(c=>c.id===cat)?.l,amt:parseInt(amt),cat,date:todayStr()};
    const upd=[e,...expenses];setExpenses(upd);DB.set("slg_exp",upd);
    setDesc("");setAmt("");setCat("travel");setShowAdd(false);showToast("Expense saved ✓");
  };
  const del=id=>{const upd=expenses.filter(e=>e.id!==id);setExpenses(upd);DB.set("slg_exp",upd);showToast("Deleted");};
  const tT=expenses.filter(e=>e.date===todayStr()).reduce((s,e)=>s+e.amt,0);
  const tA=expenses.reduce((s,e)=>s+e.amt,0);
  return (
    <div style={{background:"#F0F4F8",minHeight:"100vh"}}>
      <Nav title="Expenses"/>
      {toast.msg&&<Toast msg={toast.msg} type={toast.type}/>}
      <div style={{padding:"14px 14px 100px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <Card style={{marginBottom:0,border:"1.5px solid #C0392B25",background:"#FDECEA"}}><div style={{fontSize:11,color:"#8FA3B8"}}>Today</div><div style={{fontSize:22,fontWeight:800,color:"#C0392B",marginTop:4}}>{fmt(tT)}</div></Card>
          <Card style={{marginBottom:0}}><div style={{fontSize:11,color:"#8FA3B8"}}>Total</div><div style={{fontSize:22,fontWeight:800,color:"#0D1B2A",marginTop:4}}>{fmt(tA)}</div></Card>
        </div>
        <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:14}}>
          {CATS.map(c=>{const t=expenses.filter(e=>e.cat===c.id).reduce((s,e)=>s+e.amt,0);return(<div key={c.id} style={{flexShrink:0,background:"#fff",borderRadius:12,padding:"8px 12px",border:"1px solid #D8E4EE",display:"flex",alignItems:"center",gap:6}}><span>{c.ic}</span><div><div style={{fontSize:12,fontWeight:700,color:"#0D1B2A"}}>{fmt(t)}</div><div style={{fontSize:10,color:"#8FA3B8"}}>{c.l}</div></div></div>);})}
        </div>
        <Btn onClick={()=>setShowAdd(true)} style={{width:"100%",marginBottom:14}}>+ Add Expense</Btn>
        {expenses.length===0&&<Card style={{textAlign:"center",padding:28,color:"#8FA3B8"}}>No expenses recorded yet.</Card>}
        {expenses.map(e=>{const c=CATS.find(c=>c.id===e.cat);return(
          <Card key={e.id} style={{padding:14}}>
            <Row>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:38,height:38,borderRadius:12,background:"#F7F9FC",border:"1px solid #D8E4EE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{c?.ic}</div>
                <div><div style={{fontWeight:700,color:"#0D1B2A"}}>{e.desc}</div><div style={{fontSize:12,color:"#8FA3B8"}}>{dateLabel(e.date)} · {c?.l}</div></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontWeight:800,color:"#C0392B",fontSize:14}}>{fmt(e.amt)}</div>
                <button onClick={()=>del(e.id)} style={{width:28,height:28,borderRadius:14,border:"1px solid #D8E4EE",background:"#F7F9FC",cursor:"pointer",fontSize:14,color:"#8FA3B8",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
              </div>
            </Row>
          </Card>
        );})}
      </div>
      <Sheet open={showAdd} onClose={()=>setShowAdd(false)} title="Add Expense">
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {CATS.map(c=><button key={c.id} onClick={()=>setCat(c.id)} style={{padding:"8px 14px",borderRadius:20,border:`1px solid ${cat===c.id?"#0B6E9E":"#D8E4EE"}`,cursor:"pointer",fontSize:13,fontWeight:600,background:cat===c.id?"#0B6E9E":"#F7F9FC",color:cat===c.id?"#fff":"#4A6080",transition:"all 0.15s"}}>{c.ic} {c.l}</button>)}
        </div>
        <Inp label="Description" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Auto fare"/>
        <Inp label="Amount (₹) *" type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0"/>
        <div style={{display:"flex",gap:10}}>
          <Btn variant="white" onClick={()=>setShowAdd(false)} style={{flex:1}}>Cancel</Btn>
          <Btn onClick={add} style={{flex:1}}>Save</Btn>
        </div>
      </Sheet>
    </div>
  );
}

// ── SETTINGS TAB ──
function SettingsTab({pin,setPin,data,setData,onLock}){
  const [screen,setScreen]=useState("main");
  const [op,setOp]=useState(""); const [np1,setNp1]=useState(""); const [np2,setNp2]=useState(""); const [pe,setPe]=useState("");
  const [vN,setVN]=useState(""); const [vD,setVD]=useState("Monday");
  const [toast,setToast]=useState({});
  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast({}),2500);};
  const changePin=()=>{
    if(op!==pin){setPe("Current PIN is incorrect");return;}
    if(np1.length<4){setPe("New PIN must be at least 4 digits");return;}
    if(np1!==np2){setPe("PINs do not match");return;}
    setPin(np1);DB.set("slg_pin",np1);setOp("");setNp1("");setNp2("");setPe("");showToast("PIN changed ✓");setScreen("main");
  };
  const addV=()=>{
    if(!vN) return;
    const v={id:"v"+Date.now(),name:vN,day:vD};
    const upd={...data,villages:[...data.villages,v],borrowers:{...data.borrowers,[v.id]:[]}};
    setData(upd);DB.set("slg_data",upd);setVN("");setVD("Monday");showToast("Village added ✓");
  };
  const [confirmRemoveId,setConfirmRemoveId]=useState(null);
  const delV=id=>{
    const upd={...data,villages:data.villages.filter(v=>v.id!==id),borrowers:{...data.borrowers}};
    delete upd.borrowers[id];setData(upd);DB.set("slg_data",upd);
    setConfirmRemoveId(null);showToast("Village removed");
  };
  const confirmVillage=confirmRemoveId?data.villages.find(v=>v.id===confirmRemoveId):null;
  return (
    <div style={{background:"#F0F4F8",minHeight:"100vh"}}>
      <Nav title="Settings" onBack={screen!=="main"?()=>setScreen("main"):undefined}/>
      {toast.msg&&<Toast msg={toast.msg} type={toast.type}/>}

      {/* Confirm Remove Modal */}
      {confirmRemoveId&&confirmVillage&&(
        <div style={{position:"fixed",inset:0,background:"#00000070",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"#fff",borderRadius:20,padding:24,width:"100%",maxWidth:380,boxShadow:"0 8px 40px #0004"}}>
            <div style={{fontSize:36,textAlign:"center",marginBottom:12}}>⚠️</div>
            <div style={{fontWeight:800,fontSize:17,color:"#0D1B2A",textAlign:"center",marginBottom:8}}>Remove Village?</div>
            <div style={{fontSize:14,color:"#4A6080",textAlign:"center",marginBottom:6}}>
              Are you sure you want to remove
            </div>
            <div style={{fontSize:17,fontWeight:900,color:"#C0392B",textAlign:"center",marginBottom:6}}>"{confirmVillage.name}"</div>
            <div style={{fontSize:13,color:"#8FA3B8",textAlign:"center",marginBottom:22}}>
              This will remove the village and all its borrower records permanently.
            </div>
            <div style={{display:"flex",gap:10}}>
              <Btn variant="white" onClick={()=>setConfirmRemoveId(null)} style={{flex:1,fontSize:14}}>Cancel</Btn>
              <Btn variant="danger" onClick={()=>delV(confirmRemoveId)} style={{flex:1,fontSize:14,background:"#C0392B",color:"#fff"}}>Yes, Remove</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{padding:"14px 14px 100px"}}>
        {screen==="main"&&<>
          <Card style={{background:"linear-gradient(135deg,#084D6E,#1A8ABF)",border:"none",color:"#fff",padding:20,textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:20,fontWeight:900}}>Sri Lakshmi Ganapati</div>
            <div style={{fontSize:12,opacity:0.6,marginTop:4}}>Village Finance Manager · v3.0</div>
          </Card>
          <SecLabel>Security</SecLabel>
          <Card onClick={()=>setScreen("pin")} style={{cursor:"pointer",padding:14}}>
            <Row><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:40,height:40,borderRadius:12,background:"#E6F3FA",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🔐</div><div><div style={{fontWeight:700,color:"#0D1B2A"}}>Change PIN</div><div style={{fontSize:12,color:"#8FA3B8"}}>Update your lock PIN</div></div></div><span style={{color:"#0B6E9E",fontSize:22}}>›</span></Row>
          </Card>
          <Card onClick={onLock} style={{cursor:"pointer",padding:14}}>
            <Row><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:40,height:40,borderRadius:12,background:"#FDECEA",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🔒</div><div><div style={{fontWeight:700,color:"#0D1B2A"}}>Lock App Now</div><div style={{fontSize:12,color:"#8FA3B8"}}>Return to PIN screen</div></div></div><span style={{color:"#C0392B",fontSize:22}}>›</span></Row>
          </Card>
          <SecLabel>Villages</SecLabel>
          <Card style={{padding:16,marginBottom:12}}>
            <Inp label="Village Name" value={vN} onChange={e=>setVN(e.target.value)} placeholder="గ్రామం పేరు / Village Name"/>
            <Sel label="Visit Day" value={vD} onChange={e=>setVD(e.target.value)}>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
            </Sel>
            <Btn onClick={addV} style={{width:"100%"}}>+ Add Village</Btn>
          </Card>
          {data.villages.length===0&&<Card style={{textAlign:"center",padding:20,color:"#8FA3B8"}}>No villages added yet.</Card>}
          {data.villages.map(v=>(
            <Card key={v.id} style={{padding:14}}>
              <Row>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:38,height:38,borderRadius:12,background:"#E6F3FA",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🏘️</div>
                  <div><div style={{fontWeight:700,color:"#0D1B2A"}}>{v.name}</div><div style={{fontSize:12,color:"#8FA3B8"}}>{v.day} · {(data.borrowers[v.id]||[]).length} borrowers</div></div>
                </div>
                <button onClick={()=>setConfirmRemoveId(v.id)} style={{padding:"6px 14px",borderRadius:20,border:"1px solid #C0392B30",background:"#FDECEA",color:"#C0392B",cursor:"pointer",fontSize:12,fontWeight:700}}>Remove</button>
              </Row>
            </Card>
          ))}
        </>}
        {screen==="pin"&&(
          <Card style={{padding:20}}>
            <div style={{fontWeight:800,fontSize:16,color:"#0D1B2A",marginBottom:4}}>🔐 Change PIN</div>
            <div style={{fontSize:13,color:"#8FA3B8",marginBottom:18}}>Enter current PIN, then set a new one.</div>
            <Inp label="Current PIN" type="password" value={op} onChange={e=>setOp(e.target.value)} placeholder="Current PIN"/>
            <Inp label="New PIN" type="password" value={np1} onChange={e=>setNp1(e.target.value)} placeholder="New PIN (min 4 digits)"/>
            <Inp label="Confirm New PIN" type="password" value={np2} onChange={e=>setNp2(e.target.value)} placeholder="Repeat new PIN"/>
            {pe&&<div style={{color:"#C0392B",fontSize:13,fontWeight:700,marginBottom:12}}>{pe}</div>}
            <div style={{display:"flex",gap:10}}>
              <Btn variant="white" onClick={()=>setScreen("main")} style={{flex:1}}>Cancel</Btn>
              <Btn onClick={changePin} style={{flex:1}}>Change PIN</Btn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── ROOT APP ──
export default function App(){
  const [unlocked,setUnlocked]=useState(false);
  const [tab,setTab]=useState("home");
  const [data,setData]=useState(()=>DB.get("slg_data",EMPTY));
  const [collections,setCollections]=useState(()=>DB.get("slg_cols",{}));
  const [expenses,setExpenses]=useState(()=>DB.get("slg_exp",[]));
  const [pin,setPin]=useState(()=>DB.get("slg_pin","1234"));

  useEffect(()=>{
    if(!unlocked) return;
    let t;
    const reset=()=>{clearTimeout(t);t=setTimeout(()=>setUnlocked(false),180000);};
    ["touchstart","mousemove","keydown"].forEach(ev=>window.addEventListener(ev,reset));
    reset();
    return()=>{clearTimeout(t);["touchstart","mousemove","keydown"].forEach(ev=>window.removeEventListener(ev,reset));};
  },[unlocked]);

  if(!unlocked) return <><style>{CSS}</style><PinScreen storedPin={pin} onUnlock={()=>setUnlocked(true)}/></>;

  const TABS=[
    {id:"home",ic:"🏠",l:"Home"},{id:"collect",ic:"📋",l:"Collect"},
    {id:"borrowers",ic:"👥",l:"Borrowers"},{id:"reports",ic:"📊",l:"Reports"},
    {id:"calendar",ic:"📅",l:"Calendar"},{id:"calc",ic:"🧮",l:"Calc"},
    {id:"expenses",ic:"🧾",l:"Expenses"},{id:"settings",ic:"⚙️",l:"Settings"},
  ];

  return (
    <div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",background:"#F0F4F8",position:"relative"}}>
      <style>{CSS}</style>
      {tab==="home"&&<HomeTab data={data} collections={collections} expenses={expenses} setTab={setTab} onLock={()=>setUnlocked(false)}/>}
      {tab==="collect"&&<CollectTab data={data} setData={setData} collections={collections} setCollections={setCollections}/>}
      {tab==="borrowers"&&<BorrowersTab data={data}/>}
      {tab==="reports"&&<ReportsTab data={data} collections={collections} expenses={expenses}/>}
      {tab==="calendar"&&<CalendarTab collections={collections}/>}
      {tab==="calc"&&<CalculatorTab/>}
      {tab==="expenses"&&<ExpensesTab expenses={expenses} setExpenses={setExpenses}/>}
      {tab==="settings"&&<SettingsTab pin={pin} setPin={setPin} data={data} setData={setData} onLock={()=>setUnlocked(false)}/>}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#fff",borderTop:"1px solid #D8E4EE",zIndex:200,boxShadow:"0 -2px 14px #0B6E9E0E"}}>
        <div style={{display:"flex",overflowX:"auto",scrollbarWidth:"none"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{flex:"0 0 auto",minWidth:58,padding:"9px 0 13px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer",border:"none",background:"transparent",color:tab===t.id?"#0B6E9E":"#8FA3B8",fontSize:9,fontWeight:tab===t.id?800:500,transition:"all 0.2s"}}>
              <span style={{fontSize:18}}>{t.ic}</span>
              {t.l}
              {tab===t.id&&<div style={{width:16,height:2.5,borderRadius:2,background:"#0B6E9E",marginTop:1}}/>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
