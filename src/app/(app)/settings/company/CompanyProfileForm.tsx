"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCompanyProfile } from "../companyActions";

type Profile = {
  legalName?: string | null;
  address?: string | null;
  gstin?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoData?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNo?: string | null;
  bankSwift?: string | null;
  bankIfsc?: string | null;
  bankBranch?: string | null;
  signatureName?: string | null;
  footerNote?: string | null;
};

export default function CompanyProfileForm({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [logoData, setLogoData] = useState(initial.logoData ?? "");

  // Downscale the logo to ~400px PNG so it stays small in the database.
  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 400;
        let { width, height } = img;
        if (width > max || height > max) {
          if (width >= height) { height = Math.round((height * max) / width); width = max; }
          else { width = Math.round((width * max) / height); height = max; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        // PNG keeps a transparent logo clean; JPEG would add a white box.
        setLogoData(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function onSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await saveCompanyProfile(formData);
      if (res?.error) setError(res.error);
      else { setSaved(true); router.refresh(); }
    });
  }

  const field = (name: keyof Profile, label: string, placeholder = "") => (
    <div>
      <label className="field-label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={initial[name] ?? ""} className="field-input" placeholder={placeholder} />
    </div>
  );

  return (
    <form action={onSubmit} className="space-y-5 p-4">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      {saved && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">Saved. This is what your proforma invoices will use.</div>}

      <input type="hidden" name="logoData" value={logoData} />

      <div className="card space-y-4">
        <p className="text-sm font-semibold text-gray-900">Letterhead</p>
        <div>
          <label className="field-label">Logo</label>
          {logoData ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoData} alt="Logo" className="h-16 w-16 rounded-lg object-contain ring-1 ring-gray-100" />
              <button type="button" onClick={() => setLogoData("")} className="text-sm font-medium text-red-600">Remove</button>
            </div>
          ) : (
            <label className="btn-secondary inline-flex cursor-pointer">
              Upload logo
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
          )}
        </div>
        {field("legalName", "Legal name", "Aditya International")}
        <div>
          <label className="field-label" htmlFor="address">Address</label>
          <textarea id="address" name="address" defaultValue={initial.address ?? ""} rows={3} className="field-input" placeholder="Registered / office address" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("gstin", "GSTIN")}
          {field("phone", "Phone")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("email", "Email")}
          {field("website", "Website")}
        </div>
      </div>

      <div className="card space-y-4">
        <p className="text-sm font-semibold text-gray-900">Bank details <span className="text-xs font-normal text-gray-400">— for payment / LC</span></p>
        {field("bankName", "Bank name")}
        <div className="grid grid-cols-2 gap-3">
          {field("bankAccountName", "Account name")}
          {field("bankAccountNo", "Account number")}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {field("bankSwift", "SWIFT")}
          {field("bankIfsc", "IFSC")}
          {field("bankBranch", "Branch")}
        </div>
      </div>

      <div className="card space-y-4">
        <p className="text-sm font-semibold text-gray-900">Footer</p>
        {field("signatureName", "Authorised signatory name", "For Aditya International")}
        <div>
          <label className="field-label" htmlFor="footerNote">Footer note</label>
          <textarea id="footerNote" name="footerNote" defaultValue={initial.footerNote ?? ""} rows={2} className="field-input" placeholder="Standing terms or a thank-you line (optional)" />
        </div>
      </div>

      <button type="submit" disabled={isPending} className="btn-primary w-full">
        {isPending ? "Saving…" : "Save company profile"}
      </button>
    </form>
  );
}
