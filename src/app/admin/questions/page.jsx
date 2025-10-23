"use client";
export const dynamic = "force-dynamic";

import AddQuestionModal from "@/components/admin/AddQuestionModal";
import QuestionsTable from "@/components/admin/QuestionsTable";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

export default function QuestionsPage() {
  const [modalState, setModalState] = useState({ open: false, mode: "create", question: null });
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setModalOpen] = useState(false);

  const pageSize = 10;

  useEffect(() => {
    fetchData();
  }, [tag, page]);
  const fetchData = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (tag) qs.set("tag", tag);
      qs.set("page", String(page));
      qs.set("pageSize", String(pageSize));

      const res = await fetch(`/api/admin/questions?${qs.toString()}`, {
        credentials: "include",
      });
      const json = await res.json();
      setData(json.items ?? []);
      setTotalPages(json.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = () => {
    setModalOpen(false); // close modal
    fetchData(); // refresh list
  };
  return (
    <main>
      <AddQuestionModal
        open={modalState.open}
        mode={modalState.mode}
        question={modalState.question}
        onClose={(didSave) => {
          setModalState((s) => ({ ...s, open: false }));
          if (didSave) fetchData();
        }}
        onSaved={handleSaved}
      />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Question Bank</h1>
        <button
          onClick={() => setModalState({ open: true, mode: "create", question: null })}
          className="flex items-center gap-2 h-9 rounded-md bg-black px-3 text-sm font-medium text-white focus:outline-none"
        >
          <Plus size={15} /> <div>Add Question</div>
        </button>
      </div>
      <QuestionsTable
        tag={tag}
        page={page}
        loading={loading}
        data={data}
        totalPages={totalPages}
        fetchData={fetchData}
        setModalState={setModalState}
        setPage={setPage}
        setTag={setTag}
      />
    </main>
  );
}
