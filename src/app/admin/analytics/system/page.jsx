"use client";

import { DollarSign, FileChartColumnIncreasing, RefreshCcw, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function Money({ cents = 0, currency = "USD" }) {
  const v = (Number(cents) || 0) / 100;
  return <span>{new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v)}</span>;
}

function Stat({ label, children, icon }) {
  return (
    <div className="rounded-md border-gray-200 border-1 bg-white p-4">
      <div className="flex justify-between">
        <div className="text-sm  text-black font-bold">{label}</div>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-bold text-black ">{children}</div>
    </div>
  );
}

// super light bar "chart" (no deps)
function Bars({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 14 }} angle={0} textAnchor="middle" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Bar dataKey="value" fill="#4285F4" barSize={50} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function SystemAnalyticsPage() {
  const [days, setDays] = useState(30);
  const [countries, setCountries] = useState(["ALL"]); // filled after first load
  const [country, setCountry] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState({
    kpis: { testsPurchased: 0, revenueCents: 0, completionRatePct: 0, retakeRatePct: 0, activeCandidates: 0 },
    sectionAverages: [],
    quickSummary: {
      totalTestsPurchased: 0,
      totalRevenueCents: 0,
      avgRevenuePerTestCents: 0,
      uniqueCandidates: 0,
      overallPassRatePct: 0,
      candidateRetakeRatePct: 0,
    },
  });

  // get distinct countries once (for the filter)
  async function loadCountries() {
    // tiny helper endpoint (inline): reuse /api/admin/analytics/candidates search= — but we just pull from Users directly once here
    // To keep it zero-API, we’ll derive from the analytics call payload’s echo or do a separate fetch.
    // Here we do one light call to pull all distinct countries.
    try {
      const r = await fetch("/api/admin/analytics/candidates?search=&page=1&pageSize=1", { cache: "no-store" });
      // ignore content; we’ll fetch countries via a small ad-hoc call below to avoid paging
    } catch {}
    // Minimal dedicated query for distinct countries:
    try {
      const r = await fetch("/api/admin/countries", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        const set = Array.isArray(j.countries) && j.countries.length ? ["ALL", ...j.countries] : ["ALL"];
        setCountries(set);
      } else {
        setCountries(["ALL"]); // fallback
      }
    } catch {
      setCountries(["ALL"]);
    }
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const q = new URLSearchParams({ days: String(days), country });
      const r = await fetch(`/api/admin/analytics/system?${q.toString()}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load analytics");
      setData(j);
    } catch (e) {
      setErr(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // first load countries list; if you don’t wire /api/admin/countries, just remove this and keep a single “All” option
    loadCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, country]);

  const bars = useMemo(
    () =>
      (data.sectionAverages || []).map((s) => ({
        label: s.tag,
        value: s.avgPercent || 0,
      })),
    [data.sectionAverages]
  );

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-black">System Analytics</h1>
      <p className="text-gray-500">Comprehensive insights and performance metrics</p>
      {loading ? (
        <div className="mt-4  p-3 text-sm text-gray-600 text-center">Loading…</div>
      ) : (
        <div>
          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-black ">By Country</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="rounded-md px-3 py-2 text-sm bg-white text-black focus:outline-black"
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-md px-3 py-2 text-sm bg-white text-black focus:outline-black"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>

            {/* (Optional) Export CSV button could call this same endpoint and build a file client-side */}
            <button
              onClick={() => {
                const rows = [
                  ["Tests Purchased", data.kpis.testsPurchased],
                  ["Revenue (USD cents)", data.kpis.revenueCents],
                  ["Completion Rate (%)", data.kpis.completionRatePct],
                  ["Retake Rate (%)", data.kpis.retakeRatePct],
                  ["Active Candidates", data.kpis.activeCandidates],
                ];
                const csv = rows.map((r) => r.join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `system_analytics_${days}d_${country}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="ml-auto rounded-md border-gray-200 border-1 px-3 py-2 text-sm hover:bg-gray-50"
            >
              Export CSV
            </button>
          </div>

          {/* Stat cards */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-5">
            <Stat label="Tests Purchased" icon={<FileChartColumnIncreasing size={15} color="gray" />}>
              {data.kpis.testsPurchased}{" "}
            </Stat>
            <Stat label="Revenue Generated" icon={<DollarSign size={15} color="gray" />}>
              <Money cents={data.kpis.revenueCents} />
            </Stat>
            <Stat label="Completion Rate" icon={<TrendingUp size={15} color="gray" />}>
              {data.kpis.completionRatePct}%
            </Stat>
            <Stat label="Retake Rate" icon={<RefreshCcw size={15} color="gray" />}>
              {data.kpis.retakeRatePct}%
            </Stat>
            <Stat label="Active Candidates" icon={<Users size={15} color="gray" />}>
              {data.kpis.activeCandidates}
            </Stat>
          </div>

          {/* A1..C2 average bar chart */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border-gray-200 border-1 bg-white p-5">
              <div className="mb-2 text-lg font-bold text-black">Average Scores by Section</div>
              <Bars data={bars} />
            </div>

            {/* Quick Summary */}
            <div className="rounded-md bg-white p-5">
              <div className="mb-2 text-lg font-semibold text-black">Quick Summary</div>
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border-gray-300 border-1 text-black px-3 py-2">
                  <span>Total Tests Purchased</span>
                  <span className="font-semibold">{data.quickSummary.totalTestsPurchased}</span>
                </div>
                <div className="flex items-center justify-between rounded-md px-3 py-2 border-gray-300 border-1 text-black">
                  <span>Total Revenue</span>
                  <span className="font-semibold">
                    <Money cents={data.quickSummary.totalRevenueCents} />
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md px-3 py-2 border-gray-300 border-1 text-black">
                  <span>Average Revenue per Test</span>
                  <span className="font-semibold">
                    <Money cents={data.quickSummary.avgRevenuePerTestCents} />
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md px-3 py-2 border-gray-300 border-1 text-black">
                  <span>Unique Candidates</span>
                  <span className="font-semibold">{data.quickSummary.uniqueCandidates}</span>
                </div>
                <div className="flex items-center justify-between rounded-md px-3 py-2 border-gray-300 border-1 text-black">
                  <span>Candidate Retake Rate</span>
                  <span className="font-semibold">{data.quickSummary.candidateRetakeRatePct}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
