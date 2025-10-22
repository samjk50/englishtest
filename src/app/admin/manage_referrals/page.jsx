"use client";

import { Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function StatusPill({ status }) {
  const s = String(status || "");
  const label = s === "AWAITING_START" ? "awaiting start" : s === "IN_PROGRESS" ? "in progress" : s === "SUBMITTED" ? "scored" : s.toLowerCase();
  const cls =
    s === "SUBMITTED" ? "bg-green-100 text-green-700" : s === "AWAITING_START" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700";
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}

function AssignedBadge({ assigned }) {
  if (!assigned || assigned.type === "NONE") {
    return <span className="text-gray-600">None</span>;
  }
  const tone = assigned.type === "MANUAL" ? "bg-black text-white" : "bg-indigo-100 text-indigo-700";
  const tag = assigned.type === "MANUAL" ? "Manual" : "Default";
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-900">{assigned.code}</span>
      <span className={`text-[10px] rounded-full px-2 py-0.5 ${tone}`}>{tag}</span>
    </div>
  );
}

export default function ManageReferralsPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState({ open: false, attemptId: null, candidateName: "", currency: "" });

  async function load(p = page, query = q) {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/referrals/attempts?page=${p}&pageSize=20&search=${encodeURIComponent(query)}`);
      const j = await r.json();
      setRows(j.items || []);
      setTotalPages(j.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAdjust(row) {
    setModal({
      open: true,
      attemptId: row.attemptId,
      candidateName: row.candidate?.name || "",
      currency: row.currency || "",
    });
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4 text-black">Manage Candidate Referrals</h1>
      {loading ? (
        <div className="text-center text-black p-6">Loading…</div>
      ) : (
        <div>
          <div className="mb-4">
            <input
              placeholder="Search by candidate name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  load(1, e.currentTarget.value);
                }
              }}
              className="w-full max-w-md rounded-lg px-3 py-2 bg-white text-black focus:outline-black"
            />
          </div>

          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm font-semibold text-gray-600">
                  <th className="px-6 py-3">Candidate</th>
                  <th className="px-6 py-3">Test Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Assigned Referral Code</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.attemptId} className="align-top">
                    <td className="px-6 py-3">
                      <div className="font-bold text-black">{r.candidate?.name}</div>
                      <div className="text-sm text-gray-600">{r.candidate?.email}</div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{r.testDate ? new Date(r.testDate).toLocaleDateString() : "—"}</td>
                    <td className="px-6 py-3 ">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-6 py-3 ">
                      <AssignedBadge assigned={r.assigned} />
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => openAdjust(r)}
                        className="inline-flex items-center gap-3 rounded-lg border-[#EBEBED] border-1 px-3 py-2 text-sm text-black font-bold hover:bg-gray-50"
                        title="Adjust referral"
                      >
                        <Pencil size={15} /> <div>Adjust</div>
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                      No attempts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                const p = Math.max(1, page - 1);
                setPage(p);
                load(p, q);
              }}
              disabled={page <= 1 || loading}
              className="h-9 rounded-md border px-3 text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => {
                const p = Math.min(totalPages, page + 1);
                setPage(p);
                load(p, q);
              }}
              disabled={page >= totalPages || loading}
              className="h-9 rounded-md border px-3 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {modal.open && (
        <AdjustReferralModal
          attemptId={modal.attemptId}
          candidateName={modal.candidateName}
          onClose={() => setModal({ open: false, attemptId: null })}
          onSaved={() => {
            setModal({ open: false, attemptId: null });
            load(page, q);
          }}
        />
      )}
    </div>
  );
}

function AdjustReferralModal({ attemptId, candidateName, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [options, setOptions] = useState([]); // [{id,name,code,currencyCode,disabled?}]
  const [selected, setSelected] = useState(""); // id | "" for NONE

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch(`/api/admin/referrals/attempts/${attemptId}/eligible_agents`, {
          cache: "no-store",
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Failed to load agents");

        const { items = [], manualId = null, defaultId = null, currency } = j;

        // Base options from API (eligible agents)
        const opts = items.map((a) => ({
          id: a.id,
          name: a.name,
          code: a.code,
          currencyCode: a.currencyCode,
          disabled: false,
        }));

        // If there is a manual assignment but it isn't eligible (not in items),
        // show it anyway so the admin sees what's currently set.
        if (manualId && !opts.some((o) => o.id === manualId)) {
          opts.unshift({
            id: manualId,
            name: "Assigned agent (not eligible)",
            code: "—",
            currencyCode: currency || "",
            disabled: true,
          });
        }

        if (!cancelled) {
          setOptions(opts);
          // Preselect priority: manual → default → NONE
          setSelected(manualId || defaultId || "");
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || "Failed to load agents");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  async function save() {
    setErr("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/referrals/attempts/${attemptId}/assign_agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selected || null }), // "" => null (clear)
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Failed to save");
      onSaved?.(); // let parent reload list/row
      onClose?.();
    } catch (e) {
      setErr(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 pt-4">
          <h3 className="text-lg font-semibold text-black">Adjust Referral</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="px-5 space-y-2">
          <p className="text-sm text-gray-600 pb-4">
            Assign or change the referral agent for this test attempt by <span className="font-medium">{candidateName}</span>.
          </p>

          <label className="block text-sm font-bold text-black ">Referral Agent</label>

          {loading ? (
            <div className="rounded-lg border p-3 text-sm text-gray-600">Loading…</div>
          ) : (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-gray-900 focus:outline-black"
            >
              {/* NONE option */}
              <option value="">None</option>

              {options.map((o) => (
                <option key={o.id} value={o.id} disabled={!!o.disabled}>
                  {o.name} {o.code ? `(${o.code})` : ""} {o.currencyCode ? `– ${o.currencyCode}` : ""}
                  {o.disabled ? " – not eligible" : ""}
                </option>
              ))}
            </select>
          )}

          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-5">
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="rounded-md bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : `Save Changes`}
          </button>
        </div>
      </div>
    </div>
  );
}
