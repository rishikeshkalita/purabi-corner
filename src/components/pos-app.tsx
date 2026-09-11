'use client';

import { useMemo, useState } from 'react';
import { BarChart3, Clock3, LayoutGrid, Menu, Minus, Plus, Receipt, Settings2, ShoppingBag, Trash2, UploadCloud, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { demoProducts, demoSales } from '@/lib/demo-data';
import type { Product, Sale } from '@/lib/types';
import { BUSINESS_DAY_RESET_HOUR, businessDayKey, formatBusinessDay, isInBusinessDay } from '@/lib/business-day';

type Tab = 'counter' | 'history' | 'analytics' | 'menu';
const money = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function PosApp() {
  const [tab, setTab] = useState<Tab>('counter');
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [sales, setSales] = useState<Sale[]>(demoSales);
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrice, setCustomPrice] = useState('');
  const currentBusinessDay = businessDayKey();
  const [historyDate, setHistoryDate] = useState(currentBusinessDay);
  const [analyticsDate, setAnalyticsDate] = useState(currentBusinessDay);
  const [editing, setEditing] = useState<Product | null>(null);
  const todayKey = currentBusinessDay;
  const todaySales = sales.filter((s) => isInBusinessDay(s.timestamp, todayKey));
  const liveTotal = useMemo(() => todaySales.reduce((a, b) => a + b.price_charged, 0), [todaySales]);
  const history = sales.filter((s) => isInBusinessDay(s.timestamp, historyDate)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const analyticsSales = sales.filter((s) => isInBusinessDay(s.timestamp, analyticsDate));
  const revenue = analyticsSales.reduce((a, b) => a + b.price_charged, 0);
  const profit = analyticsSales.reduce((a, b) => a + b.profit_recorded, 0);
  const dailyCounts = useMemo(() => Object.fromEntries(products.map((p) => [p.id, todaySales.filter((s) => s.product_id === p.id).length])), [products, todaySales]);
  const top = products.map((p) => ({
    name: p.name.split(' ')[0],
    count: analyticsSales.filter((s) => s.product_id === p.id).length,
    profit: analyticsSales.filter((s) => s.product_id === p.id).reduce((a, b) => a + b.profit_recorded, 0),
  })).sort((a, b) => b.count - a.count).slice(0, 6);

  const addSale = (p: Product) => {
    const now = new Date().toISOString();
    setSales((s) => [{ id: crypto.randomUUID(), product_id: p.id, product_name: p.name, timestamp: now, price_charged: p.price, profit_recorded: p.profit_margin }, ...s]);
  };

  const removeSale = (p: Product) => {
    const victim = sales.filter((s) => s.product_id === p.id && isInBusinessDay(s.timestamp, todayKey)).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    if (!victim) return;
    setSales((s) => s.filter((x) => x.id !== victim.id));
  };

  const addCustom = () => {
    const price = Number(customPrice);
    if (!price || price < 0) return;
    setSales((s) => [{ id: crypto.randomUUID(), product_id: null, product_name: 'Custom Item', timestamp: new Date().toISOString(), price_charged: price, profit_recorded: 0 }, ...s]);
    setCustomPrice('');
    setCustomOpen(false);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(19,78,123,.22),transparent_35%),#050914] pb-24">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#050914]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div><p className="text-xs uppercase tracking-[.28em] text-sky-400">Purabi Corner</p><h1 className="text-xl font-semibold">Dairy POS Console</h1></div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-4 py-2 text-sm text-slate-300 md:flex"><Receipt size={16}/> Live shift · {todaySales.length} bills</div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6">
        {tab === 'counter' && <Counter products={products.map((p) => ({ ...p, daily_count: dailyCounts[p.id] ?? 0 }))} liveTotal={liveTotal} addSale={addSale} removeSale={removeSale} onCustom={() => setCustomOpen(true)} businessDay={todayKey} />}
        {tab === 'history' && <History date={historyDate} setDate={setHistoryDate} rows={history} />}
        {tab === 'analytics' && <Analytics date={analyticsDate} setDate={setAnalyticsDate} revenue={revenue} profit={profit} top={top} />}
        {tab === 'menu' && <MenuManager products={products} setProducts={setProducts} editing={editing} setEditing={setEditing} />}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#07101d]/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-3xl grid-cols-4">
          {([
            ['counter', 'Counter', LayoutGrid],
            ['history', 'History', Clock3],
            ['analytics', 'Analytics', BarChart3],
            ['menu', 'Menu', Menu],
          ] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex flex-col items-center gap-1 px-2 py-3 text-xs ${tab === k ? 'text-sky-300' : 'text-slate-500'}`}><Icon size={19}/><span>{label}</span></button>
          ))}
        </div>
      </nav>

      {customOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center"><div className="glass w-full max-w-md rounded-3xl p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Custom item</h2><button onClick={() => setCustomOpen(false)}><X size={18}/></button></div><label className="text-xs text-slate-400">Price charged</label><input value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} inputMode="decimal" placeholder="₹0" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-sky-400"/><button onClick={addCustom} className="mt-4 w-full rounded-2xl bg-sky-400 py-3 font-semibold text-slate-950">Add to sale</button></div></div>}
    </main>
  );
}

function Counter({ products, liveTotal, addSale, removeSale, onCustom, businessDay }: { products: Product[]; liveTotal: number; addSale: (p: Product) => void; removeSale: (p: Product) => void; onCustom: () => void; businessDay: string }) {
  return <section>
    <div className="glass glow mb-5 rounded-3xl p-5 md:p-6">
      <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.2em] text-sky-400">Business Day</p><p className="text-sm font-medium">{formatBusinessDay(businessDay)}</p></div><span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-[10px] text-slate-400">Resets daily · {BUSINESS_DAY_RESET_HOUR}:00 AM</span></div>
      <div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-widest text-slate-400">Live Daily Sales Total</p><p className="mt-2 text-4xl font-semibold tracking-tight">{money(liveTotal)}</p></div><div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-300"><ShoppingBag/></div></div>
    </div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => <div key={p.id} className="glass overflow-hidden rounded-3xl p-3"><div className="aspect-[1.35] overflow-hidden rounded-2xl bg-slate-900">{p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center text-slate-600">No image</div>}</div><div className="pt-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium leading-tight">{p.name}</p><p className="mt-1 text-sm text-slate-400">{money(p.price)}</p></div><span className="rounded-full bg-sky-400/10 px-2 py-1 text-[10px] font-semibold text-sky-300">{p.daily_count} sold</span></div><div className="mt-3 flex gap-2"><button onClick={() => removeSale(p)} disabled={p.daily_count === 0} aria-label={`Remove latest ${p.name} sale`} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-slate-300 disabled:cursor-not-allowed disabled:opacity-30"><Minus size={18}/></button><button onClick={() => addSale(p)} className="flex-1 rounded-xl bg-sky-400 font-semibold text-slate-950"><span className="inline-flex items-center gap-1"><Plus size={18}/> Sell</span></button></div></div></div>)}
    </div>
    <button onClick={onCustom} className="fixed bottom-24 right-5 rounded-2xl border border-sky-400/30 bg-sky-400 px-4 py-3 font-semibold text-slate-950 shadow-[0_0_28px_rgba(56,189,248,.25)]">+ Custom</button>
  </section>;
}

function History({ date, setDate, rows }: { date: string; setDate: (x: string) => void; rows: Sale[] }) {
  return <section><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-xs uppercase tracking-widest text-slate-500">Business-day transaction feed</p><h2 className="mt-1 text-2xl font-semibold">History</h2></div><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm"/></div><div className="space-y-2">{rows.map((s, i) => <div key={s.id} className="glass flex items-center justify-between rounded-2xl px-4 py-3"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-400/10 text-sky-300">{i + 1}</div><div><p className="font-medium">{s.product_name}</p><p className="text-xs text-slate-500">{new Date(s.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p></div></div><div className="text-right"><p className="font-semibold">{money(s.price_charged)}</p><p className="text-xs text-slate-500">Profit {money(s.profit_recorded)}</p></div></div>)}{!rows.length && <div className="glass rounded-3xl p-10 text-center text-slate-500">No sales on this date.</div>}</div></section>;
}

function Analytics({ date, setDate, revenue, profit, top }: { date: string; setDate: (x: string) => void; revenue: number; profit: number; top: { name: string; count: number; profit: number }[] }) {
  return <section><div className="mb-5 flex items-end justify-between"><div><p className="text-xs uppercase tracking-widest text-slate-500">Business-day performance dashboard</p><h2 className="mt-1 text-2xl font-semibold">Analytics</h2></div><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm"/></div><div className="grid gap-3 md:grid-cols-2"><Metric label="Total Revenue" value={money(revenue)}/><Metric label="Total Profit" value={money(profit)}/></div><div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div className="glass rounded-3xl p-5"><h3 className="font-semibold">Top selling items</h3><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={top}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)"/><XAxis dataKey="name" stroke="#64748b" fontSize={11}/><YAxis stroke="#64748b" fontSize={11}/><Tooltip contentStyle={{ background: '#07101d', border: '1px solid rgba(255,255,255,.1)' }}/><Bar dataKey="count" fill="#38bdf8" radius={[6, 6, 0, 0]}/></BarChart></ResponsiveContainer></div></div><div className="glass rounded-3xl p-5"><h3 className="font-semibold">Highest profit yield</h3><div className="mt-4 space-y-3">{[...top].sort((a, b) => b.profit - a.profit).map((x, i) => <div key={x.name} className="flex items-center justify-between rounded-2xl bg-white/[.03] p-3"><div><p className="font-medium">{i + 1}. {x.name}</p><p className="text-xs text-slate-500">{x.count} units</p></div><span className="font-semibold text-sky-300">{money(x.profit)}</span></div>)}</div></div></div></section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="glass glow rounded-3xl p-5"><p className="text-xs uppercase tracking-widest text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>; }

function MenuManager({ products, setProducts, editing, setEditing }: { products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; editing: Product | null; setEditing: (p: Product | null) => void }) {
  const [draft, setDraft] = useState<Product>(editing ?? { id: '', name: '', price: 0, profit_margin: 0, image_url: '', daily_count: 0 });
  const save = () => { if (!draft.name || !draft.price) return; if (draft.id) setProducts((ps) => ps.map((x) => x.id === draft.id ? { ...draft, daily_count: x.daily_count } : x)); else setProducts((ps) => [...ps, { ...draft, id: crypto.randomUUID(), daily_count: 0 }]); setEditing(null); setDraft({ id: '', name: '', price: 0, profit_margin: 0, image_url: '', daily_count: 0 }); };
  return <section><div className="mb-5 flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-slate-500">Admin inventory</p><h2 className="mt-1 text-2xl font-semibold">Menu Manager</h2></div><Settings2 className="text-sky-300"/></div><div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]"><div className="glass rounded-3xl p-5"><h3 className="font-semibold">{editing ? 'Edit product' : 'Add product'}</h3><div className="mt-4 space-y-3">{([['name', 'Product Name', 'text'], ['price', 'Selling Price', 'number'], ['profit_margin', 'Profit Margin', 'number'], ['image_url', 'Image URL', 'url']] as const).map(([key, lab, type]) => <label key={key} className="block text-sm text-slate-400">{lab}<input value={(draft as any)[key]} onChange={(e) => setDraft({ ...draft, [key]: type === 'number' ? Number(e.target.value) : e.target.value })} type={type} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white"/></label>)}</div><div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-500"><UploadCloud size={17}/> Image storage hook ready for Supabase Storage</div><div className="mt-4 flex gap-2"><button onClick={save} className="flex-1 rounded-2xl bg-sky-400 py-3 font-semibold text-slate-950">{editing ? 'Save changes' : 'Create product'}</button>{editing && <button onClick={() => setEditing(null)} className="rounded-2xl border border-white/10 px-4">Cancel</button>}</div></div><div className="space-y-2">{products.map((p) => <div key={p.id} className="glass flex items-center gap-3 rounded-2xl p-3"><div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-900">{p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover"/>}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{p.name}</p><p className="text-xs text-slate-500">{money(p.price)} · {money(p.profit_margin)} margin</p></div><button onClick={() => { setEditing(p); setDraft(p); }} className="rounded-xl border border-white/10 p-2 text-slate-300">Edit</button><button onClick={() => setProducts((ps) => ps.filter((x) => x.id !== p.id))} className="rounded-xl border border-red-400/20 p-2 text-red-300"><Trash2 size={16}/></button></div>)}</div></div></section>;
}
