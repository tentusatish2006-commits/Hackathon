import { useMemo, useRef, useState, useEffect } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { Activity, AlertTriangle, ArrowDownToLine, ArrowRight, BarChart3, Bell, Check, ChevronDown, CircleHelp, Cpu, Database, FileChartColumn, FileUp, Gauge, Layers3, Lightbulb, Menu, Play, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Table2, Upload, X } from 'lucide-react';
import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, Bar, BarChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { Batch, DEMO, Field, cleanRows, dedupe, machineStats, median, parseCsv, riskStats } from './lib/analysis';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/dataset', label: 'Dataset', icon: Database },
  { href: '/cleaning', label: 'Data Cleaning', icon: Layers3 },
  { href: '/machines', label: 'Machine Health', icon: Cpu },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/insights', label: 'AI Insights', icon: Lightbulb },
  { href: '/recommendations', label: 'Recommendations', icon: Sparkles },
  { href: '/live', label: 'Live simulation', icon: Activity },
  { href: '/methodology', label: 'Methodology', icon: CircleHelp },
];
const palette = ['#48d3df', '#70a9ff', '#7cdbad', '#efa65a', '#e17f7b'];
const num = (n: number, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : '0.0';
const csvValue = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;

function App() {
  const [location, setLocation] = useLocation();
  const [rows, setRows] = useState<Batch[]>([]);
  const [fileName, setFileName] = useState('');
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [loadingFile, setLoadingFile] = useState(false);
  const [cleaned, setCleaned] = useState<Batch[] | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const allMachines = useMemo(() => [...new Set(rows.map((r) => r.MachineID))].sort(), [rows]);
  const activeRows = cleaned ?? rows;
  const risks = useMemo(() => riskStats(cleanRows(activeRows)), [activeRows]);
  const stats = useMemo(() => machineStats(cleanRows(activeRows)), [activeRows]);
  const distinct = allMachines.length;
  const defectTotal = rows.reduce((s, r) => s + (r.DefectCount ?? 0), 0);
  const missingCount = rows.reduce((s, r) => s + (['Temperature', 'Vibration', 'DefectCount'] as Field[]).filter((k) => r[k] === null).length, 0);
  const duplicateCount = rows.length - dedupe(rows).length;
  const qualityScore = rows.length ? Math.max(0, Math.round((1 - (missingCount + duplicateCount) / (rows.length * 3)) * 100)) : 0;
  const ingest = (incoming: Batch[], name: string) => {
    setRows(incoming); setCleaned(null); setFileName(name); setUploadErrors([]);
    setLocation('/dashboard');
  };
  const loadDemo = () => ingest(DEMO.map((r) => ({ ...r })), 'smartdefect_demo.csv');
  const loadFile = (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) { setUploadErrors(['Choose a .csv file to continue.']); return; }
    setLoadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      setLoadingFile(false);
      const result = parseCsv(String(reader.result ?? ''));
      if (result.errors.length || !result.rows.length) { setUploadErrors(result.errors.length ? result.errors : ['The CSV contains no valid batch rows.']); return; }
      ingest(result.rows, file.name);
    };
    reader.onerror = () => { setLoadingFile(false); setUploadErrors(['The selected file could not be read. Please try again.']); };
    reader.readAsText(file);
  };
  const doClean = () => setCleaned(cleanRows(rows));
  const download = (name: string, content: string, type = 'text/csv') => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportClean = () => {
    const data = cleaned ?? cleanRows(rows);
    const head = ['BatchID', 'MachineID', 'Temperature', 'Vibration', 'DefectCount', 'TemperatureCategory', 'Defective'];
    download('smartdefect-cleaned.csv', [head.join(','), ...data.map((r) => head.map((h) => csvValue(r[h as keyof Batch])).join(','))].join('\n'));
  };
  const report = () => {
    const cleanedRows = cleanRows(rows);
    const rs = riskStats(cleanedRows);
    const lines = ['SMARTDEFECT AI — LOCAL ANALYSIS REPORT', `Source: ${fileName || 'Loaded data'}`, `Generated: ${new Date().toLocaleString()}`, '', 'SUMMARY', `Batches: ${rows.length}`, `Machines: ${distinct}`, `Known defects: ${defectTotal}`, `Data quality score: ${qualityScore}%`, '', 'QUALITY', `Missing numeric cells: ${missingCount}`, `Exact duplicate records: ${duplicateCount}`, '', 'CLEANING', `Imputed values: ${missingCount}`, `Removed exact duplicates: ${duplicateCount}`, 'Imputation: median of observed values per numeric field', '', 'MACHINE STATS'];
    rs.forEach((m) => lines.push(`${m.MachineID}: ${m.batches} batches; mean temperature ${num(m.avgTemperature)}; mean vibration ${num(m.avgVibration, 3)}; defects ${m.defects}; defect batch rate ${num(m.defectRate)}%; prototype risk ${m.score}/100 (${m.status})`));
    lines.push('', 'RECOMMENDATIONS', ...recommendations(rs).map((s) => `- ${s}`), '', 'LIMITATION: Risk score is a transparent prototype heuristic, not validated machine learning. Local browser analysis only.');
    download('smartdefect-analysis-report.txt', lines.join('\n'), 'text/plain');
  };
  const title = nav.find((n) => n.href === location)?.label ?? 'Dashboard';
  const shared = { rows, activeRows, cleaned, setCleaned, fileName, fileRef, loadDemo, loadFile, uploadErrors, setUploadErrors, doClean, exportClean, report, download, stats, risks, missingCount, duplicateCount, qualityScore, defectTotal, distinct };
  const showWelcome = rows.length === 0;
  return <div className="app-shell">
    <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { loadFile(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} data-testid="input-upload-csv" />
    <aside className={`sidebar fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col px-4 py-5 transition-transform md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-8 flex items-center justify-between px-2">
        <div className="flex items-center gap-3"><div className="brandmark"><Activity size={19}/></div><div><div className="font-display text-[15px] font-extrabold tracking-tight text-slate-100">smart<span className="text-cyan-300">defect</span></div><div className="mono text-[9px] uppercase tracking-[.2em] text-slate-500">Quality intelligence</div></div></div>
        <button className="icon-button md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation"><X size={17}/></button>
      </div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="flex flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => <Link href={href} key={href} onClick={() => setMobileOpen(false)} className={`nav-item ${location === href ? 'nav-active' : ''}`} data-testid={`link-nav-${href.slice(1)}`}><Icon size={17}/><span>{label}</span>{href === '/live' && <i className="nav-live-dot"/>}</Link>)}
      </nav>
      <div className="mt-auto">
        <div className="local-note"><span className="local-dot"/><span>ANALYSIS ENGINE ONLINE</span><span className="ml-auto text-slate-600">LOCAL</span></div>
        <div className="user-chip"><div className="user-avatar">SQ</div><div className="min-w-0"><div className="truncate text-xs font-semibold text-slate-200">Quality team</div><div className="text-[10px] text-slate-500">Manufacturing ops</div></div><Settings2 size={15} className="ml-auto text-slate-500"/></div>
      </div>
    </aside>
    {mobileOpen && <button className="fixed inset-0 z-30 bg-black/60 md:hidden" aria-label="Dismiss navigation" onClick={() => setMobileOpen(false)} data-testid="button-dismiss-navigation"/>}
    <main className="md:pl-[250px]">
      <header className="topbar sticky top-0 z-20 flex h-[68px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="icon-button md:hidden" aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={18}/></button><div><div className="text-sm font-bold text-slate-100">{title}</div><div className="hidden text-[10px] text-slate-500 sm:block">Manufacturing quality workspace <span className="mx-1 text-slate-700">/</span> {title}</div></div></div>
        <div className="flex items-center gap-3"><div className="dataset-indicator hidden sm:flex"><span className={`status-led ${rows.length ? 'led-on' : ''}`}/>{rows.length ? `${rows.length} batches loaded` : 'No dataset loaded'}</div><button className="icon-button" title="Notifications" onClick={() => setLocation('/insights')} data-testid="button-notifications"><Bell size={17}/>{risks.filter((r) => r.score >= 70).length > 0 && <i className="notification-dot"/>}</button><button className="button button-small button-outline hidden sm:flex" onClick={() => fileRef.current?.click()} data-testid="button-header-upload"><Upload size={14}/>Import CSV</button></div>
      </header>
      <div className="mx-auto max-w-[1520px] px-4 pb-12 pt-7 sm:px-8">
        {loadingFile && <div className="mb-5 flex items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[.04] p-4" role="status" data-testid="status-upload-loading"><div className="skeleton-line"/><span className="text-xs text-cyan-100/80">Reading and validating the CSV locally…</span></div>}
        {uploadErrors.length > 0 && <div className="mb-5 flex gap-3 rounded-xl border border-rose-400/25 bg-rose-400/[.07] p-4 text-sm text-rose-100" role="alert" data-testid="status-upload-error"><AlertTriangle className="mt-0.5 shrink-0 text-rose-300" size={17}/><div className="min-w-0 flex-1"><div className="mb-1 font-bold">Dataset not imported</div>{uploadErrors.map((e, i) => <div key={i} className="text-xs leading-5 text-rose-100/75">{e}</div>)}</div><button aria-label="Dismiss import errors" onClick={() => setUploadErrors([])}><X size={16}/></button></div>}
        {showWelcome && (location === '/' || location === '/dashboard') ? <Welcome openFile={() => fileRef.current?.click()} loadDemo={loadDemo} loadFile={loadFile} errors={uploadErrors}/> : <Switch>
          <Route path="/"><Overview {...shared}/></Route><Route path="/dashboard"><Overview {...shared}/></Route>
          <Route path="/dataset"><Dataset {...shared}/></Route><Route path="/cleaning"><Cleaning {...shared}/></Route>
          <Route path="/machines"><Machines {...shared}/></Route><Route path="/analytics"><Analytics {...shared}/></Route>
          <Route path="/insights"><Insights {...shared}/></Route><Route path="/recommendations"><RecommendationsPage {...shared}/></Route>
          <Route path="/live"><Live {...shared}/></Route><Route path="/methodology"><Methodology/></Route>
          <Route><Overview {...shared}/></Route>
        </Switch>}
      </div>
    </main>
  </div>;
}

function Welcome({ openFile, loadDemo, loadFile }: { openFile: () => void; loadDemo: () => void; loadFile: (f?: File) => void; errors: string[] }) {
  const [drag, setDrag] = useState(false);
  return <section className="welcome grid-texture animate-in" onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); loadFile(e.dataTransfer.files[0]); }} data-testid="section-welcome">
      <div className="welcome-left"><div className="eyebrow"><span className="eyebrow-pulse"/> QUALITY SIGNAL, MADE CLEAR</div><h1>See the signal<br/>in every <span>batch.</span></h1><p className="welcome-copy">A focused workspace for understanding process quality. Bring your batch readings; get a transparent view of data health, defect patterns, and machine-level risk.</p>
        <div className="flex flex-wrap gap-3"><button onClick={loadDemo} className="button button-primary" data-testid="button-load-demo"><Play size={15} fill="currentColor"/>Load Demo Data<ArrowRight size={15}/></button><button onClick={openFile} className="button button-outline" data-testid="button-upload-dataset"><Upload size={15}/>Upload Dataset</button></div>
        <div className="welcome-foot"><ShieldCheck size={14}/> Processed locally in this browser <span className="mx-1 text-slate-700">·</span> No server or external AI</div>
      </div>
      <div className={`drop-visual ${drag ? 'drop-hover' : ''}`}><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="orbit-core"><div className="core-grid"/><Activity size={30}/></div><div className="float-tag tag-a"><span className="mini-square cyan-square"/><span><b>Batch readings</b><small>Temperature · vibration</small></span><span className="tag-signal"/></div><div className="float-tag tag-b"><span className="mini-square green-square"><Check size={13}/></span><span><b>Rule pipeline</b><small>Classification ready</small></span></div><div className="visual-label"><span className="mono">FIG 01</span><span>PROCESS SIGNAL, MADE LEGIBLE</span></div><div className="drop-hint" onClick={openFile}><FileUp size={15}/> or drop a CSV anywhere here</div></div>
      <div className="welcome-bottom"><div><strong>01</strong><span>Upload structured batch data</span></div><div><strong>02</strong><span>Review quality & clean locally</span></div><div><strong>03</strong><span>Find practical next steps</span></div><div className="required-note">Required: BatchID · MachineID · Temperature · Vibration · DefectCount</div></div>
    </section>;
}

type Shared = {
  rows: Batch[]; activeRows: Batch[]; cleaned: Batch[] | null; setCleaned: (r: Batch[] | null) => void; fileName: string;
  fileRef: React.RefObject<HTMLInputElement | null>; loadDemo: () => void; loadFile: (f?: File) => void; uploadErrors: string[];
  setUploadErrors: (s: string[]) => void; doClean: () => void; exportClean: () => void; report: () => void;
  download: (name: string, content: string, type?: string) => void;
  stats: ReturnType<typeof machineStats>; risks: ReturnType<typeof riskStats>;
  missingCount: number; duplicateCount: number; qualityScore: number; defectTotal: number; distinct: number;
};
function PageHeading({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="eyebrow mb-2">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{copy}</p></div>{action}</div>;
}
function Metric({ label, value, unit, detail, icon: Icon, tone = 'cyan', testid }: { label: string; value: string | number; unit?: string; detail: string; icon: typeof Database; tone?: string; testid: string }) {
  return <div className="glass metric-card" data-testid={testid}><div className="flex items-start justify-between"><div><div className="metric-label">{label}</div><div className="metric-number">{value}<span>{unit}</span></div></div><div className={`metric-icon tone-${tone}`}><Icon size={17}/></div></div><div className="metric-detail"><span className="detail-mark"/>{detail}</div></div>;
}
function Panel({ title, subtitle, children, className = '', action }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return <section className={`glass panel ${className}`}><div className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}
function Overview(p: Shared) {
  if (!p.rows.length) return null;
  const tdata = p.activeRows.map((r) => ({ batch: r.BatchID, temperature: r.Temperature, defects: r.DefectCount, vibration: r.Vibration }));
  const categories = ['LOW', 'NORMAL', 'HIGH'].map((name) => ({ name, value: p.activeRows.filter((r) => r.TemperatureCategory === name || (!r.TemperatureCategory && (name === ((r.Temperature ?? 0) < 75 ? 'LOW' : (r.Temperature ?? 0) <= 85 ? 'NORMAL' : 'HIGH')))).length }));
  const defectCounts = [
    { name: 'Defective', value: p.activeRows.filter((r) => (r.DefectCount ?? 0) > 0).length },
    { name: 'Non-defective', value: p.activeRows.filter((r) => (r.DefectCount ?? 0) <= 0).length },
  ];
  const highTemps = cleanRows(p.rows).filter((r) => r.TemperatureCategory === 'HIGH');
  const alerts = [
    ...(highTemps.length ? [{ title: `${highTemps.length} high-temperature batch${highTemps.length === 1 ? '' : 'es'}`, detail: `Above 85° across ${[...new Set(highTemps.map((r) => r.MachineID))].join(', ')}. Monitor alongside process context.`, tone: 'amber' }] : []),
    ...(p.duplicateCount ? [{ title: `${p.duplicateCount} exact duplicate record${p.duplicateCount === 1 ? '' : 's'}`, detail: 'Remove duplicate rows in the cleaning pipeline before exporting.', tone: 'amber' }] : []),
    ...(p.missingCount ? [{ title: `${p.missingCount} missing numeric value${p.missingCount === 1 ? '' : 's'}`, detail: 'Median imputation is available; review field-level counts on Data cleaning.', tone: 'cyan' }] : []),
    ...(p.cleaned ? [{ title: 'Cleaning complete', detail: `${p.activeRows.length} unique records now include temperature and defect classifications.`, tone: 'green' }] : []),
  ];
  return <div className="animate-in">
    <PageHeading eyebrow="SMARTDEFECT AI / FACTORY OVERVIEW" title="Manufacturing Intelligence Center" copy={`Turn machine sensor data into actionable quality intelligence. Current view: ${p.rows.length} batch records${p.fileName ? ` from ${p.fileName}` : ''}.`} action={<div className="flex gap-2"><button onClick={p.report} className="button button-outline" data-testid="button-export-report"><FileChartColumn size={15}/>Export report</button><button onClick={() => p.fileRef.current?.click()} className="button button-primary" data-testid="button-add-dataset"><Upload size={15}/>Add data</button></div>}/>
    <div className="metric-grid"><Metric label="BATCHES" value={p.rows.length} detail={`${p.cleaned ? p.activeRows.length : p.rows.length} records in view`} icon={Table2} testid="metric-total-batches"/><Metric label="MACHINES" value={p.distinct} detail="Distinct machine identifiers" icon={Cpu} tone="blue" testid="metric-machines"/><Metric label="KNOWN DEFECTS" value={num(p.defectTotal, 0)} detail="Sum of available defect counts" icon={AlertTriangle} tone="amber" testid="metric-defects"/><Metric label="DATA QUALITY" value={p.qualityScore} unit="%" detail={`${p.missingCount} missing · ${p.duplicateCount} exact duplicates`} icon={ShieldCheck} tone={p.qualityScore > 80 ? 'green' : 'amber'} testid="metric-quality"/></div>
    <div className="content-grid mt-5">
      <Panel title="Temperature & observed defects" subtitle="Each point represents one batch. This is descriptive, not causal." className="col-span-2"><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 18, bottom: 4, left: -12 }}><CartesianGrid stroke="#293542" strokeDasharray="3 5"/><XAxis type="number" dataKey="temperature" name="Temperature" tick={{ fill: '#7f91a2', fontSize: 10 }} label={{ value: 'Temperature', position: 'insideBottom', offset: -2, fill: '#7f91a2', fontSize: 10 }}/><YAxis type="number" dataKey="defects" name="Defects" tick={{ fill: '#7f91a2', fontSize: 10 }} allowDecimals={false}/><Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tipStyle} formatter={(v: number, n: string) => [v, n]} labelFormatter={(_, payload) => payload?.[0]?.payload?.batch}/><Scatter data={tdata} fill="#4dd3df" r={5}/></ScatterChart></ResponsiveContainer></div><div className="chart-note"><span className="legend-dot"/><span>Batch reading</span><span className="ml-auto">n = {p.activeRows.length}</span></div></Panel>
      <Panel title="Temperature bands" subtitle="Thresholds: &lt;75 · 75–85 · &gt;85"><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="value" nameKey="name" innerRadius="65%" outerRadius="88%" paddingAngle={4} stroke="none">{categories.map((_, i) => <Cell key={i} fill={palette[i]}/>)}</Pie><Tooltip contentStyle={tipStyle}/></PieChart></ResponsiveContainer><div className="donut-center"><strong>{p.activeRows.length}</strong><span>BATCHES</span></div></div><div className="legend-list">{categories.map((c, i) => <div key={c.name}><span><i style={{ background: palette[i] }}/>{c.name}</span><strong>{c.value}</strong></div>)}</div></Panel>
       <Panel title="Defect classification" subtitle="YES when DefectCount is above zero"><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={defectCounts} dataKey="value" nameKey="name" innerRadius="65%" outerRadius="88%" paddingAngle={4} stroke="none"><Cell fill="#e17f7b"/><Cell fill="#7cdbad"/></Pie><Tooltip contentStyle={tipStyle}/></PieChart></ResponsiveContainer><div className="donut-center"><strong>{defectCounts[0].value}</strong><span>DEFECTIVE</span></div></div><div className="legend-list">{defectCounts.map((c, i) => <div key={c.name}><span><i style={{ background: i === 0 ? '#e17f7b' : '#7cdbad' }}/>{c.name}</span><strong>{c.value}</strong></div>)}</div></Panel>
      <Panel title="Machine risk snapshot" subtitle="Prototype weighted score · not validated ML" action={<Link href="/machines" className="text-[11px] font-bold text-cyan-300 hover:text-cyan-200" data-testid="link-view-machines">All machines <ArrowRight size={12} className="inline"/></Link>} className="col-span-3"><RiskTable risks={p.risks}/></Panel>
      <Panel title="Current alerts" subtitle="Generated from this dataset; not connected to factory equipment" className="col-span-2">{alerts.length ? <div className="alert-list">{alerts.map((a) => <div className={`alert-row alert-${a.tone}`} key={a.title}><span className="alert-mark">{a.tone === 'green' ? <Check size={14}/> : <AlertTriangle size={14}/>}</span><div><b>{a.title}</b><span>{a.detail}</span></div></div>)}</div> : <div className="all-clear"><ShieldCheck size={16}/>No current data-quality or threshold alerts in this view.</div>}</Panel>
      <Panel title="Data readiness" subtitle="What cleaning will resolve" className="col-span-1"><div className="readiness-score"><span>{p.qualityScore}</span><small>/ 100</small><div className="score-track"><i style={{ width: `${p.qualityScore}%` }}/></div></div><div className="readiness-row"><span>Missing numeric values</span><b>{p.missingCount}</b></div><div className="readiness-row"><span>Exact duplicates</span><b>{p.duplicateCount}</b></div><button className="button button-outline button-wide mt-4" onClick={() => p.setCleaned(cleanRows(p.rows))} data-testid="button-clean-from-dashboard"><Layers3 size={14}/>Run cleaning pipeline</button></Panel>
    </div>
  </div>;
}
const tipStyle = { background: '#18232e', border: '1px solid #344656', borderRadius: '9px', color: '#dce6ef', fontSize: '11px' };
function RiskTable({ risks }: { risks: ReturnType<typeof riskStats> }) {
  if (!risks.length) return <EmptyInline text="No machine readings to compare yet."/>;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Machine</th><th>Batches</th><th>Mean temp.</th><th>Mean vibration</th><th>Defects</th><th>Defect batch rate</th><th>Prototype risk</th><th>Status</th></tr></thead><tbody>{risks.map((r) => <tr key={r.MachineID}><td><span className="machine-token"><Cpu size={13}/>{r.MachineID}</span></td><td>{r.batches}</td><td>{num(r.avgTemperature)}°</td><td>{num(r.avgVibration, 3)}</td><td>{r.defects}</td><td>{num(r.defectRate)}%</td><td><div className="risk-cell"><div className="risk-track"><i className={statusClass(r.status)} style={{ width: `${r.score}%` }}/></div><b>{r.score}</b></div></td><td><StatusPill status={r.status}/></td></tr>)}</tbody></table></div>;
}
function statusClass(status: string) { return status.toLowerCase(); }
function StatusPill({ status }: { status: string }) { return <span className={`status-pill status-${status.toLowerCase()}`}><i/>{status}</span>; }
function EmptyInline({ text }: { text: string }) { return <div className="empty-inline"><Database size={16}/>{text}</div>; }

function Dataset(p: Shared) {
  const [query, setQuery] = useState(''); const [machine, setMachine] = useState('all'); const [missingOnly, setMissingOnly] = useState(false);
  const [category, setCategory] = useState('all'); const [defective, setDefective] = useState('all'); const [riskLevel, setRiskLevel] = useState('all');
  const [drag, setDrag] = useState(false);
  const temperatureMedian = median(p.rows.map((r) => r.Temperature).filter((v): v is number => v !== null));
  const vibrationMedian = median(p.rows.map((r) => r.Vibration).filter((v): v is number => v !== null));
  const defectMedian = median(p.rows.map((r) => r.DefectCount).filter((v): v is number => v !== null));
  const enriched = p.rows.map((r) => ({
    ...r,
    Temperature: r.Temperature ?? temperatureMedian,
    Vibration: r.Vibration ?? vibrationMedian,
    DefectCount: r.DefectCount ?? defectMedian,
    TemperatureCategory: (r.Temperature ?? temperatureMedian) < 75 ? 'LOW' as const : (r.Temperature ?? temperatureMedian) <= 85 ? 'NORMAL' as const : 'HIGH' as const,
    Defective: (r.DefectCount ?? defectMedian) > 0 ? 'YES' as const : 'NO' as const,
  }));
  const riskByMachine = new Map(riskStats(cleanRows(p.rows)).map((r) => [r.MachineID, r.status]));
  const filtered = p.rows.filter((r, index) => {
    const clean = enriched[index];
    const band = clean?.TemperatureCategory ?? 'NORMAL'; const isDefective = clean?.Defective ?? 'NO';
    return (!query || `${r.BatchID} ${r.MachineID}`.toLowerCase().includes(query.toLowerCase()))
      && (machine === 'all' || r.MachineID === machine)
      && (!missingOnly || r.Temperature === null || r.Vibration === null || r.DefectCount === null)
      && (category === 'all' || band === category) && (defective === 'all' || isDefective === defective)
      && (riskLevel === 'all' || riskByMachine.get(r.MachineID)?.toLowerCase() === riskLevel);
  });
  const drop = (e: React.DragEvent) => { e.preventDefault(); setDrag(false); p.loadFile(e.dataTransfer.files[0]); };
  return <div className="animate-in"><PageHeading eyebrow="DATA / INGESTION & VALIDATION" title="Your batch records." copy="Inspect, filter and validate the rows powering this analysis. A failed upload never replaces your current dataset." action={<button className="button button-primary" onClick={() => p.fileRef.current?.click()} data-testid="button-dataset-upload"><Upload size={15}/>Upload CSV</button>}/>
    <div className={`upload-strip ${drag ? 'upload-strip-active' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={drop}><div className="upload-symbol"><FileUp size={19}/></div><div className="min-w-0 flex-1"><strong>{p.fileName || 'Drop a CSV here or choose a file'}</strong><span>Required headers: BatchID, MachineID, Temperature, Vibration, DefectCount</span></div><button className="button button-outline button-small" onClick={() => p.fileRef.current?.click()} data-testid="button-select-csv">Choose file</button></div>
    <div className="metric-grid metric-grid-compact mt-4"><MiniStat title="Rows accepted" value={p.rows.length}/><MiniStat title="Missing values" value={p.missingCount}/><MiniStat title="Exact duplicates" value={p.duplicateCount}/><MiniStat title="Validation" value="Ready" green/></div>
    <Panel title="Batch register" subtitle={`${filtered.length} of ${p.rows.length} records`} className="mt-5" action={<button className="button button-outline button-small" onClick={() => p.download('smartdefect-raw.csv', [ ['BatchID','MachineID','Temperature','Vibration','DefectCount'].join(','), ...p.rows.map((r) => [r.BatchID,r.MachineID,r.Temperature,r.Vibration,r.DefectCount].map(csvValue).join(','))].join('\n'))} data-testid="button-export-raw"><ArrowDownToLine size={14}/>Export source</button>}>
      <div className="filter-row"><label className="search-box"><Search size={15}/><input aria-label="Search batches" placeholder="Search batch or machine…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="input-search-batches"/></label><label className="select-box"><SlidersHorizontal size={14}/><select aria-label="Filter by machine" value={machine} onChange={(e) => setMachine(e.target.value)} data-testid="select-machine-filter"><option value="all">All machines</option>{[...new Set(p.rows.map((r) => r.MachineID))].sort().map((id) => <option key={id}>{id}</option>)}</select><ChevronDown size={13}/></label>
      <label className="select-box"><select aria-label="Filter by temperature category" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="select-temperature-category"><option value="all">All bands</option><option value="LOW">LOW</option><option value="NORMAL">NORMAL</option><option value="HIGH">HIGH</option></select><ChevronDown size={13}/></label>
      <label className="select-box"><select aria-label="Filter by defective status" value={defective} onChange={(e) => setDefective(e.target.value)} data-testid="select-defective-status"><option value="all">All defect status</option><option value="YES">Defective</option><option value="NO">Non-defective</option></select><ChevronDown size={13}/></label>
      <label className="select-box"><select aria-label="Filter by machine risk" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)} data-testid="select-risk-level"><option value="all">All risk levels</option><option value="healthy">Healthy</option><option value="warning">Warning</option><option value="critical">Critical</option></select><ChevronDown size={13}/></label>
      <button className={`filter-chip ${missingOnly ? 'filter-chip-active' : ''}`} onClick={() => setMissingOnly(!missingOnly)} data-testid="button-filter-missing"><AlertTriangle size={13}/>Missing only</button>{(query || machine !== 'all' || missingOnly || category !== 'all' || defective !== 'all' || riskLevel !== 'all') && <button className="text-xs text-slate-500 hover:text-slate-200" onClick={() => { setQuery(''); setMachine('all'); setMissingOnly(false); setCategory('all'); setDefective('all'); setRiskLevel('all'); }} data-testid="button-clear-filters">Clear</button>}</div>
      {p.rows.length ? filtered.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Batch ID</th><th>Machine</th><th>Temperature</th><th>Vibration</th><th>Defect count</th><th>Quality check</th></tr></thead><tbody>{filtered.map((r, i) => <tr key={`${r.BatchID}-${i}`} data-testid={`row-batch-${i}`}><td className="mono text-cyan-100">{r.BatchID}</td><td><span className="machine-token"><Cpu size={13}/>{r.MachineID}</span></td><td>{cell(r.Temperature, '°')}</td><td>{cell(r.Vibration, '')}</td><td>{cell(r.DefectCount, '')}</td><td>{r.Temperature === null || r.Vibration === null || r.DefectCount === null ? <span className="data-flag flag-missing">Missing value</span> : <span className="data-flag flag-valid"><Check size={11}/>Valid</span>}</td></tr>)}</tbody></table></div> : <EmptyInline text="No rows match these filters. Adjust the search or machine selection."/> : <EmptyInline text="Upload a CSV or load demo data to see batch records."/>}
    </Panel>
    <div className="notice-line"><ShieldCheck size={15}/> Files are parsed in your browser. Numeric cells may be blank; nonnumeric values and malformed rows are rejected with a row-level explanation.</div>
  </div>;
}
function cell(v: number | null, suffix: string) { return v === null ? <span className="missing-cell">— missing</span> : <span className="mono text-slate-300">{num(v, suffix === '°' ? 1 : 3)}{suffix}</span>; }
function MiniStat({ title, value, green }: { title: string; value: string | number; green?: boolean }) { return <div className="glass mini-stat"><span>{title}</span><b className={green ? 'text-emerald-300' : ''}>{value}</b></div>; }

