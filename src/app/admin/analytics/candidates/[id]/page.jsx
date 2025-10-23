"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, DollarSign, FileChartColumnIncreasing, Globe, Mail, Phone, User } from "lucide-react";

function Money({ cents = 0, currency = "USD" }) {
  const v = (Number(cents) || 0) / 100;
  return <span>{new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v)}</span>;
}

function Card({ title, children, icon }) {
  return (
    <div className="rounded-md border-gray-200 border-1 bg-white p-5">
      <div className="flex justify-between">
        <div className="text-sm text-black font-bold">{title}</div>
        {icon}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function CandidateDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [totals, setTotals] = useState({ totalAttempts: 0, totalRevenueCents: 0 });
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`/api/admin/analytics/candidates/${id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load");
      setUser(j.user);
      setTotals(j.totals || {});
      setAttempts(j.attempts || []);
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="p-6">
      <button
        onClick={() => router.push("/admin/analytics/candidates")}
        className="flex items-center gap-4 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={18} color="black" />
        <div className="font-bold">Back to Candidates</div>
      </button>

      {loading ? (
        <div className="mt-6 p-6 text-black text-center">Loading…</div>
      ) : err ? (
        <div className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-red-600">{err}</div>
      ) : (
        <>
          {/* Header card */}
          <div className="flex gap-6 mt-4 rounded-2xl border-gray-200 border-1 bg-white p-5">
            <div className="flex items-center justify-center rounded-full w-20 h-20 bg-[#DBE9FE]">
              <User size={40} color="#2463EB" />
            </div>
            <div>
              <div className="text-2xl font-bold text-black">{user.fullName || "—"}</div>
              <div className="grid grid-cols-1 gap-80 text-sm text-gray-600 sm:grid-cols-2">
                <div className="flex items-center mt-1 text-gray-700 gap-2">
                  <Mail size={15} /> {user.email}
                </div>
                <div className="flex gap-1 items-center">
                  <Globe size={15} /> {user.country || "—"}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-80 text-sm text-gray-600 sm:grid-cols-2">
                <div className="flex items-center gap-1">
                  <Phone size={15} /> {user.phone || "—"}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar size={15} /> Registered: {new Date(user.createdAt).toLocaleDateString("en-US")}
                </div>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card title="Total Attempts" icon={<FileChartColumnIncreasing color="gray" size={20} />}>
              <div className="text-3xl font-bold text-black">{totals.totalAttempts || 0}</div>
            </Card>
            <Card title="Total Revenue" icon={<DollarSign color="gray" size={20} />}>
              <div className="text-3xl font-bold text-black">
                <Money cents={totals.totalRevenueCents || 0} />
              </div>
            </Card>
          </div>

          {/* Attempts History */}
          <div className="mt-8 rounded-md border-gray-200 border-1 bg-white">
            <div className="px-6 py-4">
              <h2 className="text-xl font-semibold text-black">Test Attempts History</h2>
            </div>
            <div className="px-6 py-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2">Date</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Result</th>
                    <th className="py-2">Amount Paid</th>
                    <th className="py-2">Sections</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">
                        No attempts yet.
                      </td>
                    </tr>
                  ) : (
                    attempts.map((a) => (
                      <tr key={a.id} className="border-t border-gray-200">
                        <td className="py-2 text-gray-500">{a.date ? new Date(a.date).toLocaleString() : "—"}</td>
                        <td className="py-2">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs capitalize text-gray-500">
                            {String(a.status || "").toLowerCase()}
                          </span>
                        </td>
                        <td className="py-2 text-gray-500">{a.result || "—"}</td>
                        <td className="py-2 text-gray-500">
                          <Money cents={a.amountCents} currency={a.currencyCode || "USD"} />
                        </td>
                        <td className="py-2">
                          {a.sections?.length
                            ? a.sections.map((s) => (
                                <span key={s.tag} className="mr-3 whitespace-nowrap text-xs text-gray-700">
                                  <span className="font-medium">{s.tag}</span>: {s.percent}%
                                </span>
                              ))
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
