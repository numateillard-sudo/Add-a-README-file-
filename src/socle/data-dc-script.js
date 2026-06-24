
class Component extends DCLogic {
  state = { view:'home', collId:null, docId:null, form:null, q:'', toast:null, loaded:false, nameDraft:'', welcome:false };

  KEY = 'ecrin.app.v1';
  IDKEY = 'ecrin.identity.v1';   // ECRIN: clé d'identité unifiée, lue par les 3 domaines

  COLLS = [
    {id:'identite', label:'Identité',          accent:'#2b6cd9', icon:'identite'},
    {id:'sante',    label:'Santé',             accent:'#d2553c', icon:'sante'},
    {id:'logement', label:'Logement',          accent:'#1f8a5b', icon:'logement'},
    {id:'vehicule', label:'Véhicule',          accent:'#b9810f', icon:'vehicule'},
    {id:'argent',   label:'Travail & argent',  accent:'#7a4fb5', icon:'argent'},
    {id:'famille',  label:'Famille & vie',     accent:'#c0508f', icon:'famille'},
  ];

  // ECRIN: les deux outils finance, devenus des domaines natifs du socle.
  FIN = [
    {id:'cb',  label:'Comptes & Budget', accent:'#1f8a5b', icon:'wallet', desc:'Soldes, transactions, budget'},
    {id:'inv', label:'Investissement',   accent:'#b3892f', icon:'gem',    desc:'Profil, fiscalité, portefeuille'},
  ];

  TYPE_GROUPS = [
    {collId:'identite', types:[['passeport','Passeport'],['cni','Carte d’identité'],['permis','Permis de conduire'],['sejour','Titre de séjour']]},
    {collId:'sante',    types:[['vitale','Carte Vitale'],['mutuelle','Mutuelle'],['ordonnance','Ordonnance'],['vaccin','Carnet de vaccination']]},
    {collId:'logement', types:[['bail','Bail / location'],['asshab','Assurance habitation'],['energie','Facture d’énergie'],['quittance','Quittance de loyer']]},
    {collId:'vehicule', types:[['grise','Carte grise'],['assauto','Assurance auto'],['ct','Contrôle technique'],['constat','Constat / sinistre']]},
    {collId:'argent',   types:[['travail','Contrat de travail'],['paie','Fiche de paie'],['rib','RIB'],['impots','Avis d’imposition'],['assvie','Assurance vie']]},
    {collId:'famille',  types:[['naissance','Acte de naissance'],['livret','Livret de famille'],['mariage','Contrat de mariage'],['testament','Testament']]},
  ];

  ICONS = {
    home:'M3 10.6 12 3l9 7.6|M5.4 9.3V20h13.2V9.3|M9.8 20v-6h4.4v6',
    identite:'M3 5.5h18v13H3z|M8 12.2a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2|M5.4 16.4c.5-1.9 1.8-2.7 2.6-2.7s2.1.8 2.6 2.7|M14 9.2h4M14 12h4M14 14.8h2.6',
    sante:'M12 20s-6.6-4.1-6.6-9A3.7 3.7 0 0 1 12 8.2 3.7 3.7 0 0 1 18.6 11c0 4.9-6.6 9-6.6 9z',
    logement:'M4 11 12 4l8 7|M6.5 9.4V20h11V9.4|M10.4 20v-5h3.2v5',
    vehicule:'M5 11l1.5-4.4A2 2 0 0 1 8.4 5.2h7.2a2 2 0 0 1 1.9 1.4L19 11|M3.6 11h16.8v5h-2.2M3.6 11v5h2.2M7.2 16a1.5 1.5 0 1 0 .01 0M16.8 16a1.5 1.5 0 1 0 .01 0',
    argent:'M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M3 9.5h18|M16 13.4a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
    famille:'M9 11.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6|M3.2 20c0-3 2.7-4.8 5.8-4.8s5.8 1.8 5.8 4.8|M16 5.6a3 3 0 0 1 0 5.6|M17.2 15.4c2.2.5 3.8 2 3.8 4.6',
    shield:'M12 3l7.6 2.8v5.6c0 4.7-3.2 7.8-7.6 8.9-4.4-1.1-7.6-4.2-7.6-8.9V5.8z',
    search:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z|M20.5 20.5 16 16',
    plus:'M12 5.2v13.6M5.2 12h13.6',
    bell:'M18 9.5a6 6 0 1 0-12 0c0 6-2.4 7-2.4 7h16.8S18 15.5 18 9.5z|M10.4 20a2 2 0 0 0 3.2 0',
    back:'M14.5 19l-7-7 7-7',
    clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7.4V12l3.2 2',
    trash:'M4.5 7h15|M9 7V4.6h6V7|M6.8 7l1 12.4h8.4l1-12.4',
    edit:'M4 20.5h4.2L20.2 8.5a1.9 1.9 0 0 0 0-2.8l-1.4-1.4a1.9 1.9 0 0 0-2.8 0L4 16.3z',
    check:'M5 12.6l4.6 4.6L19.2 7',
    chev:'M9.5 6l6 6-6 6',
    gem:'M12 3l5.2 5L12 21 6.8 8z|M6.8 8h10.4|M9.6 4.6 8 8l4 13 4-13-1.6-3.4',
    star:'M12 4l1.9 5.6L20 11l-6.1 1.4L12 18l-1.9-5.6L4 11l6.1-1.4z',
    wallet:'M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M3 9.5h18|M16 13.4a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
    trend:'M4 16.5 9.5 11l3.4 3.4L20 7|M15.5 7H20v4.5',
  };