function Cleaning(p: Shared) {
  const raw = p.rows; const result = cleanRows(raw); const beforeMissing = p.missingCount; const removed = p.duplicateCount;
  const cat = ['LOW', 'NORMAL', 'HIGH'].map((v) => ({ label: v, n: result.filter((r) => r.TemperatureCategory === v).length }));
  return <div className="animate-in"><PageHeading eyebrow="DATA / QUALITY PREPARATION" title="Make the input trustworthy." copy="A deterministic, repeatable pipeline. Review the changes before exporting; raw data stays untouched." action={<button className="button button-primary" onClick={() => { p.setCleaned(result); }} disabled={!raw.length} data-testid="button-run-cleaning"><RefreshCw size={15}/>Run cleaning pipeline</button>}/>
    {!raw.length ? <EmptyBlock title="Nothing to clean yet" text="Load a CSV first. The pipeline will report missing values and exact duplicates."/> : <>
      <div className="clean-summary-grid"><div className="glass clean-hero"><div className="eyebrow">PIPELINE STATUS</div><div className="clean-status"><div className={`clean-check ${p.cleaned ? 'complete' : ''}`}><Check size={18}/></div><div><strong>{p.cleaned ? 'Cleaning applied to current dataset' : 'Ready for review'}</strong><span>{p.cleaned ? `${result.length} rows · repeatable output` : 'No source records have been modified'}</span></div></div><div className="pipeline-steps"><span className="step-done">01 <b>Profile</b></span><i/><span className="step-done">02 <b>Impute</b></span><i/><span className="step-done">03 <b>Deduplicate</b></span><i/><span className="step-done">04 <b>Classify</b></span></div></div><div className="glass score-card"><span>Rows after cleaning</span><strong>{result.length}</strong><small>from {raw.length} source records</small><button className="button button-outline button-small" onClick={p.exportClean} data-testid="button-export-cleaned"><ArrowDownToLine size={13}/>Export cleaned CSV</button></div></div>
      <div className="content-grid mt-5"><Panel title="Before → after" subtitle="Missing numeric values are filled with each field’s median; exact duplicate rows are removed." className="col-span-2"><div className="before-after"><div><span>Missing cells</span><strong>{beforeMissing}<ArrowRight size={15}/><b>0</b></strong></div><div><span>Duplicate records</span><strong>{removed}<ArrowRight size={15}/><b>0</b></strong></div><div><span>Classified rows</span><strong>{0}<ArrowRight size={15}/><b>{result.length}</b></strong></div></div><div className="quality-breakdown"><span>Missing by field</span><b>Temperature <i>{raw.filter((r)=>r.Temperature===null).length}</i></b><b>Vibration <i>{raw.filter((r)=>r.Vibration===null).length}</i></b><b>DefectCount <i>{raw.filter((r)=>r.DefectCount===null).length}</i></b></div><div className="clean-rules"><div><span className="rule-num">01</span><div><b>Median imputation</b><p>Temperature {num(medianOf(raw,'Temperature'))}° · Vibration {num(medianOf(raw,'Vibration'),3)} · DefectCount {num(medianOf(raw,'DefectCount'))}</p></div></div><div><span className="rule-num">02</span><div><b>Exact duplicate removal</b><p>Matching across all five original CSV fields; same BatchID alone is not enough.</p></div></div><div><span className="rule-num">03</span><div><b>Rule-based classification</b><p>Temperature band and defective flag are added after missing values are resolved.</p></div></div></div></Panel>
        <Panel title="Temperature categories" subtitle="Classification after imputation"><div className="category-list">{cat.map((c, i) => <div className="category-row" key={c.label}><span className="category-label"><i style={{ background: palette[i] }}/>{c.label}</span><div className="category-track"><i style={{ width: `${result.length ? c.n / result.length * 100 : 0}%`, background: palette[i] }}/></div><b>{c.n}</b></div>)}</div><div className="defective-counter"><div><span>Defective = YES</span><b>{result.filter((r) => r.Defective === 'YES').length}</b></div><div><span>Defective = NO</span><b>{result.filter((r) => r.Defective === 'NO').length}</b></div></div></Panel>
        <Panel title="Cleaned preview" subtitle={`${result.length} unique, fully classified rows`} className="col-span-3"><div className="table-scroll"><table className="data-table"><thead><tr><th>Batch</th><th>Machine</th><th>Temperature</th><th>Vibration</th><th>Defects</th><th>Band</th><th>Defective</th></tr></thead><tbody>{result.map((r, i) => <tr key={`${r.BatchID}-${i}`}><td className="mono text-cyan-100">{r.BatchID}</td><td>{r.MachineID}</td><td>{num(r.Temperature ?? 0)}°</td><td>{num(r.Vibration ?? 0, 3)}</td><td>{num(r.DefectCount ?? 0, 0)}</td><td><span className={`band band-${r.TemperatureCategory?.toLowerCase()}`}>{r.TemperatureCategory}</span></td><td><span className={`data-flag ${r.Defective === 'YES' ? 'flag-missing' : 'flag-valid'}`}>{r.Defective}</span></td></tr>)}</tbody></table></div></Panel>
      </div>
    </>}
  </div>;
}
function medianOf(rows: Batch[], key: Field) { const values = rows.map((r) => r[key]).filter((v): v is number => v !== null); if (!values.length) return 0; const s = [...values].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; }
function EmptyBlock({ title, text }: { title: string; text: string }) { return <div className="empty-block"><div><Database size={20}/></div><strong>{title}</strong><p>{text}</p></div>; }

