"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, Sparkle, Sparkles, Trophy } from "lucide-react";

const TAGS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LABELS = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper-Intermediate",
  C1: "Advanced",
  C2: "Proficient",
};

export default function ResultPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/candidate/attempts/${id}/result`, { credentials: "include" });
      if (!r.ok) return router.push("/candidate");
      setData(await r.json());
    })();
  }, [id, router]);

  if (!data) return <main className="p-8 text-gray-600">Loading…</main>;

  const level = data.level;
  const subtitle = LABELS[level] || "";

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Decorative Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#585CC1] flex items-center justify-center">
            <Sparkles color="white" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-center mb-8">Your English Test Result is Ready!</h1>

        {/* Result Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mx-auto max-w-2xl">
          <p className="text-xs font-medium text-gray-500 text-center tracking-wide uppercase">YOUR LEVEL</p>
          <div className="text-6xl font-extrabold text-center mt-2 text-[#5C62C1]">{level}</div>
          <div className="text-center text-[#7A8090] font-medium mt-1 text-lg">{subtitle}</div>

          {/* Progress Ladder */}
          <div className="mt-8 flex items-center justify-between gap-1">
            {TAGS.map((t) => {
              const active = t === level;
              const before = TAGS.indexOf(t) <= TAGS.indexOf(level);
              return (
                <div key={t} className="flex-1">
                  <div className={`h-3 rounded-full ${before ? "bg-[#5E5FC3]" : "bg-gray-200"}`} />
                  <div className={`mt-2 text-xs text-center ${active ? "text-[#5E5FC3] font-semibold" : "text-gray-500"}`}>{t}</div>
                </div>
              );
            })}
          </div>

          {/* Description */}
          <div className="mt-6 rounded-xl bg-[#F7F8FC] p-4 text-sm text-gray-700 text-center">
            {level === "A1" &&
              "You can understand and use familiar everyday expressions and very basic phrases. Can introduce themselves and others and ask and answer simple questions about personal details (e.g., where they live, people they know, things they have). Can interact in a simple way if the other person talks slowly and clearly."}
            {level === "A2" &&
              "You can understand frequently used expressions related to areas of most immediate relevance (e.g., personal and family information, shopping, local geography, employment). Can communicate in simple and routine tasks requiring a simple and direct exchange of information. Can describe in simple terms aspects of their background, immediate environment and matters in areas of immediate need."}
            {level === "B1" &&
              "You can understand the main points of clear standard input on familiar matters such as work, school, leisure, etc. Can deal with most situations likely to arise while travelling. Can produce simple connected text on topics which are familiar or of personal interest. Can describe experiences, events, dreams, hopes and ambitions and briefly give reasons and explanations for opinions and plans."}
            {level === "B2" &&
              "You can understand the main ideas of complex text on both concrete and abstract topics, including technical discussions in their field of specialisation. Can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers quite possible without strain for either party. Can produce clear, detailed text on a wide range of subjects and explain a viewpoint on a topical issue giving the advantages and disadvantages of various options."}
            {level === "C1" &&
              "You can understand the main ideas of complex text on both concrete and abstract topics, including technical discussions in their field of specialisation. Can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers quite possible without strain for either party. Can produce clear, detailed text on a wide range of subjects and explain a viewpoint on a topical issue giving the advantages and disadvantages of various options."}
            {level === "C2" &&
              "You can understand with ease virtually everything heard or read. Can summarise information from different spoken and written sources, reconstructing arguments and accounts in a coherent presentation. Can express themselves spontaneously, very fluently and precisely, differentiating finer shades of meaning even in more complex situations."}
          </div>
        </div>

        {/* Next Actions Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-center mb-8">Next Actions</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Download Certificate Card */}
            <div className="bg-[#FAFBFD] border border-gray-200 rounded-2xl p-8 shadow-sm flex flex-col items-center">
              {/* Icon */}
              <div className="w-16 h-16 rounded-full bg-[#5E5FC3] flex items-center justify-center mb-4">
                <Download color="white" size={30} strokeWidth={2.5} />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-center mb-2">Download Certificate</h3>
              <p className="text-sm text-gray-600 text-center mb-6">Get your official PDF certificate with detailed results</p>

              {/* Button */}
              <button
                className="w-full bg-[#5E5FC3] text-white rounded-full py-3 px-6 font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                onClick={() => window.open(`/api/candidate/attempts/${id}/certificate.pdf`, "_blank")}
              >
                <Download color="white" size={20} />
                Download PDF Certificate
              </button>
            </div>

            {/* Retake Test Card */}
            <div className="bg-[#FAFBFD] border border-gray-200 rounded-2xl p-8 shadow-sm flex flex-col items-center">
              {/* Icon */}
              <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center mb-4">
                <Trophy color="white" size={30} />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-center mb-2">Retake Test</h3>
              <p className="text-sm text-gray-600 text-center mb-6">Additional attempts require payment</p>

              {/* Button */}
              <button
                className="w-full bg-white border-1 border-[#4C57BB] text-gray-900 rounded-full py-3 px-6 font-medium hover:bg-gray-50 transition-colors"
                onClick={() => router.push("/candidate")}
              >
                Retake Test
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
