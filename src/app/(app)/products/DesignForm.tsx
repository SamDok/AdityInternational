"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Values = {
  categoryId?: string | null;
  code?: string | null;
  name?: string | null;
  composition?: string | null;
  hsnCode?: string | null;
  gstRate?: number | null;
  leadDays?: number | null;
  description?: string | null;
  imageData?: string | null;
  sourcingType?: string | null;
  vendorId?: string | null;
};

type Category = { id: string; name: string };
type Vendor = { id: string; name: string };

type Props = {
  categories: Category[];
  vendors: Vendor[];
  initial?: Values;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  submitLabel: string;
};

export default function DesignForm({ categories, vendors, initial, action, submitLabel }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [imageData, setImageData] = useState(initial?.imageData ?? "");
  const router = useRouter();

  // Downscale the chosen photo to ~800px JPEG so it stays small in the database.
  function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 800;
        let { width, height } = img;
        if (width > max || height > max) {
          if (width >= height) { height = Math.round((height * max) / width); width = max; }
          else { width = Math.round((width * max) / height); height = max; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        setImageData(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await action(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-5 p-4">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div>
        <label className="field-label" htmlFor="categoryId">Product type *</label>
        <select id="categoryId" name="categoryId" defaultValue={initial?.categoryId ?? ""} className="field-input" required>
          <option value="">Choose a type…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="field-label" htmlFor="code">Design code *</label>
        <input id="code" name="code" required defaultValue={initial?.code ?? ""}
          className="field-input" placeholder="Your design number, e.g. SD-101" autoFocus />
      </div>

      <div>
        <label className="field-label" htmlFor="name">Design name</label>
        <input id="name" name="name" defaultValue={initial?.name ?? ""}
          className="field-input" placeholder="Optional descriptive name" />
      </div>

      <div>
        <label className="field-label" htmlFor="composition">Composition</label>
        <input id="composition" name="composition" defaultValue={initial?.composition ?? ""}
          className="field-input" placeholder="e.g. 100% Silk" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="field-label" htmlFor="hsnCode">HSN code</label>
          <input id="hsnCode" name="hsnCode" defaultValue={initial?.hsnCode ?? ""}
            className="field-input" placeholder="Defaults from the type" />
        </div>
        <div>
          <label className="field-label" htmlFor="gstRate">GST %</label>
          <input id="gstRate" name="gstRate" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={initial?.gstRate ?? ""}
            className="field-input" placeholder="e.g. 5" />
        </div>
        <div>
          <label className="field-label" htmlFor="leadDays">Lead days</label>
          <input id="leadDays" name="leadDays" type="number" min="0" inputMode="numeric" defaultValue={initial?.leadDays ?? ""}
            className="field-input" placeholder="From type" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="sourcingType">Sourcing</label>
          <select id="sourcingType" name="sourcingType" defaultValue={initial?.sourcingType ?? ""} className="field-input">
            <option value="">—</option>
            <option value="JOB_WORK">Job work</option>
            <option value="TRADING">Trading</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="vendorId">Kaarigar / supplier</label>
          <select id="vendorId" name="vendorId" defaultValue={initial?.vendorId ?? ""} className="field-input">
            <option value="">Unassigned</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="description">Notes</label>
        <textarea id="description" name="description" defaultValue={initial?.description ?? ""}
          className="field-input" rows={2} placeholder="Anything else about this design" />
      </div>

      <div>
        <label className="field-label">Photo</label>
        <input type="hidden" name="imageData" value={imageData} />
        {imageData ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageData} alt="" className="h-40 w-full rounded-xl object-cover" />
            <button type="button" onClick={() => setImageData("")} className="btn-secondary w-full text-sm">Remove photo</button>
          </div>
        ) : (
          <label className="btn-secondary w-full cursor-pointer">
            Add a photo
            <input type="file" accept="image/*" onChange={onImage} className="hidden" />
          </label>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={isPending} className="btn-primary flex-1">
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
