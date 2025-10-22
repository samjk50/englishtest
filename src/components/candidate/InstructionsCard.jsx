"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import InstructionsGridCard from "./InstructionsGridCard";

export default function InstructionsCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [durationMin, setDurationMin] = useState(null);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState("");

  // Stripe success redirect includes ?cs=...
  const checkoutSessionId = params.get("cs") || null;

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/candidate/test-settings", { credentials: "include" });
        const j = await r.json();
        setDurationMin(j.durationMin ?? 30);
      } catch {
        setDurationMin(30);
      }
    })();
  }, []);

  async function startNow() {
    setErr("");
    setStarting(true);
    try {
      const r = await fetch("/api/candidate/attempts/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutSessionId }), // 👈 tell backend which paid Attempt to start
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.attemptId) {
        setErr(j.error || "Could not start the test.");
        setStarting(false);
        return;
      }
      router.push(`/candidate/test/${j.attemptId}`);
    } catch {
      setErr("Could not start the test.");
      setStarting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto ">
      <div className="bg-white rounded-2xl shadow-2xl border-[#E4E9F1] border-1 p-8 md:p-10">
        <h1 className="text-3xl font-bold text-center mb-8">Test Instructions</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <InstructionsGridCard type={1} typeText={"Time Limit"} typeInformation={`${durationMin ?? "—"} minutes`} />
          <InstructionsGridCard type={2} typeText={"Questions"} typeInformation={"Multiple Choice"} />
        </div>

        <div className="mb-8">
          <h2 className="flex items-center text-4xl font-bold mb-4">
            <AlertTriangle className="mr-2" size={30} />
            Important Rules
          </h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start">
              <span className="ml-10 text-black mr-3">•</span>
              <span>
                The timer starts when you click <span className="font-medium">'Start Test'</span>.
              </span>
            </li>
            <li className="flex items-start">
              <span className="ml-10 text-black mr-3">•</span>
              <span>The timer will not stop if you close the window.</span>
            </li>
            <li className="flex items-start">
              <span className="ml-10 text-black mr-3">•</span>
              <span>Your answers are saved automatically.</span>
            </li>
            <li className="flex items-start">
              <span className="ml-10 text-black mr-3">•</span>
              <span>You can resume an in-progress test from your dashboard.</span>
            </li>
            <li className="flex items-start">
              <span className="ml-10 text-black mr-3">•</span>
              <span>The test will be auto-submitted when time runs out.</span>
            </li>
          </ul>
        </div>

        {err && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{err}</p>
          </div>
        )}

        <button
          onClick={startNow}
          disabled={starting || durationMin == null}
          className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white text-xl font-semibold py-4 rounded-full transition-colors duration-200"
        >
          {starting ? "Starting…" : "Start Test Now"}
        </button>
      </div>
    </div>
  );
}
