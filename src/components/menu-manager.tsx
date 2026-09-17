'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Camera, ImagePlus, Loader2, Settings2, Trash2, X } from 'lucide-react';
import type { Product } from '@/lib/types';
import { supabase } from '@/lib/supabase';

const BUCKET = 'product-images';

type Props = {
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  editing: Product | null;
  setEditing: (product: Product | null) => void;
};

export default function MenuManager({ products, setProducts, editing, setEditing }: Props) {
  const blank: Product = { id: '', name: '', price: 0, profit_margin: 0, image_url: null, daily_count: 0 };
  const [draft, setDraft] = useState<Product>(editing ?? blank);
  const [preview, setPreview] = useState(editing?.image_url ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(editing ?? blank);
    setPreview(editing?.image_url ?? '');
    setFile(null);
    setError('');
  }, [editing]);

  const reset = () => {
    setEditing(null);
    setDraft(blank);
    setPreview('');
    setFile(null);
    setError('');
    if (galleryRef.current) galleryRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  const choose = (selected?: File) => {
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError('');
  };

  const save = async () => {
    if (!draft.name.trim() || draft.price <= 0) {
      setError('Product name and selling price are required.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      if (!supabase) throw new Error('Supabase is not configured.');
      let imageUrl = draft.image_url || null;

      if (file) {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `products/${crypto.randomUUID()}.${extension}`;
        const upload = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upload.error) throw upload.error;
        imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        name: draft.name.trim(),
        price: draft.price,
        profit_margin: draft.profit_margin || 0,
        image_url: imageUrl,
      };

      if (draft.id) {
        const { data, error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', draft.id)
          .select()
          .single();
        if (updateError) throw updateError;
        if (data) setProducts((current) => current.map((product) => product.id === draft.id ? { ...data, daily_count: product.daily_count } : product));
      } else {
        const { data, error: insertError } = await supabase.from('products').insert(payload).select().single();
        if (insertError) throw insertError;
        if (data) setProducts((current) => [...current, { ...data, daily_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
      }

      reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save product.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (product: Product) => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error: deleteError } = await supabase.from('products').delete().eq('id', product.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setProducts((current) => current.filter((item) => item.id !== product.id));
      if (editing?.id === product.id) reset();
    }
    setBusy(false);
  };

  return (
    <section className="pb-4">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Inventory</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Menu Manager</h2>
        </div>
        <Settings2 className="text-sky-300" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h3 className="font-semibold">{editing ? 'Edit product' : 'Add product'}</h3>
          <div className="mt-4 space-y-3">
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Product name" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none focus:border-sky-400/40" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min="0" step="0.01" value={draft.price || ''} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} placeholder="Selling price" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none focus:border-sky-400/40" />
              <input type="number" min="0" step="0.01" value={draft.profit_margin || ''} onChange={(event) => setDraft({ ...draft, profit_margin: Number(event.target.value) })} placeholder="Profit" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 outline-none focus:border-sky-400/40" />
            </div>

            <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(event) => choose(event.target.files?.[0])} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => choose(event.target.files?.[0])} />

            <div className="rounded-2xl border border-dashed border-sky-400/30 bg-sky-400/[0.05] p-3">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-900">
                  {preview ? <img src={preview} alt="Preview" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImagePlus className="text-sky-300" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{preview ? 'Change image' : 'Add product image'}</p>
                  <p className="text-xs text-slate-500">Choose from Photos or take a new photo · max 5 MB</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => galleryRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl bg-sky-400 px-3 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300">
                  <ImagePlus size={16} /> Photos
                </button>
                <button type="button" onClick={() => cameraRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-medium hover:bg-white/[0.05]">
                  <Camera size={16} /> Camera
                </button>
              </div>
            </div>

            {preview && <button type="button" onClick={() => { setPreview(''); setFile(null); setDraft({ ...draft, image_url: null }); }} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"><X size={14} />Remove image</button>}
            {error && <p className="rounded-xl bg-red-400/10 px-3 py-2 text-xs text-red-300">{error}</p>}
            <button onClick={() => void save()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 py-3 font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-60">{busy && <Loader2 size={16} className="animate-spin" />}{editing ? 'Save changes' : 'Create product'}</button>
            {editing && <button onClick={reset} disabled={busy} className="w-full rounded-2xl border border-white/10 py-3 text-sm hover:bg-white/[0.04]">Cancel</button>}
          </div>
        </div>

        <div className="space-y-2">
          {products.map((product) => (
            <div key={product.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-900">
                {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] text-slate-600">No image</div>}
              </div>
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{product.name}</p><p className="text-xs text-slate-500">₹{product.price} · Profit ₹{product.profit_margin}</p></div>
              <button disabled={busy} onClick={() => setEditing(product)} className="rounded-xl border border-white/10 p-2 hover:bg-white/[0.05]" aria-label={`Edit ${product.name}`}><Settings2 size={16} /></button>
              <button disabled={busy} onClick={() => void remove(product)} className="rounded-xl border border-red-400/20 p-2 text-red-300 hover:bg-red-400/10" aria-label={`Delete ${product.name}`}><Trash2 size={16} /></button>
            </div>
          ))}
          {!products.length && <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center"><p className="text-sm font-medium text-slate-400">No products yet</p><p className="mt-1 text-xs text-slate-600">Create your first menu item using the form.</p></div>}
        </div>
      </div>
    </section>
  );
}
