'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Clock3,
  ImagePlus,
  LayoutGrid,
  Menu,
  Minus,
  Plus,
  Receipt,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import MenuManager from '@/components/menu-manager';
import type { Product, Sale } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import {
  BUSINESS_DAY_RESET_HOUR,
  businessDayBounds,
  businessDayKey,
  formatBusinessDay,
  isInBusinessDay,
} from '@/lib/business-day';

type Tab = 'counter' | 'history' | 'analytics' | 'menu';
type Mode = 'daily' | 'monthly' | 'custom' | 'yearly';

type PeakPeriod = {
  label: string;
  time: string;
  revenue: number;
  transactions: number;
};

const money = (value: number) =>
  `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const monthKey = (key: string) => key.slice(0, 7);
const yearKey = (key: string) => key.slice(0, 4);

function nextMonthBusinessDayKey(value: string) {
  const [year, month] = value.split('-').map(Number);
  return businessDayKey(new Date(year, month, 1, 12, 0, 0));
}

function analyticsRange(
  mode: Mode,
  daily: string,
  monthly: string,
  yearly: string,
  customStart: string,
  customEnd: string,
) {
  if (mode === 'daily') return businessDayBounds(daily);

  if (mode === 'monthly') {
    const [year, month] = monthly.split('-').map(Number);
    return {
      start: businessDayBounds(`${year}-${String(month).padStart(2, '0')}-01`).start,
      end: businessDayBounds(nextMonthBusinessDayKey(monthly)).start,
    };
  }

  if (mode === 'yearly') {
    return {
      start: businessDayBounds(`${yearly}-01-01`).start,
      end: businessDayBounds(`${Number(yearly) + 1}-01-01`).start,
    };
  }

  const first = customStart || daily;
  const second = customEnd || first;
  const startKey = first <= second ? first : second;
  const endKey = first <= second ? second : first;
  return {
    start: businessDayBounds(startKey).start,
    end: businessDayBounds(endKey).end,
  };
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function makePdf(
  title: string,
  period: string,
  revenue: number,
  profit: number,
  transactions: number,
  peak: PeakPeriod,
  top: { name: string; count: number; profit: number }[],
) {
  const text = (value: string, x: number, y: number, size: number, bold = false) =>
    `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`;

  const lines = [
    text('PURABI CORNER', 42, 790, 14, true),
    text('Analytics Report', 42, 758, 24, true),
    text(title.toUpperCase(), 42, 736, 9),
    text(`Period: ${period}`, 42, 714, 10),
    text(`Revenue: INR ${revenue.toLocaleString('en-IN')}`, 42, 675, 14, true),
    text(`Profit: INR ${profit.toLocaleString('en-IN')}`, 42, 650, 14, true),
    text(`Transactions: ${transactions}`, 42, 625, 14, true),
    text(`Peak sales period: ${peak.label} (${peak.time})`, 42, 590, 11, true),
    text(`Peak revenue: INR ${peak.revenue.toLocaleString('en-IN')}`, 42, 570, 9),
    text('TOP SELLING ITEMS', 42, 535, 11, true),
  ];

  top.slice(0, 8).forEach((item, index) => {
    lines.push(
      text(
        `${index + 1}. ${item.name} - ${item.count} units - INR ${item.profit.toLocaleString('en-IN')} profit`,
        55,
        505 - index * 25,
        9,
      ),
    );
  });

  lines.push(
    text('Business day resets at 03:00 AM.', 42, 70, 8),
    text(`Generated ${new Date().toLocaleString('en-IN')}`, 42, 52, 8),
  );

  const content = lines.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = new TextEncoder().encode(pdf).length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)
    .join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export default function PosApp() {
  const today = businessDayKey();
  const [tab, setTab] = useState<Tab>('counter');
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customPrice, setCustomPrice] = useState('');
  const [historyDate, setHistoryDate] = useState(today);
  const [mode, setMode] = useState<Mode>('daily');
  const [daily, setDaily] = useState(today);
  const [monthly, setMonthly] = useState(monthKey(today));
  const [yearly, setYearly] = useState(yearKey(today));
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);
  const [editing, setEditing] = useState<Product | null>(null);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');

    const [productResult, saleResult] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('sales').select('*').order('timestamp', { ascending: false }),
    ]);

    if (productResult.error || saleResult.error) {
      setError(productResult.error?.message || saleResult.error?.message || 'Could not load data.');
    } else {
      setProducts(
        (productResult.data || []).map((product) => ({
          ...product,
          daily_count: 0,
        })),
      );
      setSales((saleResult.data || []) as Sale[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const todaySales = useMemo(
    () => sales.filter((sale) => isInBusinessDay(sale.timestamp, today)),
    [sales, today],
  );

  const counts = useMemo(
    () =>
      Object.fromEntries(
        products.map((product) => [
          product.id,
          todaySales.filter((sale) => sale.product_id === product.id).length,
        ]),
      ),
    [products, todaySales],
  );

  const total = useMemo(
    () => todaySales.reduce((sum, sale) => sum + sale.price_charged, 0),
    [todaySales],
  );

  const historyRows = useMemo(
    () =>
      sales
        .filter((sale) => isInBusinessDay(sale.timestamp, historyDate))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [sales, historyDate],
  );

  const selectedRange = analyticsRange(mode, daily, monthly, yearly, customStart, customEnd);

  const analyticsSales = useMemo(
    () =>
      sales.filter((sale) => {
        const timestamp = Date.parse(sale.timestamp);
        return timestamp >= selectedRange.start.getTime() && timestamp < selectedRange.end.getTime();
      }),
    [sales, selectedRange.start, selectedRange.end],
  );

  const revenue = analyticsSales.reduce((sum, sale) => sum + sale.price_charged, 0);
  const profit = analyticsSales.reduce((sum, sale) => sum + sale.profit_recorded, 0);

  const addSale = async (product: Product) => {
    setBusyProductId(product.id);
    setError('');
    const { data, error: insertError } = await supabase
      .from('sales')
      .insert({
        product_id: product.id,
        product_name: product.name,
        price_charged: product.price,
        profit_recorded: product.profit_margin,
      })
      .select()
      .single();

    if (insertError) setError(insertError.message);
    else if (data) setSales((current) => [data as Sale, ...current]);
    setBusyProductId(null);
  };

  const removeSale = async (product: Product) => {
    if (!counts[product.id]) return;
    setBusyProductId(product.id);
    setError('');
    const bounds = businessDayBounds(today);
    const { data, error: deleteError } = await supabase.rpc('delete_latest_sale', {
      p_product_id: product.id,
      p_business_day_start: bounds.start.toISOString(),
      p_business_day_end: bounds.end.toISOString(),
    });

    if (deleteError) setError(deleteError.message);
    else if (data) setSales((current) => current.filter((sale) => sale.id !== data));
    setBusyProductId(null);
  };

  const addCustomSale = async () => {
    const price = Number(customPrice);
    if (!Number.isFinite(price) || price <= 0) return;

    setError('');
    const { data, error: insertError } = await supabase
      .from('sales')
      .insert({
        product_id: null,
        product_name: 'Custom Item',
        price_charged: price,
        profit_recorded: 0,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (data) setSales((current) => [data as Sale, ...current]);
    setCustomPrice('');
    setCustomOpen(false);
  };

  const sharePdf = async () => {
    const top = topItems(analyticsSales);
    const peak = peakPeriod(analyticsSales);
    const period =
      mode === 'daily'
        ? formatBusinessDay(daily)
        : mode === 'monthly'
          ? monthly
          : mode === 'yearly'
            ? yearly
            : `${customStart} to ${customEnd}`;
    const blob = makePdf(`${mode} analytics`, period, revenue, profit, analyticsSales.length, peak, top);
    const safePeriod = period.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename = `Purabi-Corner-Analytics-${mode}-${safePeriod || 'report'}.pdf`;
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: 'Purabi Corner Analytics', files: [file] });
        return;
      } catch {
        // Fall through to download if sharing is cancelled or unavailable.
      }
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <main className="app-shell grid min-h-screen place-items-center bg-[#050914] text-sky-300">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-sky-400/20 bg-sky-400/10">
            <Sparkles size={20} />
          </div>
          <p className="text-sm font-medium">Loading Purabi Corner</p>
          <p className="mt-1 text-xs text-slate-500">Connecting to the store database…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen bg-[radial-gradient(circle_at_top,rgba(19,78,123,.20),transparent_32%),#050914] pb-[calc(5.75rem+env(safe-area-inset-bottom))] text-white">
      <header className="border-b border-white/[0.06] bg-[#050914]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.32em] text-sky-400">Purabi Corner</p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">Dairy POS Console</h1>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-300 sm:flex">
            <Receipt size={15} />
            {todaySales.length} bills today
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200">
            <p className="min-w-0 flex-1 break-words">{error}</p>
            <button onClick={() => setError('')} className="shrink-0 rounded-lg p-1 text-red-200/80 hover:bg-white/5" aria-label="Dismiss error">
              <X size={17} />
            </button>
          </div>
        )}

        {tab === 'counter' && (
          <Counter
            products={products}
            counts={counts}
            total={total}
            add={addSale}
            remove={removeSale}
            custom={() => setCustomOpen(true)}
            day={today}
            busyProductId={busyProductId}
            goToMenu={() => setTab('menu')}
          />
        )}
        {tab === 'history' && <History date={historyDate} setDate={setHistoryDate} rows={historyRows} />}
        {tab === 'analytics' && (
          <Analytics
            mode={mode}
            setMode={setMode}
            daily={daily}
            setDaily={setDaily}
            monthly={monthly}
            setMonthly={setMonthly}
            yearly={yearly}
            setYearly={setYearly}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
            sales={analyticsSales}
            revenue={revenue}
            profit={profit}
            sharePdf={sharePdf}
          />
        )}
        {tab === 'menu' && (
          <MenuManager products={products} setProducts={setProducts} editing={editing} setEditing={setEditing} />
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#07101d]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-3xl grid-cols-4">
          {(
            [
              ['counter', 'Counter', LayoutGrid],
              ['history', 'History', Clock3],
              ['analytics', 'Analytics', BarChart3],
              ['menu', 'Menu', Menu],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 px-2 text-[11px] font-medium transition ${
                tab === key ? 'text-sky-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={20} strokeWidth={1.9} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {customOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1422] p-5 shadow-2xl shadow-black/40">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-sky-400">Quick sale</p>
                <h2 className="mt-1 text-lg font-semibold">Custom item</h2>
              </div>
              <button onClick={() => setCustomOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-white/5" aria-label="Close">
                <X size={19} />
              </button>
            </div>
            <label className="text-xs font-medium text-slate-400" htmlFor="custom-price">Sale amount</label>
            <input
              id="custom-price"
              autoFocus
              value={customPrice}
              onChange={(event) => setCustomPrice(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void addCustomSale();
              }}
              inputMode="decimal"
              placeholder="₹0"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-lg outline-none ring-sky-400/40 placeholder:text-slate-600 focus:ring-2"
            />
            <button
              onClick={() => void addCustomSale()}
              disabled={!Number(customPrice) || Number(customPrice) <= 0}
              className="mt-4 w-full rounded-2xl bg-sky-400 py-3.5 font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add to sale
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Counter({
  products,
  counts,
  total,
  add,
  remove,
  custom,
  day,
  busyProductId,
  goToMenu,
}: {
  products: Product[];
  counts: Record<string, number>;
  total: number;
  add: (product: Product) => void;
  remove: (product: Product) => void;
  custom: () => void;
  day: string;
  busyProductId: string | null;
  goToMenu: () => void;
}) {
  return (
    <section className="pb-4">
      <div className="mb-5 rounded-3xl border border-sky-400/20 bg-white/[0.03] p-5 shadow-[0_18px_60px_rgba(0,0,0,.12)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-400">Business day</p>
            <p className="mt-1 text-lg font-medium sm:text-xl">{formatBusinessDay(day)}</p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-medium text-slate-400">{BUSINESS_DAY_RESET_HOUR}:00 AM reset</span>
        </div>
        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">Live daily sales total</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">{money(total)}</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-sky-400/20 bg-white/[0.025] px-6 py-12 text-center sm:py-16">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-sky-400/15 bg-sky-400/[0.06] text-sky-300"><ImagePlus size={23} /></div>
          <h2 className="mt-4 text-lg font-semibold">Your counter is ready</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Add your dairy products in Menu to start selling. Custom sales can be recorded immediately.</p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button onClick={goToMenu} className="rounded-2xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-300">Add products</button>
            <button onClick={custom} className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white hover:bg-white/[0.06]">+ Custom sale</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => {
            const count = counts[product.id] || 0;
            const busy = busyProductId === product.id;
            return (
              <div key={product.id} className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-2 sm:rounded-3xl sm:p-3">
                <div className="aspect-square overflow-hidden rounded-xl bg-slate-900/80 sm:rounded-2xl">
                  {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-700"><ImagePlus size={22} /></div>}
                </div>
                <p className="mt-2 line-clamp-2 min-h-[2.2rem] text-xs font-semibold leading-4 sm:text-sm">{product.name}</p>
                <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{money(product.price)}</p>
                <div className="mt-2 flex gap-1">
                  <button onClick={() => remove(product)} disabled={!count || busy} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-20 sm:h-10 sm:w-10" aria-label={`Remove latest ${product.name} sale`}><Minus size={15} /></button>
                  <button onClick={() => add(product)} disabled={busy} className="min-w-0 flex-1 rounded-xl bg-sky-400 px-1 text-[11px] font-bold text-slate-950 transition hover:bg-sky-300 disabled:opacity-50">{busy ? '…' : <><Plus size={14} className="mr-0.5 inline" />Sell</>}</button>
                </div>
                <p className="mt-1.5 text-center text-[9px] font-medium text-sky-300 sm:text-[10px]">{count} sold</p>
              </div>
            );
          })}
        </div>
      )}

      {products.length > 0 && <button onClick={custom} className="mt-4 ml-auto flex items-center gap-1.5 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-sky-950/20 hover:bg-sky-300"><Plus size={17} /> Custom</button>}
    </section>
  );
}

function History({ date, setDate, rows }: { date: string; setDate: (value: string) => void; rows: Sale[] }) {
  return (
    <section className="pb-4">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Transactions</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">History</h2></div>
        <label className="block text-xs text-slate-500">Business date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="date-control mt-1 sm:w-auto" /></label>
      </div>
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
        {rows.map((sale) => <div key={sale.id} className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3.5 last:border-b-0 sm:px-5"><div className="min-w-0"><p className="truncate text-sm font-medium">{sale.product_name}</p><p className="mt-0.5 text-xs text-slate-500">{new Date(sale.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p></div><p className="shrink-0 text-sm font-semibold">{money(sale.price_charged)}</p></div>)}
        {!rows.length && <div className="px-6 py-16 text-center"><Clock3 className="mx-auto text-slate-700" size={28} /><p className="mt-3 text-sm font-medium text-slate-400">No sales on this business day</p><p className="mt-1 text-xs text-slate-600">Sales remain stored historically and follow the 03:00 AM boundary.</p></div>}
      </div>
    </section>
  );
}

function Analytics({ mode, setMode, daily, setDaily, monthly, setMonthly, yearly, setYearly, customStart, setCustomStart, customEnd, setCustomEnd, sales, revenue, profit, sharePdf }: { mode: Mode; setMode: (value: Mode) => void; daily: string; setDaily: (value: string) => void; monthly: string; setMonthly: (value: string) => void; yearly: string; setYearly: (value: string) => void; customStart: string; setCustomStart: (value: string) => void; customEnd: string; setCustomEnd: (value: string) => void; sales: Sale[]; revenue: number; profit: number; sharePdf: () => void }) {
  const top = useMemo(() => topItems(sales), [sales]);
  const peak = useMemo(() => peakPeriod(sales), [sales]);
  const chartData = useMemo(() => {
    const grouped = new Map<string, { revenue: number; transactions: number }>();
    sales.forEach((sale) => { const key = businessDayKey(new Date(sale.timestamp)); const value = grouped.get(key) || { revenue: 0, transactions: 0 }; value.revenue += sale.price_charged; value.transactions += 1; grouped.set(key, value); });
    return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ day: key.slice(5), revenue: value.revenue, transactions: value.transactions }));
  }, [sales]);
  const modes: { key: Mode; label: string }[] = [{ key: 'daily', label: 'Daily' }, { key: 'monthly', label: 'Monthly' }, { key: 'custom', label: 'Custom' }, { key: 'yearly', label: 'Yearly' }];

  return (
    <section className="pb-4">
      <div className="mb-5"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Performance</p><div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><h2 className="text-3xl font-semibold tracking-tight">Analytics</h2><button onClick={sharePdf} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300"><Share2 size={16} /> Share PDF</button></div></div>
      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-white/[0.025] p-1">{modes.map((item) => <button key={item.key} onClick={() => setMode(item.key)} className={`rounded-xl px-2 py-2.5 text-[11px] font-medium transition sm:text-sm ${mode === item.key ? 'bg-sky-400 text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{item.label}</button>)}</div>
      <div className="mt-3 rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2">
        {mode === 'daily' && <DateField label="Business day" value={daily} onChange={setDaily} />}
        {mode === 'monthly' && <label className="text-xs text-slate-500">Month<input type="month" value={monthly} onChange={(event) => setMonthly(event.target.value)} className="date-control mt-1" /></label>}
        {mode === 'yearly' && <label className="text-xs text-slate-500">Year<input type="number" min="2020" max="2100" value={yearly} onChange={(event) => setYearly(event.target.value)} className="date-control mt-1" /></label>}
        {mode === 'custom' && <><DateField label="Start" value={customStart} onChange={setCustomStart} /><DateField label="End" value={customEnd} onChange={setCustomEnd} /></>}
      </div><p className="mt-3 text-[11px] leading-5 text-slate-600">All analytics use the same 03:00 AM → 02:59 AM business-day boundary.</p></div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"><MetricCard label="Revenue" value={money(revenue)} /><MetricCard label="Profit" value={money(profit)} /><MetricCard label="Transactions" value={String(sales.length)} wide /></div>
      {sales.length === 0 ? <div className="mt-3 rounded-3xl border border-dashed border-sky-400/15 bg-white/[0.02] px-6 py-14 text-center"><BarChart3 className="mx-auto text-slate-700" size={30} /><p className="mt-3 text-sm font-medium text-slate-400">No sales in this period</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-600">Once transactions are recorded, revenue, profit, peak periods and item performance will appear here.</p></div> : <>
        <div className="mt-3 rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Sales trend</h3><p className="mt-1 text-[11px] text-slate-500">Revenue by business day</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-500">{sales.length} tx</span></div><div className="mt-4 h-64 w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={42} /><Tooltip cursor={{ fill: 'rgba(255,255,255,.03)' }} contentStyle={{ background: '#0b1422', border: '1px solid rgba(255,255,255,.10)', borderRadius: 12, color: '#fff' }} formatter={(value: number | string) => [money(Number(value)), 'Revenue']} /><Bar dataKey="revenue" fill="#59b8f4" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2"><div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Peak sales period</p><h3 className="mt-1 text-lg font-semibold">{peak.label}</h3><p className="mt-1 text-xs text-slate-500">{peak.time}</p></div><div className="text-right"><p className="text-lg font-semibold">{money(peak.revenue)}</p><p className="text-[10px] text-slate-500">{peak.transactions} transactions</p></div></div></div><div className="rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Top selling items</h3><span className="text-[10px] text-slate-600">By volume</span></div><div className="mt-3 space-y-2">{top.slice(0, 5).map((item, index) => <div key={item.name} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] px-3 py-2.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-400/10 text-xs font-semibold text-sky-300">{index + 1}</span><p className="min-w-0 flex-1 truncate text-xs font-medium">{item.name}</p><div className="text-right"><p className="text-xs font-semibold">{item.count}</p><p className="text-[9px] text-slate-600">units</p></div></div>)}</div></div></div>
      </>}
    </section>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs text-slate-500">{label}<input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="date-control mt-1" /></label>; }
function MetricCard({ label, value, wide }: { label: string; value: string; wide?: boolean }) { return <div className={`rounded-3xl border border-white/10 bg-white/[0.025] p-4 sm:p-5 ${wide ? 'col-span-2 sm:col-span-1' : ''}`}><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p></div>; }

function topItems(sales: Sale[]) {
  const grouped = new Map<string, { count: number; profit: number }>();
  sales.forEach((sale) => { const current = grouped.get(sale.product_name) || { count: 0, profit: 0 }; current.count += 1; current.profit += sale.profit_recorded; grouped.set(sale.product_name, current); });
  return [...grouped].map(([name, values]) => ({ name, ...values })).sort((a, b) => b.count - a.count || b.profit - a.profit);
}

function peakPeriod(sales: Sale[]): PeakPeriod {
  const definitions: [string, string, number, number][] = [['Early morning', '3 AM - 7 AM', 3, 7], ['Morning', '7 AM - 11 AM', 7, 11], ['Afternoon', '11 AM - 3 PM', 11, 15], ['Evening', '3 PM - 7 PM', 15, 19], ['Night', '7 PM - 11 PM', 19, 23], ['Late night', '11 PM - 3 AM', 23, 27]];
  return definitions.map(([label, time, start, end]) => { const matching = sales.filter((sale) => { const hour = new Date(sale.timestamp).getHours(); const businessHour = hour < BUSINESS_DAY_RESET_HOUR ? hour + 24 : hour; return businessHour >= start && businessHour < end; }); return { label, time, revenue: matching.reduce((sum, sale) => sum + sale.price_charged, 0), transactions: matching.length }; }).reduce((best, current) => (current.revenue > best.revenue ? current : best));
}
