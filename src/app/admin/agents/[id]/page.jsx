"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import RecordPayoutModal from "@/components/admin/agents/RecordPayoutModal";
import { ArrowLeft, Banknote, DollarSign, FileChartColumnIncreasing } from "lucide-react";

function Money({ cents = 0, currency = "USD" }) {
  const v = (Number(cents) || 0) / 100;
  return <span>{new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v)}</span>;
}

function StatCard({ label, value, currency, icon }) {
  return (
    <div className="rounded-lg border-1 border-[#EEEEF0] bg-white p-5">
      <div className="flex justify-between">
        <div className="text-sm text-black font-bold">{label}</div>
        {icon}
      </div>
      <div className="mt-2 text-3xl font-bold text-black">{label !== "Paid Tests" ? <Money cents={value} currency={currency} /> : value}</div>
    </div>
  );
}

export default function AgentDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [agent, setAgent] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [attempts, setAttempts] = useState({ items: [], page: 1, totalPages: 1 });
  const [payouts, setPayouts] = useState({ items: [], page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  async function load(aPage = attempts.page, pPage = payouts.page) {
    setLoading(true);
    setErr("");
    try {
      const q = new URLSearchParams({
        attemptsPage: String(aPage),
        attemptsPageSize: "10",
        payoutsPage: String(pPage),
        payoutsPageSize: "10",
      });
      const r = await fetch(`/api/admin/agents/${id}?${q.toString()}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load agent.");
      setAgent(j.agent);
      setMetrics(j.metrics);
      setAttempts(j.attempts);
      setPayouts(j.payouts);
    } catch (e) {
      setErr(e.message || "Failed to load agent.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const currency = metrics?.currencyCode || agent?.currencyCode || "USD";
  const outstandingCents = metrics?.outstandingCents || 0;

  return (
    <div className="p-6">
      <button onClick={() => router.push("/admin/referral_agents")} className="flex items-center gap-4 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft size={18} color="black" />
        <div className="font-bold">Back to All Agents</div>
      </button>

      {loading ? (
        <div className="mt-6 rounded-lg p-6 text-black text-center">Loading…</div>
      ) : err ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-red-600">{err}</div>
      ) : (
        <>
          <div className="mt-12 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-extrabold text-black">{agent.name}</h1>
              <div className="mt-1 text-gray-500">
                {agent.email} <span className="mx-1">/</span>{" "}
                <span className="bg-[#F4F4F5] text-sm font-bold text-black rounded-full px-4 py-0.5">{agent.code}</span>
              </div>
            </div>
            <button onClick={() => setOpen(true)} className="flex gap-4 rounded-lg text-sm font-bold bg-black px-4 py-2 text-white hover:opacity-90">
              $<div>Record a Payout</div>
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <StatCard
              label="Commission Earned"
              value={metrics.commissionEarnedCents}
              currency={currency}
              icon={<DollarSign color="#71717A" size={15} />}
            />
            <StatCard label="Commission Paid" value={metrics.commissionPaidCents} currency={currency} icon={<Banknote color="#71717A" size={15} />} />
            <StatCard label="Outstanding" value={metrics.outstandingCents} currency={currency} icon={<DollarSign color="#71717A" size={15} />} />
            <StatCard label="Paid Tests" value={metrics.paidTests} icon={<FileChartColumnIncreasing color="#71717A" size={15} />} />
          </div>

          {/* Referred Test Attempts */}
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded border bg-white">
              <div className="px-6 py-4">
                <h2 className="text-xl font-semibold text-black">Referred Test Attempts</h2>
              </div>
              <div className="px-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="py-2 text-[#717882]">Candidate</th>
                      <th className="py-2 text-[#717882]">Date</th>
                      <th className="py-2 text-[#717882]">Amount</th>
                      <th className="py-2 text-[#717882]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-500">
                          No referred attempts yet.
                        </td>
                      </tr>
                    ) : (
                      attempts.items.map((a) => (
                        <tr key={a.id} className="border-t">
                          <td className="py-2">
                            <div className="font-medium text-black">{a.candidate?.name || "—"}</div>
                            <div className="text-gray-500">{a.candidate?.email || ""}</div>
                          </td>
                          <td className="py-2 text-gray-500">{a.date ? new Date(a.date).toLocaleString() : "—"}</td>
                          <td className="py-2 text-gray-500">
                            <Money cents={a.amountCents} currency={a.currencyCode || currency} />
                          </td>
                          <td className="py-2 capitalize text-gray-500">
                            {String(a.status || "")
                              .replaceAll("_", " ")
                              .toLowerCase()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* attempts pagination */}
                <div className="mt-1 mb-6 flex justify-end gap-2">
                  <button
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    disabled={attempts.page <= 1}
                    onClick={() => load(attempts.page - 1, payouts.page)}
                  >
                    Prev
                  </button>
                  <button
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    disabled={attempts.page >= attempts.totalPages}
                    onClick={() => load(attempts.page + 1, payouts.page)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Payout History */}
            <div className="rounded border bg-white">
              <div className="px-6 py-4">
                <h2 className="text-xl font-semibold text-black">Payout History</h2>
              </div>
              <div className="px-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="py-2 text-[#717882]">Date</th>
                      <th className="py-2 text-[#717882]">Amount</th>
                      <th className="py-2 text-[#717882]">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.items.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-gray-500">
                          No payouts recorded.
                        </td>
                      </tr>
                    ) : (
                      payouts.items.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="py-2 text-gray-500">{new Date(p.createdAt).toLocaleString()}</td>
                          <td className="py-2 text-gray-500">
                            <Money cents={p.amountCents} currency={currency} />
                          </td>
                          <td className="py-2 text-gray-500">{p.notes || ""}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* payouts pagination */}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    disabled={payouts.page <= 1}
                    onClick={() => load(attempts.page, payouts.page - 1)}
                  >
                    Prev
                  </button>
                  <button
                    className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    disabled={payouts.page >= payouts.totalPages}
                    onClick={() => load(attempts.page, payouts.page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Modal */}
          {open && (
            <RecordPayoutModal
              open={open}
              onClose={() => setOpen(false)}
              agentId={agent.id}
              agentName={agent.name}
              currencyCode={currency}
              outstandingCents={outstandingCents}
              onRecorded={(m) => {
                setOpen(false);
                setMetrics(m);
                // refresh lists to show the new payout at top
                load(attempts.page, 1);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
