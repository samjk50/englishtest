"use client";
import { useEffect, useMemo, useState } from "react";
import { questionCreateSchema } from "@/lib/validation/question";
import { CirclePlus, CircleX } from "lucide-react";

const TAGS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function AddQuestionModal({
  open,
  onClose, // onClose(didSave?: boolean)
  onSaved, // optional
  mode = "create", // "create" | "edit"
  question, // when editing: { id, text, tag, allowMultiple, options: [{text,isCorrect,order}] }
}) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState("A1");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [options, setOptions] = useState([
    { text: "", isCorrect: false, order: 0 },
    { text: "", isCorrect: false, order: 1 },
  ]);
  const [errors, setErrors] = useState({});

  // hydrate when opening (supports edit & add)
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && question) {
      setText(question.text || "");
      setTag(question.tag || "A1");
      setAllowMultiple(!!question.allowMultiple);
      const opts = (question.options ?? []).sort((a, b) => a.order - b.order).map((o, i) => ({ text: o.text, isCorrect: !!o.isCorrect, order: i }));
      setOptions(
        opts.length
          ? opts
          : [
              { text: "", isCorrect: false, order: 0 },
              { text: "", isCorrect: false, order: 1 },
            ]
      );
      setErrors({});
    } else {
      // reset for create
      setText("");
      setTag("A1");
      setAllowMultiple(false);
      setOptions([
        { text: "", isCorrect: false, order: 0 },
        { text: "", isCorrect: false, order: 1 },
      ]);
      setErrors({});
    }
  }, [open, mode, question]);

  const validForSave = useMemo(() => {
    const parsed = questionCreateSchema.safeParse({ text, tag, allowMultiple, options });
    if (!parsed.success) return false;
    const correctCount = options.filter((o) => o.isCorrect).length;
    return allowMultiple ? correctCount >= 1 : correctCount === 1;
  }, [text, tag, allowMultiple, options]);

  const addOption = () => {
    if (options.length >= 8) return;
    setOptions((prev) => [...prev, { text: "", isCorrect: false, order: prev.length }]);
  };

  const setOption = (idx, patch) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };

  const removeOption = (idx) => {
    if (options.length <= 2) return;
    const next = options.filter((_, i) => i !== idx).map((o, i) => ({ ...o, order: i }));
    setOptions(next);
  };

  const toggleAllowMultiple = (v) => {
    setAllowMultiple(v);
    if (!v) {
      // force exactly one if currently multiple
      setOptions((prev) => {
        const first = prev.findIndex((o) => o.isCorrect);
        return prev.map((o, i) => ({ ...o, isCorrect: i === first && first >= 0 }));
      });
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const parsed = questionCreateSchema.safeParse({ text, tag, allowMultiple, options });
    if (!parsed.success) {
      setErrors(parsed.error.flatten());
      return;
    }
    setErrors({});

    const body = JSON.stringify(parsed.data);
    const url = mode === "edit" ? `/api/admin/questions/${question.id}` : "/api/admin/questions";
    const method = mode === "edit" ? "PUT" : "POST";

    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body });

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      alert(data?.error || "Failed to save");
      return;
    }
    onSaved?.();
    onClose?.(true); // tell parent it saved
  };

  if (!open) return null;

  const setSingleCorrect = (index) => setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrect: i === index })));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 text-gray-700">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl">
        <div className="flex items-center justify-between px-6 pt-4">
          <h2 className="text-lg font-semibold">{mode === "edit" ? "Edit Question" : "Add New Question"}</h2>
          <button onClick={() => onClose?.(false)} className="text-gray-500 hover:text-black">
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">Question Text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full border-gray-300 border-1 rounded px-3 py-2 text-black focus:outline-black"
              placeholder="Enter question…"
            />
            {errors?.fieldErrors?.text && <p className="text-red-600 text-sm mt-1">{errors.fieldErrors.text[0]}</p>}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-bold mb-1">Tag</label>
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="border-gray-300 border-1 rounded px-3 py-2 w-full focus:outline-black"
              >
                {TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold mb-1">Options</legend>
            {options.map((o, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {allowMultiple ? (
                  <input
                    type="checkbox"
                    className="accent-black w-4 h-4"
                    checked={o.isCorrect}
                    onChange={(e) => setOption(idx, { isCorrect: e.target.checked })}
                  />
                ) : (
                  <input type="radio" className="accent-black w-4 h-4" name="correct" checked={o.isCorrect} onChange={() => setSingleCorrect(idx)} />
                )}
                <input
                  value={o.text}
                  onChange={(e) => setOption(idx, { text: e.target.value })}
                  className="flex-1 border-gray-300 border-1 rounded px-3 py-2 focus:outline-black "
                  placeholder={`Option ${idx + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeOption(idx)}
                  className="px-2 py-1 text-red-600 disabled:opacity-50"
                  disabled={options.length <= 2}
                >
                  <CircleX size={18} />
                </button>
              </div>
            ))}
            <div className="pt-1">
              <button
                type="button"
                onClick={addOption}
                className="flex items-center gap-4 px-3 py-1.5 border-gray-300 border-1 rounded text-sm font-bold"
              >
                <CirclePlus size={15} /> <div>Add Option</div>
              </button>
            </div>
            {errors?.fieldErrors?.options && <p className="text-red-600 text-sm mt-1">{errors.fieldErrors.options[0]}</p>}
          </fieldset>

          <div className="flex-1 flex items-end">
            <label className="inline-flex items-center gap-2 font-bold">
              <input
                type="checkbox"
                className="accent-black w-4 h-4"
                checked={allowMultiple}
                onChange={(e) => toggleAllowMultiple(e.target.checked)}
              />
              Allow multiple correct answers
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => onClose?.(false)} className="px-4 py-2 border-gray-200 border-1 rounded">
              Cancel
            </button>
            <button type="submit" disabled={!validForSave} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">
              {mode === "edit" ? "Save Changes" : "Save Question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
