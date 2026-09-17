'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Settings2, Trash2, X } from 'lucide-react';
import type { Product } from '@/lib/types';
import { supabase } from '@/lib/supabase';

const BUCKET = 'product-images';

export default function MenuManager({ products, setProducts, editing, setEditing }: { products: Product[]; setProducts: React.Dispatch<React.SetStateAction<Product[]>>; editing: Product | null; setEditing: (p: Product | null) => void }) {
  const emptyDraft: Product = { id: '', name: '', price: 0, profit_margin: 0, image_url: '', daily_count: 0 };
  const [draft, setDraft] = useState<Product>(editing ?? emptyDraft);
  const [preview, setPreview] = useState<string>(editing?.image_url ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(editing ?? emptyDraft);
    setPreview(editing?.image_url ?? '');
    setImageFile(null);
    setError('');
  }, [editing]);

  const reset = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setPreview('');
    setImageFile(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const chooseImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.');
    if (file.size > 5 * 1024 * 1024) return setError('Image must be 5 MB or smaller.');
    setError('');
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!draft.name.trim() || draft.price <= 0) return setError('Product name and selling price are required.');
    setError('');
    let imageUrl = draft.image_url || '';
    setUploading(true);
    try {
      if (imageFile) {
        if (!supabase) throw new Error('Supabase is not configured. Add the Supabase URL and anon key in Vercel.');
        const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `products/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, imageFile, { contentType: imageFile.type, upsert: false });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      if (draft.id) {
        setProducts((ps) => ps.map((x) => x.id === draft.id ? { ...draft, name: draft.name.trim(), image_url: imageUrl, daily_count: x.daily_count } : x));
      } else {
        setProducts((ps) => [...ps, { ...draft, id: crypto.randomUUID(), name: draft.name.trim(), image_url: imageUrl, daily_count: 0 }]);
      }
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return <section>
    <div className="mb-5 flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-slate-500">Admin inventory</p><h2 className="mt-1 text-2xl font-semibold">Menu Manager</h2></div><Settings2 className="text-sky-300"/></div>
    <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
      <div className="glass rounded-3xl p-5">
        <h3 className="font-semibold">{editing ? 'Edit product' : 'Add product'}</h3>
        <div className="mt-4 space-y-3">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Product name" className="w-full rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3"/>
          <div className="grid grid-cols-2 gap-3"><input type="number" value={draft.price || ''} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} placeholder="Selling price" className="w-full rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3"/><input type="number" value={draft.profit_margin || ''} onChange={(e) => setDraft({ ...draft, profit_margin: Number(e.target.value) })} placeholder="Profit" className="w-full rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3"/></div>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => chooseImage(e.target.files?.[0])}/>
          <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-sky-400/30 bg-sky-400/[.05] p-3 text-left">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-900">{preview ? <img src={preview} alt="Product preview" className="h-full w-full object-cover"/> : <ImagePlus className="text-sky-300" size={24}/>}</div>
            <div className="min-w-0"><p className="font-medium">{preview ? 'Change image' : 'Add image'}</p><p className="mt-1 text-xs text-slate-500">Choose from gallery or camera · max 5 MB</p></div>
          </button>
          {preview && <button type="button" onClick={() => { setPreview(''); setImageFile(null); setDraft({ ...draft, image_url: '' }); if (inputRef.current) inputRef.current.value = ''; }} className="inline-flex items-center gap-1 text-xs text-slate-400"><X size={14}/> Remove image</button>}
          {error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-300">{error}</p>}
          <button onClick={save} disabled={uploading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 py-3 font-semibold text-slate-950 disabled:opacity-60">{uploading && <Loader2 size={17} className="animate-spin"/>}{uploading ? 'Uploading image…' : editing ? 'Save changes' : 'Create product'}</button>
          {editing && <button onClick={reset} disabled={uploading} className="w-full rounded-2xl border border-white/10 py-3 text-sm text-slate-300">Cancel</button>}
        </div>
      </div>
      <div className="space-y-2">{products.map((p) => <div key={p.id} className="glass flex items-center gap-3 rounded-2xl p-3"><div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-900">{p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center text-[10px] text-slate-600">No image</div>}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{p.name}</p><p className="text-xs text-slate-500">₹{p.price.toLocaleString('en-IN')} · Profit ₹{p.profit_margin.toLocaleString('en-IN')}</p></div><button onClick={() => setEditing(p)} className="rounded-xl border border-white/10 p-2 text-slate-300"><Settings2 size={16}/></button><button onClick={() => setProducts((ps) => ps.filter((x) => x.id !== p.id))} className="rounded-xl border border-red-400/20 p-2 text-red-300"><Trash2 size={16}/></button></div>)}{!products.length && <div className="glass rounded-3xl p-8 text-center text-slate-500">No products yet.</div>}</div>
    </div>
  </section>;
}