function Machines(p: Shared) {
  const [selected, setSelected] = useState('');
  const machineId = selected && p.stats.some((m) => m.MachineID === selected) ? selected : p.stats[0]?.MachineID;
  const machine = p.stats.find((m) => m.MachineID === machineId);
  const risk = p.risks.find((m) => m.MachineID === machineId);
  const history = machine?.rows.map((r) => ({ batch: r.BatchID, temperature: r.Temperature, vibration: r.Vibration, defects: r.DefectCount })) ?? [];
  return <div className="animate-in"><PageHeading eyebrow="ASSETS / MACHINE PROFILES" title="The machines behind the batches." copy="Select an identifier to inspect its recorded history, summary metrics and transparent prototype risk."/>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{p.risks.map((r) => <button key={r.MachineID} onClick={() => setSelected(r.MachineID)} className={`glass rounded-xl p-4 text-left transition hover:border-cyan-300/30 ${machineId === r.MachineID ? 'border-cyan-300/40' : ''}`} data-testid={`card-machine-health-${r.MachineID}`}><div className="mb-3 flex items-center justify-between"><strong className="text-sm text-slate-100">{r.MachineID}</strong><StatusPill status={r.status}/></div><div className="mb-3 flex items-end justify-between"><span className="text-[10px] text-slate-500">Prototype Risk Score</span><b className="font-mono text-lg text-cyan-200">{r.score}<small className="ml-1 text-[9px] text-slate-500">/100</small></b></div><div className="grid grid-cols-2 gap-2 border-t border-slate-700/50 pt-3 text-[10px]"><span className="text-slate-500">Avg. temperature <b className="ml-1 text-slate-300">{num(r.avgTemperature)}°</b></span><span className="text-slate-500">Avg. vibration <b className="ml-1 text-slate-300">{num(r.avgVibration, 3)}</b></span><span className="text-slate-500">Defects <b className="ml-1 text-slate-300">{r.defects}</b></span><span className="text-slate-500">Defect rate <b className="ml-1 text-slate-300">{num(r.defectRate)}%</b></span></div></button>)}</div>
    {!p.stats.length ? <EmptyBlock title="No machine records" text="Machines appear here when the loaded dataset includes MachineID values."/> : <div className="machine-layout"><div className="glass machine-list"><div className="panel-head"><div><h2>Machine registry</h2><p>{p.stats.length} identified</p></div></div>{p.stats.map((m) => { const rr = p.risks.find((r) => r.MachineID === m.MachineID); return <button key={m.MachineID} onClick={() => setSelected(m.MachineID)} className={`machine-row ${machineId === m.MachineID ? 'machine-row-active' : ''}`} data-testid={`button-machine-${m.MachineID}`}><div className="machine-icon"><Cpu size={17}/></div><div className="flex-1 text-left"><strong>{m.MachineID}</strong><span>{m.batches} batches recorded</span></div><StatusPill status={rr?.status ?? 'Healthy'}/></button>; })}</div>
    {machine && risk && <div className="machine-detail"><div className="glass machine-intro"><div><div className="eyebrow">MACHINE PROFILE</div><h2>{machine.MachineID}<span className="online-label"><i/>LOADED DATA</span></h2><p>{machine.batches} observed batch{machine.batches === 1 ? '' : 'es'} in the current file. This view describes recorded rows only.</p></div><div className="risk-gauge"><div className="gauge-ring" style={{ background: `conic-gradient(${risk.score >= 70 ? '#ed817a' : risk.score >= 40 ? '#e4ae62' : '#60d1aa'} ${risk.score * 3.6}deg, #293543 0deg)` }}><div><b>{risk.score}</b><small>RISK</small></div></div><StatusPill status={risk.status}/></div></div><div className="metric-grid metric-grid-compact"><MiniStat title="Mean temperature" value={`${num(machine.avgTemperature)}°`}/><MiniStat title="Mean vibration" value={num(machine.avgVibration,3)}/><MiniStat title="Total defects" value={machine.defects}/><MiniStat title="Defect batch rate" value={`${num(machine.defectRate)}%`}/></div><Panel title="Batch history" subtitle="Temperature and vibration readings alongside observed defects"><div className="chart-area chart-tall"><ResponsiveContainer width="100%" height="100%"><LineChart data={history} margin={{ top: 8, right: 18, bottom: 0, left: -15 }}><CartesianGrid stroke="#293542" strokeDasharray="3 5"/><XAxis dataKey="batch" tick={{ fill: '#8292a1', fontSize: 10 }}/><YAxis yAxisId="left" tick={{ fill: '#8292a1', fontSize: 10 }}/><YAxis yAxisId="right" orientation="right" tick={{ fill: '#8292a1', fontSize: 10 }}/><Tooltip contentStyle={tipStyle}/><Legend/><Line yAxisId="left" type="monotone" dataKey="temperature" name="Temperature" stroke="#48d3df" strokeWidth={2} dot={{ r: 3 }}/><Line yAxisId="left" type="monotone" dataKey="vibration" name="Vibration" stroke="#70a9ff" strokeWidth={2} dot={{ r: 3 }}/><Line yAxisId="right" type="monotone" dataKey="defects" name="Defects" stroke="#efa65a" strokeWidth={2} dot={{ r: 3 }}/></LineChart></ResponsiveContainer></div></Panel><div className="explanation-card"><div className="explanation-symbol"><Lightbulb size={17}/></div><div><strong>What this profile says</strong><p>{explainRisk(risk)}</p><small>Observed values are descriptive; this does not establish a cause for defects.</small></div></div></div>}</div>}
  </div>;
}
function explainRisk(r: ReturnType<typeof riskStats>[number]) {
  const components = [
    { name: 'temperature', contribution: r.temperatureRisk * 0.35 },
    { name: 'vibration', contribution: r.vibrationRisk * 0.35 },
    { name: 'observed defect history', contribution: r.defectRisk * 0.3 },
  ];
  const largest = [...components].sort((a, b) => b.contribution - a.contribution)[0];
  return `${r.MachineID} has a prototype score of ${r.score}/100 (${r.status.toLowerCase()}). The largest weighted contributor is ${largest.name} (${Math.round(largest.contribution * 100)} of 100 points). The score combines normalized temperature, vibration, and observed defect history; it is a prioritization cue, not a prediction.`;
}

