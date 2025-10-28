"use client";

import { useEffect, useMemo, useState } from "react";
import { DollarSign, FileChartColumnIncreasing, RefreshCcw, TrendingUp, Users, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import "react-tooltip/dist/react-tooltip.css";
import { Tooltip as Hint } from "react-tooltip";

function Money({ cents = 0, currency = "USD" }) {
  const v = (Number(cents) || 0) / 100;
  return <span>{new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v)}</span>;
}

function Stat({ label, tooltiptext, children, icon }) {
  return (
    <div className="rounded-md border-gray-200 border-1 bg-white p-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm text-black font-bold">
          <span>{label}</span>
          <div>
            <Info size={15} data-tooltip-id="my-tooltip" data-tooltip-content={tooltiptext}></Info>
            <Hint id="my-tooltip" style={{ width: "15rem" }} />
          </div>
        </div>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-bold text-black">{children}</div>
    </div>
  );
}

function Bars({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 14 }} />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Bar dataKey="value" fill="#4285F4" barSize={50} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function SystemAnalyticsPage() {
  // filters
  const [days, setDays] = useState(30);
  const [useCustom, setUseCustom] = useState(false);
  const [start, setStart] = useState(""); // YYYY-MM-DD
  const [end, setEnd] = useState(""); // YYYY-MM-DD
  const [country, setCountry] = useState("ALL");
  const [currency, setCurrency] = useState("ALL");

  // data
  const [countries, setCountries] = useState(["ALL"]);
  const [currencies, setCurrencies] = useState(["ALL", "USD", "GBP", "INR", "NPR", "PKR"]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState({
    kpis: {
      testsPurchased: 0,
      revenueCents: 0,
      completionRatePct: 0,
      retakeRatePct: 0,
      activeCandidates: 0,
      newCandidatesJoined: 0,
    },
    sectionAverages: [],
    quickSummary: {
      totalTestsPurchased: 0,
      totalRevenueCents: 0,
      avgRevenuePerTestCents: 0,
      uniqueCandidates: 0,
      overallPassRatePct: 0,
      candidateRetakeRatePct: 0,
    },
    params: { supportedCurrencies: ["ALL", "USD", "GBP", "INR", "NPR", "PKR"] },
  });

  // fetch countries (simple endpoint of yours)
  async function loadCountries() {
    try {
      const r = await fetch("/api/admin/countries", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        const set = Array.isArray(j.countries) && j.countries.length ? ["ALL", ...j.countries] : ["ALL"];
        setCountries(set);
      }
    } catch {
      setCountries(["ALL"]);
    }
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const q = new URLSearchParams({ country, currency });
      if (useCustom && start && end) {
        q.set("start", start);
        q.set("end", end);
      } else {
        q.set("days", String(days));
      }
      const r = await fetch(`/api/admin/analytics/system?${q.toString()}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load analytics");
      setData(j);
      if (Array.isArray(j.params?.supportedCurrencies)) {
        setCurrencies(j.params.supportedCurrencies);
      }
    } catch (e) {
      setErr(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCountries();
  }, []);
  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [days, country, currency]);

  //Separated for date filter
  useEffect(() => {
    if (start && end) {
      load();
    }
  }, [start, end]);

  const bars = useMemo(() => (data.sectionAverages || []).map((s) => ({ label: s.tag, value: s.avgPercent || 0 })), [data.sectionAverages]);

  const moneyCurrency = currency !== "ALL" ? currency : "USD";

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-black">System Analytics</h1>
      <p className="text-gray-500">Comprehensive insights and performance metrics</p>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-black">By Country</span>
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

        <div className="flex items-center gap-2">
          <span className="text-sm text-black">Currency</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-md px-3 py-2 text-sm bg-white text-black focus:outline-black"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {!useCustom && (
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md px-3 py-2 text-sm bg-white text-black focus:outline-black"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        )}

        <label className="text-sm flex items-center gap-2 text-black">
          <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} />
          Custom date range
        </label>

        {useCustom && (
          <>
            <div className="flex flex-col">
              <label className="text-xs text-gray-600">Start</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-md px-3 py-2 text-sm bg-white text-black border"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-gray-600">End</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-md px-3 py-2 text-sm bg-white text-black border"
              />
            </div>
          </>
        )}
        {/* 
        <button
          onClick={load}
          className="ml-auto rounded-md border-gray-200 border-1 px-3 py-2 text-sm hover:bg-gray-50"
          title="Download a simple CSV of the headline KPIs"
        >
          Export CSV
        </button> */}
      </div>

      {loading ? (
        <div className="mt-4 p-3 text-sm text-gray-600 text-center">Loading…</div>
      ) : err ? (
        <div className="mt-4 p-3 text-sm text-red-600 border border-red-200 rounded">{err}</div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Stat
              label="Tests Purchased"
              hint="Total number of tests purchased within the selected window."
              icon={<FileChartColumnIncreasing size={15} color="gray" />}
              tooltiptext="Total number of tests purchased by both new and existing candidates within the given time frame."
            >
              {data.kpis.testsPurchased}
            </Stat>

            <Stat
              label="Revenue Generated"
              hint="Total revenue from purchased tests in the selected currency and window."
              icon={<DollarSign size={15} color="gray" />}
              tooltiptext="Total revenue of tests by both new and existing candidates within the given time frame."
            >
              <Money cents={data.kpis.revenueCents} currency={moneyCurrency} />
            </Stat>

            <Stat
              label="Completion Rate"
              hint="Percentage of purchased tests that were completed within the window."
              icon={<TrendingUp size={15} color="gray" />}
              tooltiptext="Percentage of purchased tests completed by candidates."
            >
              {data.kpis.completionRatePct}%
            </Stat>

            <Stat
              label="Retake Rate"
              hint="Among candidates who completed a test in the window, the percentage who completed 2+ tests in the same window."
              icon={<RefreshCcw size={15} color="gray" />}
              tooltiptext="Percentage of candidates who completed a test and chose to retake it."
            >
              {data.kpis.retakeRatePct}%
            </Stat>

            <Stat
              label="Active Candidates"
              hint="Number of candidates who completed at least one test in the window."
              icon={<Users size={15} color="gray" />}
              tooltiptext="Candidates who completed at least one test within the given time frame."
            >
              {data.kpis.activeCandidates}
            </Stat>

            <Stat
              label="New Candidates Joined"
              hint="Number of candidates who registered within the window."
              icon={<Users size={15} color="gray" />}
              tooltiptext="Number of candidates who joined the platform within the given time frame."
            >
              {data.kpis.newCandidatesJoined}
            </Stat>
          </div>

          {/* A1..C2 average bar chart + Quick Summary */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-md border-gray-200 border-1 bg-white p-5">
              <div className="mb-2 text-lg font-bold text-black">Average Scores by Section</div>
              <Bars data={bars} />
            </div>

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
                    <Money cents={data.quickSummary.totalRevenueCents} currency={moneyCurrency} />
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md px-3 py-2 border-gray-300 border-1 text-black">
                  <span>Average Revenue per Test</span>
                  <span className="font-semibold">
                    <Money cents={data.quickSummary.avgRevenuePerTestCents} currency={moneyCurrency} />
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
        </>
      )}
    </div>
  );
}
