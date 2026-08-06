import { NextResponse } from "next/server";
import { refreshFxRates } from "@/lib/fx";

export const dynamic = "force-dynamic";

// Called daily by Vercel Cron (see vercel.json) to pull live exchange rates.
// When CRON_SECRET is set, Vercel sends it as a Bearer token — require it then.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await refreshFxRates();
  return NextResponse.json(res, { status: res.error ? 502 : 200 });
}
