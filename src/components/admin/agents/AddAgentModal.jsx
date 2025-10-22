"use client";

import { useEffect, useMemo, useState } from "react";
import { generateAgentCode } from "@/app/utils/referral";
import { RefreshCcw } from "lucide-react";

const CURRENCIES = ["USD", "EUR", "GBP", "PKR"];

export default function AddAgentModal({ open, onClose, onSaved, agent }) {
  const isEdit = !!agent;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("0");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (isEdit) {
      setName(agent.name || "");
      setEmail(agent.email || "");
      setCode(agent.code || "");
      setCommissionPercent(String(agent.commissionPercent ?? "0"));
      setCurrencyCode(agent.currencyCode || "USD");
      setActive(String(agent.status).toUpperCase() === "ACTIVE");
    } else {
      setName("");
      setEmail("");
      setCode(generateAgentCode());
      setCommissionPercent("0");
      setCurrencyCode("USD");
      setActive(true);
    }
  }, [open, isEdit, agent]);

  const pctDisplay = useMemo(() => {
    const n = Number(commissionPercent);
    return Number.isFinite(n) ? n : 0;
  }, [commissionPercent]);

  if (!open) return null;

  async function handleSave() {
    setError(null);
    const pct = Number(commissionPercent);
    if (!name || !email) return setError("Name and email are required.");
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return setError("Commission must be 0–100.");
    if (!currencyCode) return setError("Currency is required.");

    setSubmitting(true);
    try {
      if (isEdit) {
        // PATCH update
        const res = await fetch(`/api/admin/referral_agents/${agent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            commissionPercent: pct,
            currencyCode,
            status: active ? "ACTIVE" : "INACTIVE",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to update agent");
        onSaved?.(data);
      } else {
        // POST create
        const res = await fetch("/api/admin/referral_agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            commissionPercent: pct,
            currencyCode,
            status: active ? "ACTIVE" : "INACTIVE",
            code, // read-only but sent to preview; server ensures uniqueness
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to create agent");
        onSaved?.(data);
      }
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-black">{isEdit ? "Edit Agent" : "Add New Agent"}</h3>
          <button onClick={onClose} className="rounded p-2 hover:bg-gray-100 text-black">
            ✕
          </button>
        </div>

        <div className="space-y-4 text-black">
          <div>
            <label className="mb-1 block text-sm font-bold text-black ">Agent Name</label>
            <input
              className="w-full rounded-lg border-1 border-[#EEEEF0] p-2 focus:outline-black "
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              className="w-full rounded-lg border-1 border-[#EEEEF0] p-2 focus:outline-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Referral Code</label>
            <div className="flex gap-2">
              <input className="flex-1 rounded-lg border-1 border-[#EEEEF0] p-2 focus:outline-black bg-gray-50" value={code} readOnly />
              {!isEdit && (
                <button
                  className="rounded-lg border-1 border-[#EEEEF0] px-3 py-2 hover:bg-gray-50"
                  onClick={() => setCode(generateAgentCode())}
                  title="Regenerate"
                >
                  <RefreshCcw size={15} />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Commission Rate</label>
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded-lg border-1 border-[#EEEEF0] p-2 focus:outline-black"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(e.target.value)}
                  placeholder="12.5"
                />
                <span className="text-sm text-gray-600">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Current: {pctDisplay}%</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Currency Code</label>
              <select
                className="w-full rounded-lg border-1 border-[#EEEEF0] p-2 focus:outline-black"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActive((v) => !v)}
              className={`inline-flex w-15 items-center rounded-full p-1 transition ${active ? "bg-black" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${active ? "translate-x-7" : ""}`}></span>
            </button>
            <label className="text-md font-bold">{active ? "Agent is Active" : "Agent is Inactive"} </label>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}

          <div className="mt-4 flex justify-end gap-3">
            <button className="rounded-lg border-1 font-bold border-[#EEEEF0] px-4 py-2 hover:bg-gray-50" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              className="rounded-lg bg-black px-4 py-2 font-bold text-white hover:opacity-90 disabled:opacity-50"
              onClick={handleSave}
              disabled={submitting}
            >
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Save Agent"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
