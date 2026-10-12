import React, { useEffect, useMemo, useState } from 'react';

import { Activity, AlertTriangle, Bookmark, Check, ChevronDown, CircleHelp, Clock3, Database, ExternalLink, Globe2, LayoutDashboard, ListFilter, LoaderCircle, Plus, Radar, RefreshCw, Rss, Search, Settings, ShieldCheck, Signal, SlidersHorizontal, Trash2, X } from 'lucide-react';



const nav = [

  {id:'overview',label:'Situation Room',icon:LayoutDashboard},

  {id:'headlines',label:'Headlines',icon:Globe2},

  {id:'saved',label:'Saved articles',icon:Bookmark},

  {id:'signals',label:'Signals',icon:Activity},

  {id:'sources',label:'Sources',icon:Rss},

  {id:'watchlist',label:'Watchlist',icon:Bookmark},

  {id:'timeline',label:'Timeline',icon:Clock3},

  {id:'settings',label:'Settings',icon:Settings}

];

const blankEvent = {title:'',summary:'',source_name:'Manual entry',source_url:'',severity:'Moderate',region:'Global',status:'New',published_at:''};

const blankSource = {name:'',url:'',type:'RSS',enabled:true,notes:'',region:'Global'};

const blankTopic = {name:'',description:''};

const dateLabel = (value) => { if (!value) return 'Time not supplied'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString(); };

function useData() {

  const [events,setEvents] = useState([]), [sources,setSources] = useState([]), [topics,setTopics] = useState([]), [dashboard,setDashboard] = useState({events:0,sources:0,topics:0,recent:0}), [timeline,setTimeline] = useState([]), [settings,setSettings] = useState({}), [saved,setSaved] = useState([]), [loading,setLoading] = useState(true), [error,setError] = useState('');

  const refresh = async () => {

    if (!window.jass) { setError('Desktop bridge unavailable. Launch the application through Electron.'); setLoading(false); return; }

    setLoading(true);

    try { const [e,s,t,d,tl,st,sv] = await Promise.all([window.jass.events.list({}),window.jass.sources.list(),window.jass.topics.list(),window.jass.dashboard.get(),window.jass.timeline.list(),window.jass.settings.get(),window.jass.saved.list()]); setEvents(e);setSources(s);setTopics(t);setDashboard(d);setTimeline(tl);setSettings(st);setSaved(sv);setError(''); }

    catch (err) { setError(err.message || 'Unable to load local data.'); } finally { setLoading(false); }

  };

  useEffect(() => { refresh(); }, []);

  return {events,setEvents,sources,setSources,topics,setTopics,dashboard,setDashboard,timeline,setTimeline,settings,setSettings,saved,setSaved,loading,error,setError,refresh};

}

function Badge({children,tone='neutral'}) { return <span className={'badge '+tone}>{children}</span>; }

function Empty({icon:Icon=CircleHelp,title,body,action}) { return <div className="empty"><div className="empty-icon"><Icon size={24}/></div><h3>{title}</h3><p>{body}</p>{action}</div>; }

function Modal({title,onClose,children}) { return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="modal"><header className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={18}/></button></header>{children}</section></div>; }

function EventForm({initial,onCancel,onSave}) {

 const [form,setForm]=useState(initial||blankEvent); const [busy,setBusy]=useState(false); const change=(k,v)=>setForm(f=>({...f,[k]:v}));

 return <form className="form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await onSave(form);}finally{setBusy(false);}}}>

  <label>Title *<input required maxLength="300" value={form.title} onChange={e=>change('title',e.target.value)} autoFocus/></label>

  <label>Summary<textarea rows="4" value={form.summary||''} onChange={e=>change('summary',e.target.value)}/></label>

  <div className="form-grid"><label>Source name<input value={form.source_name||''} onChange={e=>change('source_name',e.target.value)}/></label><label>Source URL<input type="url" placeholder="https://…" value={form.source_url||''} onChange={e=>change('source_url',e.target.value)}/></label></div>

  <div className="form-grid"><label>Severity<select value={form.severity} onChange={e=>change('severity',e.target.value)}>{['Low','Moderate','High','Critical'].map(x=><option key={x}>{x}</option>)}</select></label><label>Region<input value={form.region||'Global'} onChange={e=>change('region',e.target.value)}/></label></div>

  <label>Publication time (optional)<input type="datetime-local" value={form.published_at&&String(form.published_at).includes('T')?String(form.published_at).slice(0,16):''} onChange={e=>change('published_at',e.target.value?new Date(e.target.value).toISOString():null)}/></label>

  <footer className="form-actions"><button type="button" className="btn secondary" onClick={onCancel}>Cancel</button><button className="btn primary" disabled={busy}>{busy?'Saving…':'Save event'}</button></footer>

 </form>;

}

