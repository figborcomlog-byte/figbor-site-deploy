/* ==========================================================================
   FIGBOR — Núcleo JS compartilhado (hub + módulos)
   Auth unificado (localStorage: figbor_users / figbor_session), tema, helpers,
   chrome (top bar + navegação entre módulos), gate de login, toast, modais.
   Zero dependências. window.FIG é a API pública.
   ========================================================================== */
(function(){
  "use strict";
  var UKEY="figbor_users", SKEY="figbor_session", TKEY="figbor_theme";
  var DEFAULT_ADMIN_PW="admin123";

  /* ---------- símbolo da marca ---------- */
  var SYM='<svg viewBox="0 0 100 100" aria-hidden="true">'+
    '<g fill="none" stroke="var(--ink,currentColor)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'+
    '<path d="M52 15 C 27 12, 12 29, 18 46 C 9 61, 25 82, 48 79" opacity=".95"/>'+
    '<path d="M47 25 C 33 23, 25 32, 28 42" opacity=".7"/>'+
    '<path d="M45 39 C 33 39, 27 46, 31 54" opacity=".7"/>'+
    '<path d="M47 56 C 36 56, 30 63, 35 71" opacity=".7"/>'+
    '<path d="M52 15 L 52 79" opacity=".9"/>'+
    '<path d="M52 47 L 66 39 L 78 30"/></g>'+
    '<circle cx="52" cy="47" r="3.3" fill="var(--ink,currentColor)"/>'+
    '<circle cx="66" cy="39" r="3.3" fill="var(--ink,currentColor)"/>'+
    '<circle cx="82" cy="24" r="7.6" fill="var(--acc)"/></svg>';
  function symColored(ink,acc){
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'+
      '<g fill="none" stroke="'+ink+'" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'+
      '<path d="M52 15 C 27 12, 12 29, 18 46 C 9 61, 25 82, 48 79" opacity="0.95"/>'+
      '<path d="M47 25 C 33 23, 25 32, 28 42" opacity="0.7"/>'+
      '<path d="M45 39 C 33 39, 27 46, 31 54" opacity="0.7"/>'+
      '<path d="M47 56 C 36 56, 30 63, 35 71" opacity="0.7"/>'+
      '<path d="M52 15 L 52 79" opacity="0.9"/>'+
      '<path d="M52 47 L 66 39 L 78 30"/></g>'+
      '<circle cx="52" cy="47" r="3.3" fill="'+ink+'"/><circle cx="66" cy="39" r="3.3" fill="'+ink+'"/>'+
      '<circle cx="82" cy="24" r="7.6" fill="'+acc+'"/></svg>';
  }

  /* ---------- módulos ---------- */
  var IC={
    estoque:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V21H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>',
    comercial:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
    producao:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20V9l-6 4V9l-6 4V4L2 8z"/><path d="M6 20v-4M10 20v-4M14 20v-4M18 20v-4"/></svg>',
    transporte:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>'
  };
  var MODULES=[
    {key:"estoque",name:"Estoque",file:"FIGBOR-FEFO.html",color:"var(--info)",icon:IC.estoque,desc:"Controle de estoque, recebimento, expedicao, inventario e validade (FEFO)."},
    {key:"comercial",name:"Comercial",file:"FIGBOR-comercial.html",color:"var(--ok)",icon:IC.comercial,desc:"Vendas, vendedores, comissoes, visitas e clientes."},
    {key:"producao",name:"Producao",file:"FIGBOR-producao.html",color:"var(--warn)",icon:IC.producao,desc:"PCP, materia-prima, ordens de producao e eficiencia (OEE)."},
    {key:"transporte",name:"Logistica",file:"FIGBOR-transporte.html",color:"var(--violet)",icon:IC.transporte,desc:"Roteirizacao, rastreio de motoristas, cargas e entregas."}
  ];
  function moduleByKey(k){for(var i=0;i<MODULES.length;i++)if(MODULES[i].key===k)return MODULES[i];return null;}

  /* ---------- helpers ---------- */
  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];});}
  function nf(n){return (Number(n)||0).toLocaleString("pt-BR");}
  function nf2(n){return (Number(n)||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});}
  function brl(n){return (Number(n)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
  function today0(){var d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
  function iso(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  function parseDate(s){if(!s)return null;var p=String(s).split("-");if(p.length!==3)return null;var d=new Date(+p[0],+p[1]-1,+p[2]);return isNaN(d)?null:d;}
  function fmt(s){var d=parseDate(s);if(!d)return "—";return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();}
  function diffDays(a,b){return Math.round((a-b)/86400000);}
  function nowStamp(){return new Date().toISOString();}
  function fmtDT(s){var d=new Date(s);if(isNaN(d))return "—";return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear()+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}
  function ymd(){var d=new Date();return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();}
  function uid(p){return (p||"id")+"-"+Date.now()+"-"+Math.floor(Math.random()*1000);}
  function initials(nome){nome=(nome||"?").trim();var p=nome.split(/\s+/);return (((p[0]||"")[0]||"")+(p.length>1?(p[p.length-1][0]||""):"")).toUpperCase();}
  function monthKey(s){var d=parseDate(s);if(!d)return "";return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");}

  /* ---------- storage ---------- */
  function jget(key,def){try{var v=JSON.parse(localStorage.getItem(key));return v==null?def:v;}catch(e){return def;}}
  function jset(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch(e){}}

  /* módulo salva/lê seus dados: FIG.data(moduleKey) -> {get(def), set(val)} */
  function data(mkey){
    var k="figbor_"+mkey+"_v1";
    return {get:function(def){return jget(k,def);},set:function(v){jset(k,v);}};
  }

  /* ---------- hashing (SHA-256+salt, fallback simples) ---------- */
  function randomHex(n){var a=new Uint8Array(n);if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(a);
    else for(var i=0;i<n;i++)a[i]=Math.floor(Math.random()*256);
    return Array.prototype.map.call(a,function(b){return b.toString(16).padStart(2,"0");}).join("");}
  function fallbackHash(str){var h=5381;for(var i=0;i<str.length;i++)h=((h<<5)+h+str.charCodeAt(i))>>>0;
    var h2=52711;for(var j=str.length-1;j>=0;j--)h2=((h2<<5)+h2+str.charCodeAt(j))>>>0;
    return ("00000000"+h.toString(16)).slice(-8)+("00000000"+h2.toString(16)).slice(-8);}
  function hashPw(pw,salt){
    salt=salt||randomHex(16);var payload=salt+":"+pw;
    if(window.crypto&&crypto.subtle&&window.TextEncoder){
      return crypto.subtle.digest("SHA-256",new TextEncoder().encode(payload)).then(function(buf){
        return {salt:salt,hash:Array.prototype.map.call(new Uint8Array(buf),function(b){return b.toString(16).padStart(2,"0");}).join(""),algo:"sha256"};
      }).catch(function(){return {salt:salt,hash:fallbackHash(payload),algo:"fb"};});
    }
    return Promise.resolve({salt:salt,hash:fallbackHash(payload),algo:"fb"});
  }

  /* ---------- auth ---------- */
  function users(){return jget(UKEY,[]);}
  function saveUsers(list){jset(UKEY,list);}
  function seedAdmin(){return {id:"u-admin-default",nome:"Administrador",username:"admin",email:"",role:"admin",salt:null,hash:null,algo:null,active:true,mustChange:false,createdAt:nowStamp()};}
  function ensureAdmin(){var u=users();if(!u.length){u=[seedAdmin()];saveUsers(u);}return u;}
  function userById(id){var u=users();for(var i=0;i<u.length;i++)if(u[i].id===id)return u[i];return null;}
  function userByLogin(id){id=(id||"").trim().toLowerCase();if(!id)return null;var u=users();
    for(var i=0;i<u.length;i++){if((u[i].username||"").toLowerCase()===id||(u[i].email||"").toLowerCase()===id)return u[i];}return null;}
  function userByName(n){n=(n||"").trim().toLowerCase();var u=users();for(var i=0;i<u.length;i++)if((u[i].username||"").toLowerCase()===n)return u[i];return null;}
  function session(){return localStorage.getItem(SKEY)||null;}
  function setSession(id){if(id)localStorage.setItem(SKEY,id);else localStorage.removeItem(SKEY);}
  function currentUser(){var s=session();return s?userById(s):null;}
  function isAdmin(){var u=currentUser();return !!(u&&u.role==="admin");}
  function updateUser(id,patch){var list=users();for(var i=0;i<list.length;i++){if(list[i].id===id){Object.assign(list[i],patch);}}saveUsers(list);}

  /* ---------- toast ---------- */
  var toastT=null;
  function toast(msg){
    var el=document.getElementById("figToast");
    if(!el){el=document.createElement("div");el.id="figToast";document.body.appendChild(el);}
    el.textContent=msg;el.classList.add("show");
    if(toastT)clearTimeout(toastT);toastT=setTimeout(function(){el.classList.remove("show");},2600);
  }

  /* ---------- theme ---------- */
  function applyTheme(){var t=localStorage.getItem(TKEY)||"light";document.documentElement.setAttribute("data-theme",t);
    var i=document.getElementById("figThemeIcon");if(i)i.textContent=t==="dark"?"◑":"◐";}
  function toggleTheme(){var t=(localStorage.getItem(TKEY)||"light")==="dark"?"light":"dark";localStorage.setItem(TKEY,t);applyTheme();}
  applyTheme();

  /* ---------- gate (login) ---------- */
  function buildGate(){
    if(document.getElementById("figGate"))return;
    var g=document.createElement("div");g.className="gate";g.id="figGate";
    g.innerHTML=''+
      '<div class="gatecard">'+
        '<div class="gbrand"><img class="gate-logo" src="figbor-lockup.png" alt="FIGBOR"></div>'+
        '<h2>Entrar</h2>'+
        '<p class="gsub">Acesse com seu e-mail ou usuário e a senha.</p>'+
        '<div class="field"><input id="figLiUser" placeholder="E-mail ou usuário" autocomplete="username"></div>'+
        '<div class="field"><input id="figLiPw" type="password" placeholder="Senha" autocomplete="current-password"></div>'+
        '<button class="btn primary" id="figLogin">Entrar</button>'+
        '<div class="gerr" id="figLoginErr"></div>'+
        '<p class="gnote"><b>Ambiente de demonstração.</b> Os dados ficam salvos apenas neste navegador. Novos usuários são criados no Hub, em Usuários.</p>'+
      '</div>';
    document.body.appendChild(g);
  }
  function showGate(){buildGate();document.getElementById("figGate").classList.add("open");
    setTimeout(function(){var f=document.getElementById("figLiUser");if(f)f.focus();},80);}
  function hideGate(){var g=document.getElementById("figGate");if(g)g.classList.remove("open");}

  function forceSetPassword(u,onDone){
    var np=prompt("Primeiro acesso do administrador.\nPor segurança, defina uma NOVA senha (mín. 4 caracteres):");
    if(np==null){setSession(null);showGate();return;}
    if(np.length<4){alert("Senha muito curta.");return forceSetPassword(u,onDone);}
    var np2=prompt("Repita a nova senha:");
    if(np2!==np){alert("As senhas não conferem.");return forceSetPassword(u,onDone);}
    hashPw(np).then(function(h){updateUser(u.id,{hash:h.hash,salt:h.salt,algo:h.algo,mustChange:false});toast("Senha definida. Bem-vindo!");onDone(userById(u.id));});
  }

  function requireAuth(onReady){
    ensureAdmin();
    var cu=currentUser();
    if(cu&&cu.active){ if(cu.mustChange){forceSetPassword(cu,function(u){hideGate();onReady(u);});} else {onReady(cu);} return; }
    setSession(null);showGate();
    var wire=function(){
      var btn=document.getElementById("figLogin");if(!btn)return;
      function tryLogin(){
        var id=document.getElementById("figLiUser").value.trim();
        var pw=document.getElementById("figLiPw").value;
        var err=document.getElementById("figLoginErr");
        var u=userByLogin(id);
        if(!u||!u.active){err.textContent="Usuário não encontrado ou inativo.";return;}
        function ok(){setSession(u.id);document.getElementById("figLiPw").value="";err.textContent="";
          if(u.mustChange){forceSetPassword(u,function(uu){hideGate();onReady(uu);});}
          else{hideGate();toast("Bem-vindo, "+u.nome+"!");onReady(u);}}
        if(u.hash==null){if(pw===DEFAULT_ADMIN_PW)ok();else err.textContent="Senha incorreta.";return;}
        hashPw(pw,u.salt).then(function(h){if(h.hash===u.hash)ok();else err.textContent="Senha incorreta.";});
      }
      btn.onclick=tryLogin;
      document.getElementById("figLiPw").onkeydown=function(e){if(e.key==="Enter")tryLogin();};
      document.getElementById("figLiUser").onkeydown=function(e){if(e.key==="Enter")tryLogin();};
    };
    wire();
  }
  function logout(){if(!confirm("Sair da conta "+(currentUser()?currentUser().nome:"")+"?"))return;setSession(null);location.reload();}

  /* ---------- chrome (top bar) ---------- */
  var ICON_HUB='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>';
  var ICON_LOGOUT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';
  function mountChrome(opts){
    opts=opts||{};
    var host=document.getElementById("figChrome");if(!host)return;
    var cu=currentUser();
    var isHub=!opts.module;
    var modTag=isHub?"":'<span class="fig-mod">'+esc((moduleByKey(opts.module)||{}).name||"")+'</span>';
    var nav=isHub?"":'<nav class="fig-modnav">'+MODULES.map(function(m){
      return '<a href="'+m.file+'" class="'+(m.key===opts.module?"on":"")+'" title="'+esc(m.name)+'"><span class="d" style="background:'+m.color+'"></span><span>'+esc(m.name)+'</span></a>';
    }).join("")+'</nav>';
    host.innerHTML=''+
      '<header class="fig-top"><div class="wrap">'+
        '<a class="fig-brand" href="FIGBOR.html"><img class="mk" src="figbor-icon.png" alt=""><span class="fig-wm"><span class="wfig">FIG</span><span class="wbor">BOR</span></span>'+modTag+'</a>'+
        nav+
        '<div class="fig-actions">'+
          (opts.actions||"")+
          (isHub?"":'<a class="btn icon-btn" href="FIGBOR.html" title="Voltar ao hub">'+ICON_HUB+'</a>')+
          '<button class="btn icon-btn" id="figThemeBtn" title="Alternar tema"><span id="figThemeIcon">◐</span></button>'+
          '<div class="userchip" title="'+esc(cu?cu.nome:"")+'"><span class="uav">'+(cu?initials(cu.nome):"?")+'</span>'+
            '<span><span class="uname">'+esc(cu?cu.nome:"")+'</span> · <span class="urole">'+(cu?(cu.role==="admin"?"Admin":"Operador"):"")+'</span></span>'+
            '<button class="btn icon-btn" id="figLogout" title="Sair" style="height:28px;width:28px;border:0;background:transparent">'+ICON_LOGOUT+'</button>'+
          '</div>'+
        '</div>'+
      '</div></header>';
    applyTheme();
    document.getElementById("figThemeBtn").addEventListener("click",toggleTheme);
    document.getElementById("figLogout").addEventListener("click",logout);
  }

  /* ---------- modal helpers ---------- */
  function openModal(id){var m=document.getElementById(id);if(m)m.classList.add("open");}
  function closeModal(id){var m=document.getElementById(id);if(m)m.classList.remove("open");}
  function wireModals(){
    document.querySelectorAll("[data-close]").forEach(function(b){b.addEventListener("click",function(){closeModal(b.getAttribute("data-close"));});});
    document.querySelectorAll(".overlay").forEach(function(o){o.addEventListener("click",function(e){if(e.target===o)o.classList.remove("open");});});
    document.addEventListener("keydown",function(e){if(e.key==="Escape")document.querySelectorAll(".overlay.open").forEach(function(o){o.classList.remove("open");});});
  }

  /* ---------- CSV ---------- */
  function csvCell(v){v=(v==null?"":String(v));if(/[",\n;]/.test(v))return '"'+v.replace(/"/g,'""')+'"';return v;}
  function downloadCSV(name,cols,rows){
    var lines=[cols.join(",")];
    rows.forEach(function(r){lines.push(cols.map(function(c){return csvCell(r[c]);}).join(","));});
    var blob=new Blob(["﻿"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
    var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
  }

  /* ---------- API pública ---------- */
  window.FIG={
    SYM:SYM, symColored:symColored, MODULES:MODULES, moduleByKey:moduleByKey, IC:IC,
    esc:esc, nf:nf, nf2:nf2, brl:brl, today0:today0, iso:iso, parseDate:parseDate, fmt:fmt,
    diffDays:diffDays, nowStamp:nowStamp, fmtDT:fmtDT, ymd:ymd, uid:uid, initials:initials, monthKey:monthKey,
    data:data, jget:jget, jset:jset,
    auth:{users:users,saveUsers:saveUsers,ensureAdmin:ensureAdmin,userById:userById,userByLogin:userByLogin,userByName:userByName,
      currentUser:currentUser,isAdmin:isAdmin,updateUser:updateUser,hashPw:hashPw,session:session,setSession:setSession,DEFAULT_ADMIN_PW:DEFAULT_ADMIN_PW},
    requireAuth:requireAuth, logout:logout, mountChrome:mountChrome, applyTheme:applyTheme, toggleTheme:toggleTheme,
    toast:toast, openModal:openModal, closeModal:closeModal, wireModals:wireModals, downloadCSV:downloadCSV
  };
})();