function Analytics(p: Shared) {
  const [machine, setMachine] = useState('all');
  const rows = cleanRows(p.activeRows).filter((r) => machine === 'all' || r.MachineID === machine);
  const ms = machineStats(rows); const scatterT = rows.map((r) => ({ x: r.Temperature, y: r.DefectCount, label: r.BatchID })); const scatterV = rows.map((r) => ({ x: r.Vibration, y: r.DefectCount, label: r.BatchID }));
  const categoryData = ['LOW','NORMAL','HIGH'].map((name) => ({ name, count: rows.filter((r) => r.TemperatureCategory === name).length }));
  const risk = riskStats(rows).map((r) => ({ name: r.MachineID, score: r.score }));
  return <div className="animate-in"><PageHeading eyebrow="ANALYSIS / EXPLORATION" title="Patterns, without the guesswork." copy="Explore batch-level readings and aggregate machine patterns. Filters recalculate every chart from the active records." action={<label className="select-box"><SlidersHorizontal size={14}/><select value={machine} onChange={(e) => setMachine(e.target.value)} aria-label="Filter analytics by machine" data-testid="select-analytics-machine"><option value="all">All machines</option>{[...new Set(p.rows.map((r) => r.MachineID))].sort().map((id) => <option key={id}>{id}</option>)}</select><ChevronDown size={13}/></label>}/>
    <div className="filter-context"><span className="status-led led-on"/>{machine === 'all' ? 'All machines' : machine}<span className="text-slate-600">·</span>{rows.length} batches included<span className="ml-auto text-[10px] text-slate-500">Filtered view</span></div>
    <div className="content-grid"><Panel title="Temperature vs. defects" subtitle="One point per batch · descriptive only"><ScatterPanel data={scatterT} xLabel="Temperature" xKey="x" yLabel="Defects" yKey="y"/></Panel><Panel title="Vibration vs. defects" subtitle="One point per batch · descriptive only"><ScatterPanel data={scatterV} xLabel="Vibration" xKey="x" yLabel="Defects" yKey="y"/></Panel>
      <Panel title="Defects by machine" subtitle="Sum of known defect counts"><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={ms.map((m) => ({ machine: m.MachineID, defects: m.defects }))} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}><CartesianGrid stroke="#293542" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="machine" tick={{ fill: '#8292a1', fontSize: 10 }}/><YAxis tick={{ fill: '#8292a1', fontSize: 10 }} allowDecimals={false}/><Tooltip contentStyle={tipStyle}/><Bar dataKey="defects" fill="#48d3df" radius={[4,4,0,0]} maxBarSize={38}/></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="Machine operating averages" subtitle="Mean sensor values"><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={ms.map((m) => ({ machine: m.MachineID, temperature: m.avgTemperature, vibration: m.avgVibration }))} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}><CartesianGrid stroke="#293542" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="machine" tick={{ fill: '#8292a1', fontSize: 10 }}/><YAxis tick={{ fill: '#8292a1', fontSize: 10 }}/><Tooltip contentStyle={tipStyle}/><Legend/><Bar dataKey="temperature" name="Avg. temperature" fill="#48d3df" radius={[3,3,0,0]}/><Bar dataKey="vibration" name="Avg. vibration" fill="#70a9ff" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="Temperature distribution" subtitle="Rule-based category counts"><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={categoryData} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}><CartesianGrid stroke="#293542" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="name" tick={{ fill: '#8292a1', fontSize: 10 }}/><YAxis allowDecimals={false} tick={{ fill: '#8292a1', fontSize: 10 }}/><Tooltip contentStyle={tipStyle}/><Bar dataKey="count" fill="#70a9ff" radius={[4,4,0,0]}>{categoryData.map((_, i) => <Cell key={i} fill={palette[i]}/>)}</Bar></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="Prototype risk comparison" subtitle="Normalized score · heuristic only"><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={risk} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}><CartesianGrid stroke="#293542" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="name" tick={{ fill: '#8292a1', fontSize: 10 }}/><YAxis domain={[0,100]} tick={{ fill: '#8292a1', fontSize: 10 }}/><Tooltip contentStyle={tipStyle}/><Bar dataKey="score" name="Risk score" fill="#efa65a" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></Panel>
    </div><p className="analysis-disclaimer"><AlertTriangle size={14}/>Visual patterns are not evidence of causation. Scores are a transparent prototype heuristic, not validated machine learning.</p>
  </div>;
}
function ScatterPanel({ data, xLabel, xKey, yLabel, yKey }: { data: { x: number | null; y: number | null; label: string }[]; xLabel: string; xKey: string; yLabel: string; yKey: string }) {
  return <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 8, right: 10, bottom: 3, left: -15 }}><CartesianGrid stroke="#293542" strokeDasharray="3 5"/><XAxis type="number" dataKey={xKey} name={xLabel} tick={{ fill: '#8292a1', fontSize: 10 }}/><YAxis type="number" dataKey={yKey} name={yLabel} allowDecimals={false} tick={{ fill: '#8292a1', fontSize: 10 }}/><Tooltip contentStyle={tipStyle} formatter={(v: number, name: string) => [v, name]} labelFormatter={(_, a) => a?.[0]?.payload?.label}/><Scatter data={data} fill="#48d3df" r={4}/></ScatterChart></ResponsiveContainer></div>;
}