function App() {

 const data=useData(); const [page,setPage]=useState('overview'); const [query,setQuery]=useState(''); const [severity,setSeverity]=useState('All'); const [region,setRegion]=useState('All'); const [modal,setModal]=useState(null); const [notice,setNotice]=useState(''); const [refreshingFeeds,setRefreshingFeeds]=useState(false); const [version,setVersion]=useState('0.1.0');
 const [readerQuery,setReaderQuery]=useState(''); const [readerRegion,setReaderRegion]=useState('All');

 useEffect(()=>{window.jass?.app.version().then(setVersion).catch(()=>{});},[]);

 const say=(msg)=>{setNotice(msg);setTimeout(()=>setNotice(''),3200);};

 const filtered=useMemo(()=>data.events.filter(e=>(!query||[e.title,e.summary,e.source_name,e.region].some(x=>String(x||'').toLowerCase().includes(query.toLowerCase())))&&(severity==='All'||e.severity===severity)&&(region==='All'||e.region===region)),[data.events,query,severity,region]);
 const readerEvents=useMemo(()=>data.events
  .filter(e=>(!readerQuery||[e.title,e.summary,e.source_name,e.region]
   .some(x=>String(x||'').toLowerCase().includes(readerQuery.toLowerCase())))
   &&(readerRegion==='All'||(e.region||'Global')===readerRegion))
  .sort((a,b)=>new Date(b.published_at||b.created_at||0)-new Date(a.published_at||a.created_at||0)),
  [data.events,readerQuery,readerRegion]);

 const refresh=async()=>{await data.refresh();say('Local workspace refreshed.');};

 const saveEvent=async form=>{try{await window.jass.events.save(form);setModal(null);await data.refresh();say('Event saved locally.');}catch(e){data.setError(e.message);}};

 const deleteEvent=async id=>{if(!confirm('Delete this event from the local database?'))return;try{await window.jass.events.delete(id);await data.refresh();say('Event deleted.');}catch(e){data.setError(e.message);}};

 const saveSource=async form=>{try{await window.jass.sources.save(form);setModal(null);await data.refresh();say('Source definition saved. Collection is not enabled in v0.1.');}catch(e){data.setError(e.message);}};

 const saveTopic=async form=>{try{await window.jass.topics.save(form);setModal(null);await data.refresh();say('Watchlist topic saved.');}catch(e){data.setError(e.message);}};

 const updateSetting=async (key,value)=>{try{const result=await window.jass.settings.save({[key]:value});data.setSettings(result);say('Settings saved locally.');}catch(e){data.setError(e.message);}};
 const toggleSaved=async id=>{
  try {
   await window.jass.saved.toggle(id);
   await data.refresh();
   say('Saved articles updated.');
  } catch(e) {
   data.setError(e.message||'Unable to update saved articles.');
  }
 };
 const openArticle=url=>{
  try {
   const parsed=new URL(url);
   if(!['http:','https:'].includes(parsed.protocol)){
    say('Only HTTP and HTTPS article links are allowed.');
    return;
   }
   window.open(parsed.href,'_blank','noopener,noreferrer');
  } catch {
   say('This article URL is invalid.');
  }
 };

 const heading=nav.find(n=>n.id===page);

 return <div className="app-shell">

  <aside className="sidebar">

   <div className="brand"><div className="brand-mark"><Radar size={24}/></div><div><div className="brand-name">JASS <span>SIGNAL</span></div><div className="brand-sub">INTELLIGENCE STUDIO</div></div></div>

   <div className="workspace-label">WORKSPACE</div>

   <nav>{nav.map(n=><button key={n.id} className={'nav-item '+(page===n.id?'active':'')} onClick={()=>setPage(n.id)}><n.icon size={18}/><span>{n.label}</span>{n.id==='signals'&&data.dashboard.recent>0&&<span className="nav-count">{data.dashboard.recent}</span>}</button>)}</nav>

   <div className="sidebar-bottom"><div className="local-card"><div className="local-icon"><ShieldCheck size={17}/></div><div><strong>Local-first mode</strong><span>Your workspace stays on this device.</span></div><span className="online-dot"/></div><div className="version">JASS SIGNAL · v{version}</div></div>

  </aside>

  <main className="main">

   <header className="topbar"><div className="breadcrumb"><span>JASS SIGNAL</span><span className="crumb-slash">/</span><strong>{heading?.label||'Workspace'}</strong></div><div className="top-actions"><Badge tone="blue"><span className="status-dot"/> LOCAL DATABASE</Badge><button className="icon-btn" title="Refresh workspace" onClick={refresh}><RefreshCw size={17}/></button></div></header>

   <div className="content">

    {data.error&&<div className="error-banner"><AlertTriangle size={17}/><span>{data.error}</span><button onClick={()=>data.setError('')}><X size={16}/></button></div>}

    {page==='overview'&&<><div className="page-title-row"><div><div className="eyebrow">GLOBAL INTELLIGENCE · INDIA & CANADA PRIORITY</div><h1>Situation Room</h1><p className="subtitle">Worldwide awareness with priority coverage for India, Canada and bilateral developments.</p></div><button className="btn primary" onClick={()=>setModal({kind:'event'})}><Plus size={17}/> Add event</button></div>

      <div className="demo-banner"><div className="demo-symbol"><CircleHelp size={18}/></div><div><strong>Live RSS collection · Manual refresh</strong><p>Use Sources → Refresh feeds to collect public updates. Existing demonstration records are illustrative, not live reporting.</p></div><Badge tone="blue">MANUAL REFRESH</Badge></div>

      <div className="focus-grid">

        <article className="focus-card"><div className="focus-card-head"><span className="focus-code india">IN</span><Badge tone="blue">PRIORITY REGION</Badge></div><h3>India</h3><p>Economy, public policy, infrastructure, technology, climate and regional security.</p><button className="text-btn" onClick={()=>{setPage('signals');setRegion('India');setQuery('');setSeverity('All');}}>Explore India signals <ExternalLink size={14}/></button></article>

        <article className="focus-card"><div className="focus-card-head"><span className="focus-code canada">CA</span><Badge tone="blue">PRIORITY REGION</Badge></div><h3>Canada</h3><p>Economy, energy, Arctic affairs, immigration policy, technology and climate.</p><button className="text-btn" onClick={()=>{setPage('signals');setRegion('Canada');setQuery('');setSeverity('All');}}>Explore Canada signals <ExternalLink size={14}/></button></article>

        <article className="focus-card"><div className="focus-card-head"><span className="focus-code bilateral">IN ↔ CA</span><Badge tone="neutral">BILATERAL</Badge></div><h3>India–Canada relations</h3><p>Trade, investment, education, mobility, diplomacy and technology cooperation.</p><button className="text-btn" onClick={()=>{setPage('signals');setRegion('India–Canada');setQuery('');setSeverity('All');}}>Explore bilateral signals <ExternalLink size={14}/></button></article>

      </div>

      <div className="stats-grid"><Stat icon={Signal} label="Stored events" value={data.dashboard.events} note="Local records"/><Stat icon={Rss} label="Enabled sources" value={data.dashboard.sources} note="Definitions only"/><Stat icon={Bookmark} label="Watchlist topics" value={data.dashboard.topics} note="User-configurable"/><Stat icon={Clock3} label="Last 24 hours" value={data.dashboard.recent} note="Stored event timestamps"/></div>

      <section className="panel"><div className="panel-heading"><div><h2>Recent signals</h2><p>Most recent records in the local database</p></div><button className="text-btn" onClick={()=>setPage('signals')}>View all <ExternalLink size={14}/></button></div><EventTable events={data.events.slice(0,5)} onEdit={e=>setModal({kind:'event',record:e})} onDelete={deleteEvent} onOpen={e=>setModal({kind:'details',record:e})}/></section>

      <div className="two-col"><section className="panel"><div className="panel-heading"><div><h2>Source health</h2><p>Last recorded feed status; refresh manually from Sources</p></div><button className="icon-btn" onClick={()=>setPage('sources')}><ExternalLink size={16}/></button></div>{data.sources.slice(0,4).map(s=><div className="source-row" key={s.id}><div className="source-icon"><Rss size={16}/></div><div className="source-info"><strong>{s.name}</strong><span>{s.type} · {s.url||'No URL configured'}</span></div><Badge tone={s.enabled?'green':'neutral'}>{s.enabled?'Enabled':'Disabled'}</Badge></div>)}{!data.sources.length&&<p className="muted">No sources configured.</p>}</section>

      <section className="panel"><div className="panel-heading"><div><h2>Watchlist</h2><p>Topics you want to follow</p></div><button className="icon-btn" onClick={()=>setPage('watchlist')}><ExternalLink size={16}/></button></div><div className="topic-cloud">{data.topics.slice(0,12).map(t=><span className="topic-chip" key={t.id}>{t.name}<small>{t.event_count||0}</small></span>)}</div>{!data.topics.length&&<p className="muted">Add a topic to start your watchlist.</p>}</section></div>

    </>}

    {page==='headlines'&&<><div className="page-title-row"><div><div className="eyebrow">LOCAL NEWS READER</div><h1>Headlines</h1><p className="subtitle">A compact reading view of collected articles. Refresh feeds from Sources to fetch new items.</p></div><button className="btn secondary" onClick={refresh}><RefreshCw size={16}/> Refresh library</button></div><div className="reader-toolbar"><div className="search-box"><Search size={17}/><input placeholder="Search headlines, source, summary or region…" value={readerQuery} onChange={e=>setReaderQuery(e.target.value)}/>{readerQuery&&<button className="icon-btn tiny" onClick={()=>setReaderQuery('')}><X size={14}/></button>}</div><div className="select-wrap"><Globe2 size={16}/><select aria-label="Filter headline region" value={readerRegion} onChange={e=>setReaderRegion(e.target.value)}><option value="All">All regions</option><option value="India">India</option><option value="Canada">Canada</option><option value="India–Canada">India–Canada</option><option value="Global">Global</option><option value="Asia-Pacific">Asia-Pacific</option><option value="North America">North America</option></select><ChevronDown size={14}/></div><span className="result-count">{readerEvents.length} articles</span></div><section className="reader-list">{readerEvents.map(e=>{const isSaved=data.saved.some(s=>Number(s.id)===Number(e.id)||Number(s.event_id)===Number(e.id));return <article className="reader-item" key={e.id}><div className="reader-item-main"><div className="reader-meta"><span>{e.source_name||'Unknown source'}</span><span>·</span><span>{e.region||'Global'}</span><span>·</span><span>{dateLabel(e.published_at||e.created_at)}</span></div><button className="reader-title" onClick={()=>e.source_url?openArticle(e.source_url):setModal({kind:'details',record:e})}>{e.title}</button>{e.summary&&<p className="reader-summary">{e.summary}</p>}<div className="reader-item-actions">{e.source_url&&<button className="text-btn" onClick={()=>openArticle(e.source_url)}>Read original <ExternalLink size={14}/></button>}{e.status==='Demo'&&<Badge tone="amber">DEMO</Badge>}</div></div><button className={'icon-btn reader-save '+(isSaved?'is-saved':'')} title={isSaved?'Remove from saved articles':'Save article'} aria-label={isSaved?'Remove from saved articles':'Save article'} onClick={()=>toggleSaved(e.id)}>{isSaved?<Check size={17}/>:<Bookmark size={17}/>}</button></article>})}{!readerEvents.length&&<Empty icon={Rss} title="No headlines found" body="Refresh your RSS feeds from Sources, or change the search and region filters." action={<button className="btn secondary" onClick={()=>setPage('sources')}>Open Sources <ExternalLink size={14}/></button>}/>}</section></>}

    {page==='saved'&&<><div className="page-title-row"><div><div className="eyebrow">PERSONAL READING LIST</div><h1>Saved articles</h1><p className="subtitle">Articles you bookmarked are stored in your local SQLite database.</p></div><button className="btn secondary" onClick={refresh}><RefreshCw size={16}/> Refresh</button></div><section className="reader-list">{data.saved.map(e=><article className="reader-item" key={e.id}><div className="reader-item-main"><div className="reader-meta"><span>{e.source_name||'Unknown source'}</span><span>·</span><span>{e.region||'Global'}</span><span>·</span><span>Saved {dateLabel(e.saved_at)}</span></div><button className="reader-title" onClick={()=>e.source_url?openArticle(e.source_url):setModal({kind:'details',record:e})}>{e.title}</button>{e.summary&&<p className="reader-summary">{e.summary}</p>}<div className="reader-item-actions">{e.source_url&&<button className="text-btn" onClick={()=>openArticle(e.source_url)}>Read original <ExternalLink size={14}/></button>}</div></div><button className="icon-btn danger reader-save" title="Remove saved article" aria-label="Remove saved article" onClick={()=>toggleSaved(e.id)}><Trash2 size={16}/></button></article>)}{!data.saved.length&&<Empty icon={Bookmark} title="No saved articles yet" body="Use the bookmark control beside a headline to keep it here." action={<button className="btn secondary" onClick={()=>setPage('headlines')}>Browse headlines <ExternalLink size={14}/></button>}/>}</section></>}    {page==='signals'&&<><div className="page-title-row"><div><div className="eyebrow">EVENT REGISTER</div><h1>Signals</h1><p className="subtitle">Search, review and manage locally stored events.</p></div><button className="btn primary" onClick={()=>setModal({kind:'event'})}><Plus size={17}/> Add event</button></div><div className="toolbar"><div className="search-box"><Search size={17}/><input placeholder="Search title, summary, source or region…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="icon-btn tiny" onClick={()=>setQuery('')}><X size={14}/></button>}</div><div className="select-wrap"><ListFilter size={16}/><select value={severity} onChange={e=>setSeverity(e.target.value)}>{['All','Low','Moderate','High','Critical'].map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={14}/></div><div className="select-wrap"><Globe2 size={16}/><select aria-label="Filter region" value={region} onChange={e=>setRegion(e.target.value)}><option value="All">All regions</option><option value="India">India</option><option value="Canada">Canada</option><option value="India–Canada">India–Canada</option><option value="Global">Global</option><option value="Asia-Pacific">Asia-Pacific</option><option value="North America">North America</option></select><ChevronDown size={14}/></div><span className="result-count">{filtered.length} records</span></div><section className="panel"><EventTable events={filtered} onEdit={e=>setModal({kind:'event',record:e})} onDelete={deleteEvent} onOpen={e=>setModal({kind:'details',record:e})}/></section></>}

    {page==='sources'&&<><div className="page-title-row"><div><div className="eyebrow">COLLECTION CONFIGURATION</div><h1>Sources</h1><p className="subtitle">Manage public RSS feeds and review collection status. Fetching happens only when requested.</p></div><div className="row-actions"><button className="btn secondary" disabled={refreshingFeeds} onClick={async()=>{setRefreshingFeeds(true);try{const r=await window.jass.feeds.refresh();await data.refresh();say(`RSS refresh finished: ${r.inserted} new item(s), ${r.duplicates} duplicate(s), ${r.failed} failed feed(s).`);}catch(e){data.setError(e.message||'RSS refresh failed.');}finally{setRefreshingFeeds(false);}}}><RefreshCw size={16}/>{refreshingFeeds?'Refreshing…':'Refresh feeds'}</button><button className="btn primary" onClick={()=>setModal({kind:'source'})}><Plus size={17}/> Add source</button></div></div><div className="info-banner"><Database size={17}/><span>Use Refresh feeds to fetch enabled RSS sources. Articles are stored locally and duplicates are skipped.</span></div><section className="panel"><div className="table-wrap"><table><thead><tr><th>Source</th><th>Region</th><th>Type</th><th>Address</th><th>Feed status</th><th>Actions</th></tr></thead><tbody>{data.sources.map(s=><tr key={s.id}><td><strong>{s.name}</strong><small>{s.notes||'No notes'}</small></td><td>{s.region||'Global'}</td><td>{s.type}</td><td className="url-cell">{s.url ? <a className="source-url-link" href={s.url} title="Open feed address" onClick={e=>{e.preventDefault();window.open(s.url,'_blank');}}>{s.url}<ExternalLink size={12}/></a> : '—'}</td><td><Badge tone={!s.enabled?'neutral':String(s.last_status||'').startsWith('OK')?'green':String(s.last_status||'').startsWith('Error')?'red':'neutral'}>{s.enabled?(s.last_status||'Not checked'):'Disabled'}</Badge><small>{s.last_checked_at?dateLabel(s.last_checked_at):'Never fetched'}</small></td><td><div className="row-actions"><button className="btn small secondary" onClick={()=>setModal({kind:'source',record:s})}>Edit</button><button className="icon-btn danger" onClick={async()=>{if(confirm('Delete this source definition?')){await window.jass.sources.delete(s.id);await data.refresh();}}}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table>{!data.sources.length&&<Empty icon={Rss} title="No sources yet" body="Add a source definition to prepare for a future collection adapter."/>}</div></section></>}

    {page==='watchlist'&&<><div className="page-title-row"><div><div className="eyebrow">MONITORED SUBJECTS</div><h1>Watchlist</h1><p className="subtitle">Track India, Canada and bilateral subjects alongside global themes.</p></div><button className="btn primary" onClick={()=>setModal({kind:'topic'})}><Plus size={17}/> Add topic</button></div><div className="topic-grid">{data.topics.map(t=><article className="topic-card" key={t.id}><div className="topic-card-top"><div className="topic-icon"><Bookmark size={18}/></div><Badge tone={t.enabled?'green':'neutral'}>{t.enabled?'Active':'Paused'}</Badge></div><h3>{t.name}</h3><p>{t.description||'No description provided.'}</p><div className="topic-card-bottom"><span>{t.event_count||0} linked events</span><div className="row-actions"><button className="btn small secondary" onClick={()=>setModal({kind:'topic',record:t})}>Edit</button><button className="icon-btn danger" onClick={async()=>{if(confirm('Delete this topic?')){await window.jass.topics.delete(t.id);await data.refresh();}}}><Trash2 size={15}/></button></div></div></article>)}</div>{!data.topics.length&&<Empty icon={Bookmark} title="Your watchlist is empty" body="Add a topic such as energy, geopolitics or technology."/>}</>}

    {page==='timeline'&&<><div className="page-title-row"><div><div className="eyebrow">CHRONOLOGICAL VIEW</div><h1>Timeline</h1><p className="subtitle">A chronological history of stored event records.</p></div><button className="btn secondary" onClick={refresh}><RefreshCw size={16}/> Refresh</button></div><section className="panel timeline-panel">{data.timeline.map((e,i)=><div className="timeline-item" key={e.id}><div className="timeline-rail"><span className={'timeline-dot '+e.severity.toLowerCase()}/>{i<data.timeline.length-1&&<span className="timeline-line"/>}</div><div className="timeline-content"><div className="timeline-meta"><span>{dateLabel(e.event_time)}</span><Badge tone={tone(e.severity)}>{e.severity}</Badge><span>{e.region}</span></div><h3>{e.title}</h3><p>{e.source_name} · {e.status}</p></div></div>)}{!data.timeline.length&&<Empty icon={Clock3} title="No events to show" body="Events will appear here when records are added."/>}</section></>}

    {page==='settings'&&<><div className="page-title-row"><div><div className="eyebrow">WORKSPACE CONFIGURATION</div><h1>Settings</h1><p className="subtitle">Local application preferences and optional provider configuration.</p></div></div><div className="settings-layout"><section className="panel settings-panel"><div className="panel-heading"><div><h2>Local workspace</h2><p>Settings are stored in your local SQLite database.</p></div><ShieldCheck size={20}/></div><label className="setting-row"><div><strong>Refresh interval (minutes)</strong><p>Automatic refresh is a future feature; RSS collection is manual in v0.2.</p></div><input type="number" min="5" max="1440" value={data.settings.refreshMinutes||'30'} onChange={e=>updateSetting('refreshMinutes',Math.max(5,Math.min(1440,Number(e.target.value)||30)))}/></label><label className="setting-row"><div><strong>Theme</strong><p>Visual theme for future theme variants.</p></div><select value={data.settings.theme||'dark'} onChange={e=>updateSetting('theme',e.target.value)}><option value="dark">Dark (default)</option><option value="system">System preference (reserved)</option></select></label></section><section className="panel settings-panel"><div className="panel-heading"><div><h2>Optional local AI</h2><p>Configuration only; no model calls are made in this release.</p></div><Activity size={20}/></div><label className="setting-row"><div><strong>Provider</strong><p>Choose a local inference service for a future release.</p></div><select value={data.settings.aiProvider||'none'} onChange={e=>updateSetting('aiProvider',e.target.value)}><option value="none">Disabled</option><option value="ollama">Ollama</option><option value="lmstudio">LM Studio</option></select></label><label>Local endpoint<input className="wide-input" placeholder="http://localhost:11434" value={data.settings.aiEndpoint||''} onChange={e=>updateSetting('aiEndpoint',e.target.value)}/></label><label>Model name<input className="wide-input" placeholder="Optional model identifier" value={data.settings.aiModel||''} onChange={e=>updateSetting('aiModel',e.target.value)}/></label><div className="info-banner"><ShieldCheck size={16}/><span>No AI requests are sent in v0.1. Keep provider endpoints local unless you intentionally change this in a future release.</span></div></section><section className="panel settings-panel"><div className="panel-heading"><div><h2>About</h2><p>JASS Signal Intelligence Studio</p></div></div><div className="about-grid"><span>Version</span><strong>{version}</strong><span>Storage</span><strong>SQLite · Local application data</strong><span>Collection</span><strong>Manual RSS refresh</strong><span>AI</span><strong>Optional · Configuration only</strong></div></section></div></>}

   </div>

   <footer className="app-footer"><span><span className="status-dot"/> LOCAL-FIRST WORKSPACE</span><span>Public information only · Verify original sources · Demo records are not live intelligence</span></footer>

  </main>

  {notice&&<div className="toast"><Check size={17}/>{notice}</div>}

  {modal?.kind==='event'&&<Modal title={modal.record?'Edit event':'Add event'} onClose={()=>setModal(null)}><EventForm initial={modal.record?{...modal.record}:null} onCancel={()=>setModal(null)} onSave={saveEvent}/></Modal>}

  {modal?.kind==='details'&&<Modal title="Event details" onClose={()=>setModal(null)}><div className="event-details"><Badge tone={tone(modal.record.severity)}>{modal.record.severity}</Badge><h2>{modal.record.title}</h2><p>{modal.record.summary||'No summary supplied.'}</p><div className="detail-row"><span>Region</span><strong>{modal.record.region}</strong></div><div className="detail-row"><span>Source</span><strong>{modal.record.source_name}</strong></div><div className="detail-row"><span>Published</span><strong>{dateLabel(modal.record.published_at)}</strong></div><div className="detail-row"><span>Status</span><strong>{modal.record.status}</strong></div>{modal.record.source_url&&<a className="btn secondary" href={modal.record.source_url} onClick={e=>{e.preventDefault();window.open(modal.record.source_url,'_blank');}}>Open original source <ExternalLink size={15}/></a>}</div></Modal>}

  {modal?.kind==='source'&&<Modal title={modal.record?'Edit source':'Add source definition'} onClose={()=>setModal(null)}><SourceForm initial={modal.record||blankSource} onCancel={()=>setModal(null)} onSave={saveSource}/></Modal>}

  {modal?.kind==='topic'&&<Modal title={modal.record?'Edit topic':'Add watchlist topic'} onClose={()=>setModal(null)}><TopicForm initial={modal.record||blankTopic} onCancel={()=>setModal(null)} onSave={saveTopic}/></Modal>}

 </div>;

}

function Stat({icon:Icon,label,value,note}) {return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={17}/></span></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>}

function tone(sev){return ({Low:'green',Moderate:'blue',High:'amber',Critical:'red'})[sev]||'neutral';}

function EventTable({events,onEdit,onDelete,onOpen}) {if(!events.length)return <Empty icon={Activity} title="No matching events" body="Add a record or change your search and filters."/>;return <div className="table-wrap"><table><thead><tr><th>Event</th><th>Severity</th><th>Region</th><th>Source</th><th>Timestamp</th><th>Actions</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{e.status==='Demo'&&<Badge tone="amber">DEMO</Badge>}<button className="event-title" onClick={()=>onOpen(e)}>{e.title}</button><small>{e.summary||'No summary supplied'}</small></td><td><Badge tone={tone(e.severity)}><span className={'severity-dot '+e.severity.toLowerCase()}/>{e.severity}</Badge></td><td>{e.region}</td><td>{e.source_name}</td><td className="date-cell">{dateLabel(e.published_at||e.created_at)}</td><td><div className="row-actions">{e.source_url&&<button className="icon-btn article-link" title="Open original article" aria-label="Open original article" onClick={()=>window.open(e.source_url,'_blank')}><ExternalLink size={15}/></button>}<button className="icon-btn" title="Edit" onClick={()=>onEdit(e)}><SlidersHorizontal size={15}/></button><button className="icon-btn danger" title="Delete" onClick={()=>onDelete(e.id)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>}

function SourceForm({initial,onCancel,onSave}) {const [f,setF]=useState({...initial});const [busy,setBusy]=useState(false);const c=(k,v)=>setF(x=>({...x,[k]:v}));return <form className="form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await onSave(f);}finally{setBusy(false);}}}><label>Name *<input required value={f.name||''} onChange={e=>c('name',e.target.value)}/></label><label>URL<input type="url" placeholder="https://example.org/feed.xml" value={f.url||''} onChange={e=>c('url',e.target.value)}/></label><label>Type<select value={f.type||'RSS'} onChange={e=>c('type',e.target.value)}><option>RSS</option><option>Manual</option></select></label><label>Region<select value={f.region||'Global'} onChange={e=>c('region',e.target.value)}><option>India</option><option>Canada</option><option>India–Canada</option><option>Global</option><option>Asia-Pacific</option><option>North America</option></select></label><label>Notes<textarea rows="3" value={f.notes||''} onChange={e=>c('notes',e.target.value)}/></label><label className="check-label"><input type="checkbox" checked={!!f.enabled} onChange={e=>c('enabled',e.target.checked)}/> Enabled for manual RSS refresh</label><footer className="form-actions"><button type="button" className="btn secondary" onClick={onCancel}>Cancel</button><button className="btn primary" disabled={busy}>{busy?'Saving…':'Save source'}</button></footer></form>}

function TopicForm({initial,onCancel,onSave}) {const [f,setF]=useState({...initial});const [busy,setBusy]=useState(false);const c=(k,v)=>setF(x=>({...x,[k]:v}));return <form className="form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await onSave(f);}finally{setBusy(false);}}}><label>Name *<input required value={f.name||''} onChange={e=>c('name',e.target.value)}/></label><label>Description<textarea rows="3" value={f.description||''} onChange={e=>c('description',e.target.value)}/></label><footer className="form-actions"><button type="button" className="btn secondary" onClick={onCancel}>Cancel</button><button className="btn primary" disabled={busy}>{busy?'Saving…':'Save topic'}</button></footer></form>}

export default App;
