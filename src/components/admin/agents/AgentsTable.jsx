"use client";

import { useEffect, useState } from "react";
import AddAgentModal from "./AddAgentModal";
import { Eye, Pencil, Trash, Trash2 } from "lucide-react";

function Money({ cents, currency = "USD" }) {
  const v = (Number(cents) || 0) / 100;
  return <span>{new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v)}</span>;
}

function StatusPill({ status = "ACTIVE" }) {
  const active = String(status).toUpperCase() === "ACTIVE";
  return (
    <span className={`rounded-full px-3 py-1 text-sm ${active ? "bg-black text-white" : "bg-red-100 text-red-700"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function AgentsTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/referral_agents");
      const json = await res.json();
      setData(json.items || []);
    } catch (e) {
      setErr("Failed to load agents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id) {
    if (!confirm("Delete this agent? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/referral_agents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setData((d) => d.filter((x) => x.id !== id));
    } catch (e) {
      alert("Failed to delete agent.");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-black">Referral Agents</h1>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="rounded-lg bg-black px-4 py-2 font-medium text-white hover:opacity-90"
        >
          + Add Agent
        </button>
      </div>

      {open && (
        <AddAgentModal
          open={open}
          onClose={() => setOpen(false)}
          agent={editing} // <-- pass agent if editing
          onSaved={(saved) => {
            // <-- unify create/update
            setOpen(false);
            setEditing(null);
            setData((d) => {
              const idx = d.findIndex((x) => x.id === saved.id);
              if (idx === -1) return [saved, ...d]; // created
              const copy = [...d]; // updated
              copy[idx] = { ...copy[idx], ...saved };
              return copy;
            });
          }}
        />
      )}

      {err && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>}
      {loading ? (
        <div className="rounded-lg p-6 text-black text-center">Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-xl shadow-md">
          <table className="min-w-full divide-y">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm font-semibold text-gray-600">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Referrals</th>
                <th className="px-6 py-3">Paid Tests</th>
                <th className="px-6 py-3">Commission %</th>
                <th className="px-6 py-3">Commission Earned</th>
                <th className="px-6 py-3">Commission Paid</th>
                <th className="px-6 py-3">Outstanding</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {data.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-6 py-4">
                    <div className="font-bold text-black">{a.name}</div>
                    <div className="text-sm font-bold text-[#6B7280]">{a.email}</div>
                  </td>
                  <td className="px-6 py-4 text-black">{a.referrals}</td>
                  <td className="px-6 py-4 text-black">{a.paidTests}</td>
                  <td className="px-6 py-4 text-black">{a.commissionPercent}%</td>
                  <td className="px-6 py-4 text-black">
                    <Money cents={a.commissionEarnedCents} currency={a.currencyCode} />
                  </td>
                  <td className="px-6 py-4 text-black">
                    <Money cents={a.commissionPaidCents} currency={a.currencyCode} />
                  </td>
                  <td className="px-6 py-4 text-black font-extrabold">
                    <Money cents={a.outstandingCents} currency={a.currencyCode} />
                  </td>
                  <td className="px-6 py-4 text-black">
                    <StatusPill status={a.status} />
                  </td>
                  <td className="px-3 py-6">
                    <div className="flex justify-between items-center text-gray-500">
                      <a href={`/admin/agents/${a.id}`} title="View" className="hover:text-black">
                        <Eye color="black" size={15}></Eye>
                      </a>
                      <button
                        onClick={() => {
                          setEditing(a);
                          setOpen(true);
                        }}
                        title="Edit"
                        className="hover:text-black"
                      >
                        <Pencil color="black" size={15} />
                      </button>
                      <button onClick={() => handleDelete(a.id)} title="Delete" className="hover:text-red-600">
                        <Trash2 color="red" size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-gray-500">
                    No agents yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