function insightsFor(p: Shared) {
  const rows = cleanRows(p.rows); const rs = riskStats(rows); const highTemp = rows.filter((r) => r.TemperatureCategory === 'HIGH').length;
  const positive = rows.filter((r) => r.Defective === 'YES').length;
  const top = [...rs].sort((a,b)=>b.score-a.score)[0];
  const defectLeader = [...machineStats(rows)].sort((a,b)=>b.defects-a.defects)[0];
  const out = [
    { tone: p.missingCount || p.duplicateCount ? 'amber' : 'green', title: p.missingCount || p.duplicateCount ? 'Input data needs preparation' : 'No basic quality flags found', text: p.missingCount || p.duplicateCount ? `${p.missingCount} numeric value${p.missingCount === 1 ? '' : 's'} missing and ${p.duplicateCount} exact duplicate record${p.duplicateCount === 1 ? '' : 's'} detected. Median imputation and exact-row deduplication are available in Data cleaning.` : 'The current rows contain no missing numeric values or exact duplicate records. Validate source instruments as usual.', icon: ShieldCheck },
    { tone: highTemp ? 'cyan' : 'green', title: `${highTemp} batch${highTemp === 1 ? '' : 'es'} in the high temperature band`, text: 'The high band is defined as above 85. This is a threshold-based observation, not evidence that temperature caused defects.', icon: Activity },
    { tone: positive ? 'amber' : 'green', title: `${positive} batch${positive === 1 ? '' : 'es'} with observed defects`, text: `Defective classification is based only on DefectCount > 0. Known defect total across the source is ${p.defectTotal}.`, icon: AlertTriangle },
     ...(defectLeader ? [{ tone: 'cyan', title: `${defectLeader.MachineID} has the highest observed defect count`, text: `${defectLeader.MachineID} accounts for ${defectLeader.defects} known defects in ${defectLeader.batches} cleaned batch records. This is an observed total, not a causal comparison.`, icon: BarChart3 }] : []),
    ...(top ? [{ tone: top.status === 'Healthy' ? 'green' : 'amber', title: `${top.MachineID} ranks highest on prototype risk`, text: `Its transparent normalized weighted score is ${top.score}/100 (${top.status.toLowerCase()}). Review the machine profile and underlying batch readings before taking action.`, icon: Gauge }] : []),
  ];
  return out;
}
function Insights(p: Shared) {
  const insights = insightsFor(p);
  return <div className="animate-in"><PageHeading eyebrow="INTERPRETATION / RULE-BASED" title="What the data can tell you." copy="Explanations are generated from the active dataset and explicit thresholds. They describe signals; they do not claim causality." action={<span className="mode-badge"><Sparkles size={13}/>Rules, not AI</span>}/>
    {!p.rows.length ? <EmptyBlock title="Waiting for batch data" text="Load a CSV to generate transparent explanations from its values."/> : <><div className="insight-summary"><div className="insight-orb"><Lightbulb size={19}/></div><div><span>READOUT</span><strong>{insights.length} observations from {p.rows.length} rows</strong><p>Every statement below is reproducible from loaded CSV values and documented thresholds.</p></div></div><div className="insight-list">{insights.map(({ tone, title, text, icon: Icon }, i) => <div className="glass insight-card" key={title} data-testid={`card-insight-${i}`}><div className={`insight-icon insight-${tone}`}><Icon size={18}/></div><div className="flex-1"><div className="insight-overline">OBSERVATION 0{i+1}</div><h2>{title}</h2><p>{text}</p></div><span className="insight-index">0{i+1}</span></div>)}</div><div className="notice-line"><CircleHelp size={15}/>The score is not a validated model, causal analysis, or substitute for process engineering review.</div></>}
  </div>;
}
function recommendations(risks: ReturnType<typeof riskStats>) {
  if (!risks.length) return ['Load valid batch data before generating recommendations.'];
  const sorted = [...risks].sort((a,b)=>b.score-a.score);
  const recs: string[] = sorted.map((r) => r.status === 'Critical'
    ? `HIGH · ${r.MachineID}: inspect the temperature sensor, check vibration levels, review recent defective batches, and consider preventive maintenance if abnormal readings persist.`
    : r.status === 'Warning'
      ? `MEDIUM · ${r.MachineID}: increase monitoring frequency and compare sensor calibration and process set-points with its own operating history.`
      : `LOW · ${r.MachineID}: continue routine monitoring and preserve consistent sensor records.`);
  if (sorted[0]) recs.push(`Prioritize a human review of ${sorted[0].MachineID}'s highest-risk batches and verify the source measurements before making adjustments.`);
  recs.push('Keep recording temperature, vibration and defect outcomes consistently; additional representative observations make local comparisons more useful.');
  recs.push('Treat every score as a screening cue only. Confirm operating changes with established quality procedures and engineering judgment.');
  return recs;
}
function RecommendationsPage(p: Shared) {
  const recs = recommendations(p.risks);
  const urgent = p.risks.filter((r) => r.status === 'Critical').length;
  return <div className="animate-in"><PageHeading eyebrow="ACTION / REVIEW QUEUE" title="A practical next move." copy="Suggested checks are generated from the current machine risk bands and observed input quality. Nothing is sent to equipment." action={<span className="mode-badge"><ShieldCheck size={13}/>Human-reviewed</span>}/>
    {!p.rows.length ? <EmptyBlock title="Recommendations need data" text="Upload batch readings to prioritize the next quality review."/> : <><div className="recommend-hero"><div><div className="eyebrow">PRIORITY SIGNAL</div><h2>{urgent ? `${urgent} critical machine${urgent===1?'':'s'} to review` : 'No critical machines in this view'}</h2><p>Use these checks to focus attention, not as automatic control instructions.</p></div><div className={`priority-mark ${urgent ? 'priority-alert' : ''}`}><AlertTriangle size={20}/><b>{urgent}</b></div></div><div className="recommend-list">{recs.map((r, i) => <div className="glass recommend-item" key={r}><div className={`recommend-number ${i===0 && urgent ? 'number-alert' : ''}`}>{String(i+1).padStart(2,'0')}</div><p>{r}</p><Check size={15} className="recommend-check"/></div>)}</div><div className="notice-line"><AlertTriangle size={15}/>Recommendations are heuristic and based only on this loaded CSV. They do not diagnose equipment or imply causation.</div></>}
  </div>;
}