  componentDidMount(){ this.buildTypes(); this.load(); this.syncFinance(); }
  componentDidUpdate(){ this.syncFinance(); }
  componentWillUnmount(){
    try{ if(this._cbNode && window.ECRIN_CB) window.ECRIN_CB.unmount(); }catch(e){}
    try{ if(this._invNode && window.ECRIN_INV) window.ECRIN_INV.unmount(); }catch(e){}
  }

  // ECRIN: monte/démonte les modules finance dans des hôtes stables que React
  // laisse intacts (il ne rend aucun enfant dans #cb-host / #inv-host). Un seul
  // module est monté à la fois → aucune collision d'id entre les deux outils.
  syncFinance(){
    const v=this.state.view;
    try{
      if(v==='cb'){ const el=document.getElementById('cb-host'); if(el && window.ECRIN_CB && this._cbNode!==el){ this._cbNode=el; window.ECRIN_CB.mount(el); } }
      else if(this._cbNode){ if(window.ECRIN_CB) window.ECRIN_CB.unmount(); this._cbNode=null; }
    }catch(e){ console.error('cb mount/unmount',e); }
    try{
      if(v==='inv'){ const el=document.getElementById('inv-host'); if(el && window.ECRIN_INV && this._invNode!==el){ this._invNode=el; window.ECRIN_INV.mount(el); } }
      else if(this._invNode){ if(window.ECRIN_INV) window.ECRIN_INV.unmount(); this._invNode=null; }
    }catch(e){ console.error('inv mount/unmount',e); }
  }

  buildTypes(){ this.T = {}; for(const g of this.TYPE_GROUPS){ for(const t of g.types){ this.T[t[0]] = {label:t[1], collId:g.collId}; } } }

  iso(off){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+off); const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0'); return y+'-'+m+'-'+da; }

  seed(){
    return { profile:{name:''}, docs:[
      {id:'d1', typeId:'passeport', collId:'identite', title:'Passeport', holder:'Camille Laurent', number:'19FR84021', expiry:this.iso(35), note:'', createdAt:Date.now()-1000},
      {id:'d2', typeId:'asshab', collId:'logement', title:'Assurance habitation', holder:'MAIF', number:'Contrat 4471102', expiry:this.iso(12), note:'Appartement rue des Lilas', createdAt:Date.now()-2000},
      {id:'d3', typeId:'assauto', collId:'vehicule', title:'Assurance auto — Clio', holder:'Direct Assurance', number:'', expiry:this.iso(-4), note:'À renouveler, paiement en attente', createdAt:Date.now()-3000},
      {id:'d4', typeId:'ct', collId:'vehicule', title:'Contrôle technique', holder:'Renault Clio 2018', number:'', expiry:this.iso(88), note:'', createdAt:Date.now()-4000},
      {id:'d5', typeId:'cni', collId:'identite', title:'Carte d’identité', holder:'Camille Laurent', number:'', expiry:this.iso(430), note:'', createdAt:Date.now()-5000},
      {id:'d6', typeId:'permis', collId:'identite', title:'Permis de conduire', holder:'Camille Laurent', number:'', expiry:'', note:'Catégorie B', createdAt:Date.now()-6000},
      {id:'d7', typeId:'vitale', collId:'sante', title:'Carte Vitale', holder:'Camille Laurent', number:'1 84 06 75 116 023', expiry:'', note:'', createdAt:Date.now()-7000},
      {id:'d8', typeId:'mutuelle', collId:'sante', title:'Mutuelle', holder:'Alan', number:'', expiry:this.iso(210), note:'', createdAt:Date.now()-8000},
      {id:'d9', typeId:'grise', collId:'vehicule', title:'Carte grise', holder:'Renault Clio', number:'AB-123-CD', expiry:'', note:'', createdAt:Date.now()-9000},
      {id:'d10', typeId:'bail', collId:'logement', title:'Bail de location', holder:'Agence Foncia', number:'', expiry:this.iso(300), note:'', createdAt:Date.now()-10000},
      {id:'d11', typeId:'travail', collId:'argent', title:'Contrat de travail', holder:'Studio Vega', number:'', expiry:'', note:'CDI depuis 2021', createdAt:Date.now()-11000},
      {id:'d12', typeId:'rib', collId:'argent', title:'RIB — compte courant', holder:'Boursorama', number:'FR76 3000 4002', expiry:'', note:'', createdAt:Date.now()-12000},
      {id:'d13', typeId:'impots', collId:'argent', title:'Avis d’imposition 2025', holder:'', number:'', expiry:'', note:'', createdAt:Date.now()-13000},
    ]};
  }

