"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Search } from "lucide-react";

function Money({ cents = 0, currency = "USD" }) {
  const v = (Number(cents) || 0) / 100;
  return <span>{new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v)}</span>;
}

export default function CandidatesAnalyticsPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function load(p = page) {
    setLoading(true);
    setErr("");
    try {
      const u = new URLSearchParams({ page: String(p), pageSize: "10", search: q });
      const r = await fetch(`/api/admin/analytics/candidates?${u.toString()}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load");
      setRows(j.items || []);
      setTotalPages(j.totalPages || 1);
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1); // first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-black">Candidates</h1>

      <div className="mt-4">
        <div className="rounded-xl border-gray-200 border-1 bg-white p-4 mb-4">
          <div className="flex items-center gap-2 ">
            <Search color="#9CA3AF" size={20} />
            <input
              placeholder="Search by name or email..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(1)}
              className="w-full rounded-lg border-gray-200 focus:outline-black border-1 px-3 py-2 placeholder:text-gray-400 placeholder:text-sm text-black"
            />
          </div>
        </div>

        {err && <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>}

        {loading ? (
          <div className="text-center text-black p-6">Loading…</div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border-gray-200 border-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-2">Candidate</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Attempts</th>
                    <th className="px-4 py-2">Last Result</th>
                    <th className="px-4 py-2">Revenue</th>
                    <th className="px-4 py-2">Last Test Completed</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {!loading && rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        No candidates found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="align-top border-b border-b-gray-200">
                        <td className="px-4 py-3 text-black font-bold ">{r.name || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{r.email}</td>
                        <td className="px-4 py-3 text-gray-600">{r.attempts}</td>
                        <td className="px-4 py-3 text-gray-600">{r.lastResult || "—"}</td>
                        <td className="px-4 py-3 text-black font-bold">
                          <Money cents={r.revenueCents} />
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {r.lastCompletedAt ? new Date(r.lastCompletedAt).toLocaleDateString("en-US") : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => router.push(`/admin/analytics/candidates/${r.id}`)}
                            className="flex rounded gap-3 px-3 py-1.5 text-xs font-semibold text-black hover:bg-gray-100"
                          >
                            <Eye size={20} /> <div>View</div>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={() => load(Math.max(1, page - 1))}
                disabled={page <= 1 || loading}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => {
                  const p = Math.min(totalPages, page + 1);
                  setPage(p);
                  load(p);
                }}
                disabled={page >= totalPages || loading}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