function Live(p: Shared) {
  const machines = useMemo(() => [...new Set([...p.rows.map((r) => r.MachineID), 'M1','M2','M3'])].sort(), [p.rows]);
  const [running, setRunning] = useState(true); const [tempThreshold, setTempThreshold] = useState(86); const [vibrationThreshold, setVibrationThreshold] = useState(3.4); const [tick, setTick] = useState(0);
  useEffect(() => { if (!running) return; const id = window.setInterval(() => setTick((v) => v + 1), 3000); return () => window.clearInterval(id); }, [running]);
  const simulated = machines.map((id, i) => {
    const source = p.rows.filter((r) => r.MachineID === id);
    const last = source[source.length - 1];
    const temp = (last?.Temperature ?? 74 + i * 4) + Math.sin((tick + i * 4) / 2.5) * 3.2;
    const vib = (last?.Vibration ?? .2 + i * .06) + Math.cos((tick + i * 3) / 3) * .07;
    const alert = temp >= tempThreshold || vib >= vibrationThreshold;
    return { id, temp, vib, alert, basedOn: source.length ? `${source.length} loaded reading${source.length===1?'':'s'}` : 'synthetic baseline' };
  });
  return <div className="animate-in"><PageHeading eyebrow="OPERATIONS / SANDBOX" title="Live signal rehearsal." copy="A browser-only simulation to explore threshold alert behavior. No sensor connection exists; these changing values are not real telemetry." action={<button className={`button ${running ? 'button-outline' : 'button-primary'}`} onClick={() => setRunning(!running)} data-testid="button-toggle-simulation">{running ? <><Activity size={15}/>Pause simulation</> : <><Play size={15}/>Resume simulation</>}</button>}/>
    <div className="simulation-banner"><span className="simulation-dot"/><div><b>SIMULATION MODE</b><span>Values update locally every 3 seconds · no IoT connection</span></div><span className="mono ml-auto text-xs text-cyan-200">T+{String(tick * 3).padStart(3,'0')}s</span></div>
    <div className="sim-layout mt-5"><Panel title="Alert thresholds" subtitle="Set the boundaries used for local simulation alerts"><label className="threshold-control"><span><b>Temperature threshold</b><small>Alert at or above this value</small></span><div><input type="number" min="0" max="200" step=".5" value={tempThreshold} onChange={(e)=>setTempThreshold(Number(e.target.value))} aria-label="Temperature alert threshold" data-testid="input-temperature-threshold"/><span>°</span></div></label><label className="threshold-control"><span><b>Vibration threshold</b><small>Alert at or above this value</small></span><div><input type="number" min="0" max="10" step=".01" value={vibrationThreshold} onChange={(e)=>setVibrationThreshold(Number(e.target.value))} aria-label="Vibration alert threshold" data-testid="input-vibration-threshold"/><span>units</span></div></label><div className="threshold-foot"><ShieldCheck size={14}/>Thresholds affect simulation alerts only.</div></Panel>
    <Panel title="Simulated machine readings" subtitle={`${simulated.length} machine signals · generated locally`} action={<span className="simulation-live"><i className={running?'':'paused-dot'}/>{running?'RUNNING':'PAUSED'}</span>}><div className="simulation-machine-list">{simulated.map((m) => <div className="sim-machine" key={m.id}><div className="sim-machine-id"><div className="machine-icon"><Cpu size={16}/></div><div><b>{m.id}</b><small>{m.basedOn}</small></div></div><div className="sim-reading"><span>TEMPERATURE</span><b className={m.temp>=tempThreshold?'text-rose-300':''}>{num(m.temp)}<small>°</small></b></div><div className="sim-reading"><span>VIBRATION</span><b className={m.vib>=vibrationThreshold?'text-rose-300':''}>{num(m.vib,3)}</b></div><div>{m.alert ? <span className="alert-pill"><AlertTriangle size={12}/>Threshold exceeded</span> : <span className="status-pill status-healthy"><i/>Within threshold</span>}</div></div>)}</div></Panel></div>
    <div className="simulation-foot"><AlertTriangle size={15}/><span><b>Prototype disclaimer.</b> This feature demonstrates UI behavior only. Measurements are mathematical variations around loaded values or illustrative defaults, not actual equipment readings.</span></div>
  </div>;
}

