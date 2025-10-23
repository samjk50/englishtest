"use client";
import { Cross, CrossIcon, X } from "lucide-react";
import { useMemo, useState } from "react";

function MoneyFmt({ amount, currency }) {
  const n = Number(amount) || 0;
  return <>{new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n)}</>;
}

export default function RecordPayoutModal({ open, onClose, agentId, agentName, currencyCode = "USD", outstandingCents = 0, onRecorded }) {
  const [amount, setAmount] = useState(""); // decimal string
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const outstanding = useMemo(() => (Number(outstandingCents) || 0) / 100, [outstandingCents]);
  const parsed = useMemo(() => {
    const n = Number(String(amount).trim());
    return isFinite(n) ? n : NaN;
  }, [amount]);

  async function submit() {
    setErr("");
    const n = parsed;
    if (!isFinite(n) || n <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    if (n > outstanding) {
      setErr(`Amount exceeds outstanding (${new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(outstanding)}).`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to record payout.");
      }
      onRecorded?.(data.metrics, data.payout);
    } catch (e) {
      setErr(e.message || "Failed to record payout.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-lg font-semibold text-black">Record Payout for {agentName}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 space-y-4">
          <div>
            <label className="text-sm font-bold text-black ">Amount to Pay</label>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border-gray-200 border-1 px-3 py-2 text-black focus:outline-black"
            />
            <p className="mt-1 text-xs text-gray-600">
              Outstanding: <MoneyFmt amount={outstanding} currency={currencyCode} />
            </p>
          </div>

          <div>
            <label className="text-sm font-bold text-black">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Payout for August 2025"
              className="mt-1 w-full rounded-lg border-gray-200 border-1 px-3 py-2 h-28 resize-y placeholder:text-[#71717A] placeholder:text-sm focus:outline-black text-black"
            />
          </div>

          {err && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>}
        </div>

        <div className="px-5 py-3 ">
          <button
            onClick={submit}
            disabled={saving}
            className="w-full rounded-lg bg-black px-4 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving
              ? "Saving…"
              : `Record Payout of ${new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(Number(parsed || 0))}`}
          </button>
        </div>
      </div>
    </div>
  );
}
