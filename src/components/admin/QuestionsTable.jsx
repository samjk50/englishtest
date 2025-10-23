"use client";

import { Filter, Pencil, Trash, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const TAGS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function QuestionsTable({ tag, page, loading, data, totalPages, fetchData, setModalState, setPage, setTag }) {
  const rows = useMemo(() => data ?? [], [data]);

  const onDelete = async (id) => {
    if (!confirm("Delete this question?")) return;
    const res = await fetch(`/api/admin/questions/${id}`, {
      method: "DELETE",
      credentials: "include", // <-- add this
    });
    if (res.ok) {
      fetchData();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Failed to delete");
    }
  };

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="mb-3 flex items-center bg-white p-2 rounded-md border-gray-200 border-1 px-4">
        <Filter size={18} className="mr-4" color="#6B7280" />
        <div className="flex items-center gap-2">
          <select
            value={tag}
            onChange={(e) => {
              setPage(1);
              setTag(e.target.value);
            }}
            className="h-9 rounded-md border-gray-300 border-1 bg-white px-2 text-sm text-gray-700 focus:outline-black w-40"
          >
            <option value="">All Tags</option>
            {TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table card (NO opacity here) */}
      <div className="border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-gray-600">
              <th className="px-4 py-3 font-bold">Question Text</th>
              <th className="px-4 py-3 font-bold w-28">Tag</th>
              <th className="px-4 py-3 font-bold w-36">Type</th>
              <th className="px-4 py-3 font-bold w-28 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-800">
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={4}>
                  No questions yet.
                </td>
              </tr>
            )}

            {rows.map((q, i) => (
              <tr key={q.id} className={i % 2 ? "bg-gray-50/30" : ""}>
                <td className="px-4 py-3 align-top font-bold">{q.text.length > 140 ? `${q.text.slice(0, 140)}…` : q.text}</td>
                <td className="px-4 py-3 align-top">
                  <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{q.tag}</span>
                </td>
                <td className="px-4 py-3 align-top">{q.allowMultiple ? "Multi-Select" : "Single-Select"}</td>
                <td className="px-4 py-3 align-top text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setModalState({ open: true, mode: "edit", question: q })}
                      className="text-indigo-600 hover:text-indigo-700"
                    >
                      <Pencil color="black" size={15} />
                    </button>
                    <button onClick={() => onDelete(q.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 color="red" size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-8 rounded-md border bg-white px-3 text-sm disabled:opacity-50 text-gray-600"
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-8 rounded-md border bg-white px-3 text-sm disabled:opacity-50 text-gray-600"
          >
            Next
          </button>
        </div>
      </div>

      {/* Non-dimming loading overlay (blocks clicks only) */}
      {loading && <div className="absolute inset-0 cursor-wait" aria-hidden />}
    </div>
  );
}