function Methodology() {
  return <div className="animate-in"><PageHeading eyebrow="REFERENCE / TRANSPARENT BY DESIGN" title="How this workspace reasons." copy="A compact record of parsing rules, data preparation, descriptive metrics and prototype risk scoring."/>
    <div className="method-layout"><div className="method-main">
      <Panel title="1. Accepted data" subtitle="CSV schema and validation"><p className="method-copy">Headers must exactly match these five case-sensitive fields:</p><div className="schema-list">{[['BatchID','string · required'],['MachineID','string · required'],['Temperature','number or blank'],['Vibration','number or blank'],['DefectCount','number or blank']].map(([a,b])=><div key={a}><code>{a}</code><span>{b}</span></div>)}</div><p className="method-copy mt-4">Blank numeric cells are recorded as missing. Nonnumeric values, invalid row widths, missing/extra headers, malformed quoting, and empty input are surfaced as validation errors. Invalid uploads do not replace the current valid dataset.</p></Panel>
      <Panel title="2. Cleaning pipeline" subtitle="Deterministic and idempotent"><div className="formula-list"><div><b>Median imputation</b><code>missing field ← median(observed values for that field)</code><p>Applied independently to Temperature, Vibration and DefectCount. A field with no observed values uses 0 as a safe fallback.</p></div><div><b>Exact duplicate removal</b><code>same BatchID + MachineID + all three measurements</code><p>Repeated identifiers with different sensor data are retained. Reapplying the pipeline produces the same output.</p></div><div><b>Derived classification</b><code>Temperature &lt; 75 → LOW · 75–85 → NORMAL · &gt;85 → HIGH</code><code>DefectCount &gt; 0 → YES · otherwise → NO</code><p>Derived labels are added only after missing values have been handled.</p></div></div></Panel>
      <Panel title="3. Machine risk score" subtitle="Prototype prioritization heuristic · not validated ML"><div className="risk-formula"><code>score = 100 × clamp(0.35T + 0.35V + 0.30D, 0, 1)</code></div><div className="formula-list"><div><b>T — normalized mean temperature</b><p>Machine mean temperature divided by the maximum observed temperature in the cleaned dataset, clamped to [0,1].</p></div><div><b>V — normalized mean vibration</b><p>Machine mean vibration divided by the maximum observed vibration in the cleaned dataset, clamped to [0,1].</p></div><div><b>D — observed defect component</b><p>Machine’s known defect total divided by (its batch count × the maximum observed per-batch defect count), clamped to [0,1].</p></div></div><div className="status-thresholds"><span><i className="healthy-mark"/>0–39 Healthy</span><span><i className="warning-mark"/>40–69 Warning</span><span><i className="critical-mark"/>70–100 Critical</span></div><p className="method-copy mt-4">If data is empty, denominators are protected and no machine score is produced. A zero maximum contributes zero. This score is not calibrated, statistically validated, or a machine learning model.</p></Panel>
      <Panel title="4. Descriptive statistics & caveats" subtitle="What the metrics do — and do not — mean"><ul className="caveat-list"><li>Defect total is the sum of known DefectCount values; missing values are excluded until cleaning.</li><li>Defect batch rate is the share of a machine’s records with DefectCount greater than zero.</li><li>Scatter plots show co-occurrence only. They do not establish correlation, causation, or process effects.</li><li>All parsing and analysis occur in the browser. The app has no real AI inference, equipment integration or live telemetry.</li><li>Check process context, measurement units, sensor calibration and company quality procedures before acting.</li></ul></Panel>
    </div><aside className="method-aside"><div className="glass method-index"><div className="eyebrow">IN THIS REFERENCE</div>{['Accepted data','Cleaning pipeline','Machine risk score','Statistics & caveats'].map((x,i)=><div key={x}><span>0{i+1}</span>{x}</div>)}</div><div className="method-aside-note"><ShieldCheck size={16}/><b>Transparent by default.</b><p>Every score and category shown here can be reconstructed from the current CSV and these formulas.</p></div></aside></div>
  </div>;
}

export default App;