  load(){ let s=null; try{ s=JSON.parse(localStorage.getItem(this.KEY)); }catch(e){} if(!s || !Array.isArray(s.docs)){ s=this.seed(); this.write(s); } this.store=s; this.syncIdentity(); this.setState({loaded:true}); }
  write(s){ try{ localStorage.setItem(this.KEY, JSON.stringify(s)); }catch(e){} }
  persist(){ this.write(this.store); }

  // ECRIN: maintient la clé d'identité unifiée (D5) à partir du profil du socle.
  syncIdentity(){ try{ const n=(this.store.profile&&this.store.profile.name)||''; localStorage.setItem(this.IDKEY, JSON.stringify({name:n})); }catch(e){} }

  collById(id){ return this.COLLS.find(c=>c.id===id) || this.COLLS[this.COLLS.length-1]; }
  finById(id){ return this.FIN.find(c=>c.id===id) || null; }
  typeLabel(id){ return (this.T[id]||{}).label || id; }
  daysLeft(exp){ if(!exp) return null; const t=new Date(); t.setHours(0,0,0,0); const d=new Date(exp+'T00:00:00'); return Math.round((d-t)/86400000); }
  whenLabel(d){ if(d==null) return ''; if(d<0) return 'Retard '+(-d)+'j'; if(d===0) return "Aujourd’hui"; if(d===1) return 'Demain'; return 'Dans '+d+'j'; }
  whenColor(d){ if(d==null) return '#948c7e'; if(d<0) return '#d2553c'; if(d<=14) return '#b9810f'; return '#1f8a5b'; }
  fmtDate(exp){ if(!exp) return ''; const d=new Date(exp+'T00:00:00'); return d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}); }
  fmtDateShort(iso){ if(!iso) return ''; const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }
  eur(n){ if(n==null||isNaN(n)) return '—'; return Math.round(n).toLocaleString('fr-FR')+' €'; }
  eur2(n){ if(n==null||isNaN(n)) return '—'; return n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'; }
  icon(name,color,size){ const d=this.ICONS[name]||''; const ps=d.split('|').map((p,i)=>React.createElement('path',{d:p,key:i})); return React.createElement('svg',{viewBox:'0 0 24 24',fill:'none',stroke:color||'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round',width:size||20,height:size||20,style:{display:'block',flex:'none'}}, ps); }

  go(view, extra){ this.setState(Object.assign({view, q:''}, extra||{})); }
  home(){ this.go('home',{collId:null,docId:null}); }
  openColl(id){ this.go('coll',{collId:id, docId:null}); }
  openDoc(id){ this.go('doc',{docId:id}); }
  openFin(id){ this.go(id,{collId:null,docId:null}); }
  settings(){ this.go('settings'); }

  toastMsg(m){ this.setState({toast:m}); clearTimeout(this._tt); this._tt=setTimeout(()=>this.setState({toast:null}),2400); }

  startAdd(){ this.setState({form:{mode:'add', type:null}}); }
  chooseType(id){ const t=this.T[id]; this.setState({form:{mode:'add', type:id, collId:t.collId, title:'', holder:'', number:'', expiry:'', note:''}}); }
  startEdit(){ const d=this.activeDoc(); if(!d) return; this.setState({form:{mode:'edit', id:d.id, type:d.typeId, collId:d.collId, title:d.title, holder:d.holder||'', number:d.number||'', expiry:d.expiry||'', note:d.note||''}}); }
  setField(e){ const f=e.target.dataset.field; const v=e.target.value; this.setState(s=>({form:Object.assign({}, s.form, {[f]:v})})); }
  cancelForm(){ this.setState({form:null}); }
  saveForm(){ const f=this.state.form; if(!f||!f.type) return; const title=(f.title||'').trim()||this.typeLabel(f.type);
    if(f.mode==='edit'){ const d=this.store.docs.find(x=>x.id===f.id); if(d){ Object.assign(d,{title, holder:f.holder, number:f.number, expiry:f.expiry, note:f.note, typeId:f.type, collId:f.collId}); } this.persist(); this.setState({form:null}); this.toastMsg('Document mis à jour'); }
    else { const id='d'+Date.now(); this.store.docs.unshift({id, typeId:f.type, collId:f.collId, title, holder:f.holder, number:f.number, expiry:f.expiry, note:f.note, createdAt:Date.now()}); this.persist(); this.setState({form:null, view:'doc', docId:id, q:''}); this.toastMsg('Document ajouté'); }
  }
  removeDoc(){ const d=this.activeDoc(); if(!d) return; if(!confirm('Supprimer « '+d.title+' » ?')) return; this.store.docs=this.store.docs.filter(x=>x.id!==d.id); this.persist(); this.home(); this.toastMsg('Document supprimé'); }
  activeDoc(){ return this.store ? this.store.docs.find(d=>d.id===this.state.docId) : null; }

  onSearch(e){ this.setState({q:e.target.value}); }
  accentFor(n){ const pal=['#b3892f','#2b6cd9','#1f8a5b','#c0563a','#7a4fb5','#1c8c84','#b03f6e','#5a6b2f']; n=(n||'').trim(); if(!n) return '#b3892f'; let s=0; for(let i=0;i<n.length;i++) s+=n.charCodeAt(i); return pal[s%pal.length]; }
  setNameDraft(e){ this.setState({nameDraft:e.target.value}); }
  submitName(){ const n=(this.state.nameDraft||'').trim(); if(!n) return; this.store.profile=this.store.profile||{}; this.store.profile.name=n; this.persist(); this.syncIdentity(); this.setState({welcome:false, nameDraft:''}); this.toastMsg('Bienvenue, '+n+' !'); }
  changeName(){ this.setState({welcome:true, nameDraft:(this.store.profile&&this.store.profile.name)||''}); }
  resetDemo(){ const s=this.seed(); this.store=s; this.write(s); this.syncIdentity(); this.home(); this.toastMsg('Exemples rechargés'); }
  clearAll(){ if(!confirm('Tout effacer ? Les exemples partiront aussi.')) return; const s={profile:(this.store&&this.store.profile)||{name:''}, docs:[]}; this.store=s; this.write(s); this.syncIdentity(); this.home(); this.toastMsg('Écrin vidé'); }

  // ECRIN: agrège les signaux finance des deux modules (API lecture seule).
  finSignals(){
    const self=this, raw=[]; let cb=null, inv=null;
    try{ if(window.ECRIN_CB) cb=window.ECRIN_CB.getSignals(); }catch(e){}
    try{ if(window.ECRIN_INV) inv=window.ECRIN_INV.getSignals(); }catch(e){}
    if(cb){
      raw.push({label:'Solde du mois', value:this.eur2(cb.soldeMois), tone:(cb.soldeMois>=0?'#1f8a5b':'#d2553c'), accent:'#1f8a5b', icon:'wallet', open:()=>this.openFin('cb')});
      raw.push({label:'Budget variable restant', value:this.eur(cb.budgetRestant), tone:(cb.budgetRestant>=0?'#211d17':'#d2553c'), accent:'#1f8a5b', icon:'check', open:()=>this.openFin('cb')});
      if(cb.prochainPrelevement){ const p=cb.prochainPrelevement; raw.push({label:'Prochain prélèvement', value:this.eur(Math.abs(p.amount)), sub:(p.label||'')+' · '+this.fmtDateShort(p.date), tone:'#b9810f', accent:'#b9810f', icon:'clock', open:()=>this.openFin('cb')}); }
      else if(cb.decouvertJours){ raw.push({label:'Jours à découvert (mois)', value:cb.decouvertJours+' j', tone:'#d2553c', accent:'#d2553c', icon:'clock', open:()=>this.openFin('cb')}); }
    }
    if(inv){
      raw.push({label:'Profil investisseur', value:(inv.profil||'À découvrir'), tone:'#b3892f', accent:'#b3892f', icon:'gem', open:()=>this.openFin('inv')});
      if(inv.allocationCible){ const a=inv.allocationCible; raw.push({label:'Allocation cible', value:a.actions+'% actions', sub:a.obligations+'% obligations · '+a.or+'% or', tone:'#211d17', accent:'#b3892f', icon:'trend', open:()=>this.openFin('inv')}); }
      else { raw.push({label:'Allocation cible', value:'À définir', sub:'Fais le quiz profil', tone:'#948c7e', accent:'#b3892f', icon:'trend', open:()=>this.openFin('inv')}); }
    }
    return raw.map((s,i)=>({ key:'fs'+i, label:s.label, value:s.value, tone:s.tone, accent:s.accent, accentSoft:s.accent+'1c', iconEl:self.icon(s.icon,s.accent,16), sub:s.sub||'', hasSub:!!s.sub, open:s.open }));
  }

  renderVals(){
    const self=this, S=this.state;
    if(!S.loaded || !this.store) return { ready:false };
    const docs=this.store.docs||[];
    const navBase='display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:9px 12px;border-radius:12px;border:1px solid transparent;cursor:pointer;font-size:14px;font-weight:500;margin-bottom:2px;font-family:inherit;';
    const on='background:rgba(30,26,18,.09);border-color:rgba(30,26,18,.11);color:#211d17;';
    const off='background:transparent;color:#6e675b;';

    const mk=(d)=>{ const c=self.collById(d.collId); const dl=self.daysLeft(d.expiry); return {
      raw:d, id:d.id, title:d.title, typeLabel:self.typeLabel(d.typeId),
      collLabel:c.label, accent:c.accent, tint:c.accent+'22', soft:c.accent+'14', border:c.accent+'66',
      iconEl:self.icon(c.icon,c.accent,18),
      sub:d.holder||'', hasSub:!!d.holder,
      dl, when:self.whenLabel(dl), whenColor:self.whenColor(dl),
      open:()=>self.openDoc(d.id) }; };
    const items=docs.map(mk);

    const reminders=items.filter(x=>x.dl!=null && x.dl<=90).sort((a,b)=>a.dl-b.dl).map((x,i)=>Object.assign({key:'r'+i},x));
    const overdue=items.filter(x=>x.dl!=null && x.dl<0).length;
    const future=items.filter(x=>x.dl!=null && x.dl>=0).sort((a,b)=>a.dl-b.dl);
    const statNext=overdue>0 ? (overdue+(overdue>1?' en retard':' en retard')) : (future.length? self.whenLabel(future[0].dl)+' · '+future[0].title.slice(0,16) : 'Rien à venir');

    const grid=self.COLLS.map((c,i)=>{ const n=docs.filter(d=>d.collId===c.id).length; return {
      key:'g'+i, label:c.label, accent:c.accent, soft:c.accent+'14', border:c.accent+'55',
      iconEl:self.icon(c.icon,c.accent,21), count:n, countLabel:n+' '+(n>1?'documents':'document'),
      open:()=>self.openColl(c.id) }; });

    // ECRIN: tuiles des domaines finance, dans la même grille visuelle.
    const finGrid=self.FIN.map((c,i)=>({
      key:'fg'+i, label:c.label, accent:c.accent, soft:c.accent+'14', border:c.accent+'55',
      iconEl:self.icon(c.icon,c.accent,21), desc:c.desc, open:()=>self.openFin(c.id) }));

    const navItems=self.COLLS.map((c,i)=>{ const n=docs.filter(d=>d.collId===c.id).length; const active=S.view==='coll'&&S.collId===c.id; return {
      key:'n'+i, label:c.label, count:n, iconEl:self.icon(c.icon,c.accent,18), active,
      btnStyle:navBase+(active?on:off), open:()=>self.openColl(c.id) }; });

    const finNav=self.FIN.map((c,i)=>{ const active=S.view===c.id; return {
      key:'fn'+i, label:c.label, iconEl:self.icon(c.icon,c.accent,18), active,
      btnStyle:navBase+(active?on:off), open:()=>self.openFin(c.id) }; });

    const recent=items.slice().sort((a,b)=>(b.raw.createdAt||0)-(a.raw.createdAt||0)).slice(0,5).map((x,i)=>Object.assign({key:'rc'+i},x));

    const h=new Date().getHours(); const greet=h<5?'Bonne nuit':h<12?'Bonjour':h<18?'Bon après-midi':'Bonsoir';
    const name=(this.store.profile&&this.store.profile.name)||'';
    const accent=self.accentFor(name); const aDraft=self.accentFor(S.nameDraft||'');
    const todayLabel=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
    const homeSub = reminders.length ? ('Tu as '+reminders.length+(reminders.length>1?' échéances':' échéance')+' à surveiller'+(overdue?', dont '+overdue+' en retard.':'.')) : 'Tout est à jour. Rien n’expire bientôt.';

    // ECRIN: signaux finance agrégés pour l'accueil.
    const finSig=self.finSignals();

    const q=(S.q||'').trim().toLowerCase();
    const searching=q.length>0;
    let searchResults=[];
    if(searching){ searchResults=items.filter(x=>{ const d=x.raw; return (d.title||'').toLowerCase().includes(q)||(d.holder||'').toLowerCase().includes(q)||(d.number||'').toLowerCase().includes(q)||x.typeLabel.toLowerCase().includes(q)||x.collLabel.toLowerCase().includes(q); }).map((x,i)=>Object.assign({key:'s'+i},x)); }

    let collMeta=null, collDocs=[];
    if(S.view==='coll'){ const c=self.collById(S.collId); collDocs=items.filter(x=>x.raw.collId===c.id).sort((a,b)=>{ const ad=a.dl==null?99999:a.dl, bd=b.dl==null?99999:b.dl; return ad-bd; }).map((x,i)=>Object.assign({key:'cd'+i},x)); collMeta={label:c.label, accent:c.accent, soft:c.accent+'14', iconEl:self.icon(c.icon,c.accent,24), countLabel:collDocs.length+' '+(collDocs.length>1?'documents':'document')}; }

    // ECRIN: en-tête de domaine finance (le socle porte le titre, l'outil le contenu).
    let finMeta=null;
    if(S.view==='cb'||S.view==='inv'){ const c=self.finById(S.view); if(c){ finMeta={label:c.label, desc:c.desc, accent:c.accent, soft:c.accent+'18', iconEl:self.icon(c.icon,c.accent,24)}; } }

    let doc=null;
    if(S.view==='doc'){ const d=self.activeDoc(); if(d){ const c=self.collById(d.collId); const dl=self.daysLeft(d.expiry); const bare=!d.holder&&!d.number&&!d.expiry&&!d.note; doc={ id:d.id, title:d.title, typeLabel:self.typeLabel(d.typeId), collLabel:c.label, accent:c.accent, tint:c.accent+'22', soft:c.accent+'16', iconEl:self.icon(c.icon,c.accent,26), holder:d.holder||'', hasHolder:!!d.holder, number:d.number||'', hasNumber:!!d.number, hasExp:!!d.expiry, expiryDate:self.fmtDate(d.expiry), when:self.whenLabel(dl), whenColor:self.whenColor(dl), note:d.note||'', hasNote:!!d.note, bare }; } }

    const F=S.form; const showForm=!!F; const formPicker=showForm&&!F.type; const formFields=showForm&&!!F.type;
    let typeGroups=[];
    if(formPicker){ typeGroups=self.TYPE_GROUPS.map((g,gi)=>{ const c=self.collById(g.collId); return { key:'tg'+gi, label:c.label, iconEl:self.icon(c.icon,c.accent,15), types:g.types.map((t,ti)=>({key:'tt'+gi+'_'+ti, label:t[1], border:c.accent+'88', pick:()=>self.chooseType(t[0])})) }; }); }
    let formMeta=null;
    if(formFields){ const c=self.collById(F.collId); formMeta={ collLabel:c.label, typeLabel:self.typeLabel(F.type), tint:c.accent+'22', iconEl:self.icon(c.icon,c.accent,18), header:F.mode==='edit'?'Modifier le document':'Nouveau document', saveLabel:F.mode==='edit'?'Enregistrer':'Ajouter à Écrin', titlePh:self.typeLabel(F.type)+(F.holder? ' — '+F.holder:' — …') }; }

    return {
      ready:true,
      markIcon:React.createElement('svg',{viewBox:'0 0 24 24',width:17,height:17,style:{display:'block'}},React.createElement('path',{d:'M12 2.3l2.25 7.45L21.7 12l-7.45 2.25L12 21.7l-2.25-7.45L2.3 12l7.45-2.25z',fill:'#b3892f'})),
      homeIcon:self.icon('home', S.view==='home'?'#b3892f':'#6e675b', 18),
      bellIcon:self.icon('bell','#b9810f',18),
      shieldIcon:self.icon('shield', S.view==='settings'?'#b3892f':'#6e675b', 18),
      shieldIconG:self.icon('shield','#1f8a5b',18),
      searchIcon:self.icon('search','#948c7e',16),
      addIcon:self.icon('plus','#f4f1ea',18),
      addIconLight:self.icon('plus','#b3892f',16),
      backIcon:self.icon('back','#6e675b',16),
      chevIcon:self.icon('chev','#a79e8f',16),
      editIcon:self.icon('edit','#b3892f',17),
      trashIcon:self.icon('trash','currentColor',17),
      emptyIcon:self.icon('star','#cfc8ba',44),
      toastCheck:self.icon('check','#1f8a5b',17),
      homeBtnStyle:navBase+(S.view==='home'?on:off),
      settingsBtnStyle:navBase+(S.view==='settings'?on:off),
      gotoHome:()=>self.home(), gotoSettings:()=>self.settings(), openAdd:()=>self.startAdd(),
      navItems, finNav,
      q:S.q, onSearch:(e)=>self.onSearch(e),
      isHome:S.view==='home'&&!searching, isSearch:searching,
      isColl:S.view==='coll'&&!searching, isDoc:S.view==='doc'&&!searching, isSettings:S.view==='settings'&&!searching,
      isCB:S.view==='cb'&&!searching, isInv:S.view==='inv'&&!searching, finMeta,
      searching, searchResults, searchEmpty:searching&&searchResults.length===0, searchCount:searchResults.length+' résultat'+(searchResults.length>1?'s':''),
      greeting:greet+(name?', '+name:''), todayLabel, homeSub,
      hasReminders:reminders.length>0, reminders, reminderCount:reminders.length+(reminders.length>1?' éléments':' élément'),
      statDocs:docs.length, statColls:self.COLLS.filter(c=>docs.some(d=>d.collId===c.id)).length, statOverdue:overdue, overdueColor:overdue>0?'#d2553c':'#211d17', statNext,
      grid, finGrid, recent, hasRecent:recent.length>0, isEmptyAll:docs.length===0,
      finSig, hasFinSig:finSig.length>0, walletIcon:self.icon('wallet','#1f8a5b',18),
      showDocArea: searching || (S.view!=='cb' && S.view!=='inv'),
      collMeta, collDocs, collEmpty:S.view==='coll'&&collDocs.length===0,
      doc, editDoc:()=>self.startEdit(), deleteDoc:()=>self.removeDoc(),
      showForm, formPicker, formFields, typeGroups, formMeta,
      draftTitle:F?(F.title||''):'', draftHolder:F?(F.holder||''):'', draftNumber:F?(F.number||''):'', draftExpiry:F?(F.expiry||''):'', draftNote:F?(F.note||''):'',
      setField:(e)=>self.setField(e), saveForm:()=>self.saveForm(), cancelForm:()=>self.cancelForm(), stop:(e)=>e.stopPropagation(),
      resetDemo:()=>self.resetDemo(), clearAll:()=>self.clearAll(),
      brandName:name||'Écrin', initial:(name||'É').charAt(0).toUpperCase(),
      accent, accentSoft:accent+'1c', accentBorder:accent+'66',
      welcome:S.welcome||!name, nameDraft:S.nameDraft||'',
      welcomeAccent:aDraft, welcomeAccentSoft:aDraft+'18', welcomeAccentBorder:aDraft+'59', welcomeInitial:((S.nameDraft||'').trim().charAt(0)||'·').toUpperCase(),
      setNameDraft:(e)=>self.setNameDraft(e), submitName:()=>self.submitName(), changeName:()=>self.changeName(), onNameKey:(e)=>{ if(e.key==='Enter') self.submitName(); },
      toast:S.toast, toastShow:!!S.toast,
    };
  }
}
