"use client";
import { Camera, CircleCheckBig, Eye, EyeOff, File, Lock, Mail, Shield, Upload, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

// Password: 8+, one upper, one lower, one digit
const pwRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const RegisterSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required."),
    email: z.string().email("Enter a valid email address."),
    password: z.string().regex(pwRule, "Use 8+ chars with upper, lower & number."),
    confirmPassword: z.string(),
    phone: z.string().optional().or(z.literal("")),
    country: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

const EU_COUNTRIES = [
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czechia",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
  "United Kingdom",
  "Norway",
  "Iceland",
  "Liechtenstein",
  "Switzerland",
];

export default function AuthPage() {
  const [tab, setTab] = useState("login"); // 'login' | 'register'
  const [step, setStep] = useState(0); // 0: referral, 1: details, 2: verification

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className={`w-full ${tab === "login" ? "max-w-lg" : "max-w-2xl"}   rounded-2xl bg-white shadow-xl p-6 md:p-8`}>
        <header className="text-center mb-6">
          {tab === "login" ? (
            <>
              <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
              <p className="text-slate-600 mt-2">Enter your credentials to access your account</p>
            </>
          ) : (
            <>
              <div className="flex justify-center">
                <div className="flex items-center px-2">
                  {step === 0 ? (
                    <Mail strokeWidth={2.3} className="text-black" />
                  ) : step === 2 ? (
                    <Shield strokeWidth={2.3} className="text-black" />
                  ) : (
                    <User strokeWidth={2.3} className="text-black" />
                  )}
                </div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {step === 0 ? "Referral Code" : step === 1 ? "Create Your Account" : "Identity Verification"}
                </h1>
              </div>
              <p className="text-slate-600 mt-1">
                {step === 0
                  ? "Do you have a referral code? (Optional)"
                  : step === 1
                    ? "Enter your personal information to get started"
                    : "Upload your documents to verify your identity and complete registration"}
              </p>
            </>
          )}
        </header>

        {/* Tabs */}
        <div role="tablist" aria-label="Authentication" className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl mb-5">
          <button
            role="tab"
            aria-selected={tab === "login"}
            className={`py-2 rounded-lg text-sm font-semibold focus:outline-none  
                        ${tab === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-700"}`}
            onClick={() => setTab("login")}
          >
            Login
          </button>
          <button
            role="tab"
            aria-selected={tab === "register"}
            className={`py-2 rounded-lg text-sm font-semibold focus:outline-none  
                        ${tab === "register" ? "bg-white text-slate-900 shadow-sm" : "text-slate-700"}`}
            onClick={() => setTab("register")}
          >
            Register
          </button>
        </div>

        {tab === "login" ? <LoginForm /> : <RegisterWizard step={step} setStep={setStep} onSwitchToLogin={() => setTab("login")} />}
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(data.error || "Invalid email or password.");
        setLoading(false);
        return;
      }
      window.location.href = data.user?.role === "ADMIN" ? "/admin" : "/candidate";
    } catch (e) {
      setErr("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="border rounded-xl px-3 py-2 flex items-center gap-2 border-slate-200">
        <Mail className="size-4 text-slate-700 shrink-0" aria-hidden="true" />
        <input
          className="flex-1 outline-none text-slate-900 placeholder-slate-400 bg-transparent"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
        />
      </div>
      <div className="border rounded-xl px-3 py-2 flex items-center gap-2 border-slate-200">
        <Lock className="size-4 text-slate-700 shrink-0" aria-hidden="true" />
        <input
          className="flex-1 outline-none text-slate-900 placeholder-slate-400 bg-transparent"
          type={show ? "text" : "password"}
          required
          placeholder="••••••••"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          minLength={8}
          aria-label="Password"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="ml-1 text-slate-600 hover:text-slate-800"
        >
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      <button disabled={loading} className={`w-full bg-[#5E5FC3] font-bold text-white rounded-full py-3 mt-2 disabled:opacity-60`}>
        {loading ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}

// ---- Register wizard with Step 0 (Referral) ----
function RegisterWizard({ onSwitchToLogin, step, setStep }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    country: "",
    city: "",
  });

  const [referralCode, setReferralCode] = useState(""); // NEW

  const [errors, setErrors] = useState({});

  if (step === 0) {
    return (
      <ReferralStep0
        referralCode={referralCode}
        setReferralCode={setReferralCode}
        onContinue={() => setStep(1)}
        onSkip={() => {
          setReferralCode("");
          setStep(1);
        }}
      />
    );
  }

  if (step === 1) {
    return (
      <RegisterFormStep1
        form={form}
        errors={errors}
        setField={(k, v) => {
          setForm((s) => ({ ...s, [k]: v }));
          setErrors((e) => ({ ...e, [k]: "" }));
        }}
        onNext={() => {
          const res = RegisterSchema.safeParse(form);
          if (!res.success) {
            const f = res.error.flatten().fieldErrors;
            const out = {};
            for (const k in f) out[k] = f[k]?.[0] || "";
            setErrors(out);
            return;
          }
          setErrors({});
          setStep(2);
        }}
        onSwitchToLogin={onSwitchToLogin}
      />
    );
  }

  return <RegisterFormStep2 form={form} referralCode={referralCode} onBack={() => setStep(1)} />;
}

// ---- Step 0: Referral Code ----
function ReferralStep0({ referralCode, setReferralCode, onContinue, onSkip }) {
  const [checking, setChecking] = useState(false);
  const [valid, setValid] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [error, setError] = useState("");

  // Hard limit and pattern check (optional)
  const CODE_RE = /^AGENT[A-Z0-9]{6}$/;

  // Called only when user clicks Continue
  async function handleValidateAndContinue(e) {
    e.preventDefault();
    setError("");
    setValid(false);
    setAgentName("");

    const upper = referralCode.trim().toUpperCase();

    // Require exactly 11 characters
    if (upper.length !== 11) {
      setError("Referral code must be 11 characters long.");
      return;
    }

    setChecking(true);
    try {
      const r = await fetch("/api/candidate/referrals/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: upper }),
      });
      const data = await r.json().catch(() => ({}));

      if (data.valid) {
        setValid(true);
        setAgentName(data.agent?.name || "");
        // ✅ Only go to next step after successful validation
        onContinue();
      } else {
        setError("❌ Invalid referral code. Please check and try again.");
      }
    } catch {
      setError("Unable to validate code right now.");
    } finally {
      setChecking(false);
    }
  }

  const handleChange = (e) => {
    const val = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 11);
    setReferralCode(val);
    setError("");
    setValid(false);
    setAgentName("");
  };

  return (
    <form onSubmit={handleValidateAndContinue} className="space-y-5" noValidate>
      <div className="p-6">
        <label className="block text-sm font-bold text-black mb-1">Referral Code</label>

        <input
          className="w-full rounded-xl border p-3 placeholder:text-gray-500 placeholder:text-center text-black text-center focus:outline-black"
          value={referralCode}
          onChange={handleChange}
          placeholder="ENTER YOUR REFERRAL CODE (IF ANY)"
          inputMode="latin"
          autoCapitalize="characters"
          maxLength={11}
        />

        <div className="mt-2 text-center text-gray-600">Enter your referral code to get special benefits</div>

        {/* Validation result */}
        {valid && (
          <p className="mt-2 text-sm text-green-700">
            ✅ Valid referral code
            {agentName && (
              <>
                {" "}
                – linked to <span className="font-medium">{agentName}</span>
              </>
            )}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={checking || referralCode.length < 11}
          className={`mt-6 w-full rounded-full py-3 font-bold text-white ${
            referralCode.length === 11 && !checking ? "bg-[#5E5FC3]" : "bg-slate-300 cursor-not-allowed"
          }`}
        >
          {checking ? "Checking…" : "Continue"}
        </button>

        <button type="button" onClick={onSkip} className="mt-3 block w-full text-center text-md text-slate-700 font-extrabold">
          Skip – I don't have a referral code
        </button>
      </div>
    </form>
  );
}

function RegisterFormStep1({ form, setField, errors, onNext, onSwitchToLogin }) {
  const [verifying, setVerifying] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Cleanup if the component unmounts before the timer finishes
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (verifying) return; // guard against double submits
    setVerifying(true);

    // Simulate verifying delay
    timerRef.current = setTimeout(() => {
      setVerifying(false);
      onNext();
    }, 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <p className="text-black text-xs font-bold mb-[0.5rem]">Full Name *</p>
      <Field required placeholder="Enter your full name" value={form.fullName} onChange={(v) => setField("fullName", v)} error={errors.fullName} />

      <p className="text-black text-xs font-bold mb-[0.5rem]">Email Address *</p>
      <Field required type="email" placeholder="you@example.com" value={form.email} onChange={(v) => setField("email", v)} error={errors.email} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-black text-xs font-bold mb-[0.5rem]">Password *</p>
          <Field
            required
            type="password"
            placeholder="Password (8+, upper/lower/number)"
            value={form.password}
            onChange={(v) => setField("password", v)}
            error={errors.password}
          />
        </div>
        <div>
          <p className="text-black text-xs font-bold mb-[0.5rem]">Confirm Password *</p>
          <Field
            required
            type="password"
            placeholder="Confirm password"
            value={form.confirmPassword}
            onChange={(v) => setField("confirmPassword", v)}
            error={errors.confirmPassword}
          />
        </div>
      </div>

      <p className="text-black text-xs font-bold mb-[0.5rem]">Phone Number</p>
      <Field placeholder="+1 (555) 000-0000" value={form.phone} onChange={(v) => setField("phone", v)} error={errors.phone} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-black text-xs font-bold mb-[0.5rem]">Country</p>
          <Select
            placeholder="Select country"
            options={EU_COUNTRIES}
            value={form.country}
            onChange={(v) => setField("country", v)}
            error={errors.country}
          />
        </div>
        <div>
          <p className="text-black text-xs font-bold mb-[0.5rem]">City</p>
          <Field placeholder="Enter your city" value={form.city} onChange={(v) => setField("city", v)} error={errors.city} />
        </div>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={verifying}
          className={`w-full bg-[#5E5FC3] font-bold text-white rounded-full py-3 flex items-center justify-center gap-2
            ${verifying ? "opacity-60 cursor-not-allowed" : "hover:opacity-90 transition"}`}
        >
          {verifying ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Verifying…
            </>
          ) : (
            <>
              Continue to Verification
              <div className="flex items-center">
                <Shield size={15} />
              </div>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function RegisterFormStep2({ form, onBack, referralCode }) {
  const [selfie, setSelfie] = useState(null);
  const [idDoc, setIdDoc] = useState(null);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = !!selfie && !!idDoc && !!consent && !loading;

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!canSubmit) return;

    const fd = new FormData();
    // step-1 fields
    Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ""));
    // step-0 field (optional)
    if (referralCode) fd.append("referralCode", referralCode);
    // step-2 fields
    fd.append("selfie", selfie);
    fd.append("idDoc", idDoc);
    fd.append("consent", "true"); // MUST be the string "true"

    try {
      setLoading(true);
      const r = await fetch("/api/auth/register", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) {
        setErr(data?.error?.message || "Registration failed.");
        return;
      }
      window.location.href = "/candidate";
    } catch {
      setErr("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {/* Why do we need these documents? */}
      <div className="mt-4 rounded-xl border border-indigo-100 bg-[#EFF6FF] p-4">
        <h1 className="text-3xl font-bold text-[#1F40B3]">Why do we need these documents?</h1>
        <p className="mt-1 text-sm text-[#1F40B3]">
          Identity verification ensures the security of our platform and helps us comply with regulations. Your documents are encrypted and stored
          securely.
        </p>
      </div>

      {/* Upload cards */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-black mb-2 font-bold text-sm">Selfie Photo *</p>
          <UploadCard
            type="camera"
            label=""
            helper="Take a clear selfie holding your ID document"
            accept="image/jpeg,image/png,image/webp"
            file={selfie}
            onFile={setSelfie}
          />
        </div>
        <div>
          <p className="text-black mb-2 font-bold text-sm">ID Document *</p>

          <UploadCard
            type="doc"
            label=""
            helper="Upload passport, driver's license, or national ID"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            file={idDoc}
            onFile={setIdDoc}
          />
        </div>
      </div>

      {/* Consent */}
      <label className="mt-5 flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>
          I agree to the <span className="text-[#585CC0]">Terms of Service</span> and <span className="text-[#585CC0]">Privacy Policy</span>. I
          consent to the processing of my personal data for identity verification purposes.
        </span>
      </label>

      {err && <p className="text-red-600 text-sm">{err}</p>}
      <div>
        <div className="flex gap-2">
          <button type="button" onClick={onBack} className="px-3 py-3 rounded border border-[#5D5EC2] text-[#5D5EC2] font-bold rounded-2xl w-full">
            Back
          </button>
          <button
            disabled={!canSubmit}
            className={` px-3 py-3 rounded text-white font-bold rounded-2xl w-full ${
              canSubmit ? "bg-[#5D5EC2] font-bold" : "bg-slate-300 cursor-not-allowed"
            }`}
          >
            {loading ? (
              "Completing…"
            ) : (
              <div className="flex justify-center gap-2">
                Complete Registration
                <div className="flex items-center">
                  <CircleCheckBig size={15} />
                </div>
              </div>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

function UploadCard({ label, helper, accept, file, onFile, type }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    if (file.type === "application/pdf") return setPreview("PDF");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="rounded-xl border px-2 py-6 text-center border-dashed bg-[#FAFBFD]">
      {!file && (
        <div className="flex justify-center text-black">
          {type === "camera" ? <Camera size={40} strokeWidth={1.5} /> : <File size={40} strokeWidth={1.5} />}
        </div>
      )}

      <p className="text-sm font-medium text-slate-900">{label}</p>
      {!file && <p className="text-sm text-slate-600 p-1.5">{helper}</p>}

      {/* Preview */}
      {file && (
        <div className="mt-2 flex justify-center">
          {preview === "PDF" ? (
            <div className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm text-slate-700 w-[60%] ">
              <div className=" text-ellipsis overflow-hidden">📄 {file.name}</div>
            </div>
          ) : (
            <img src={preview} alt="Preview" className="h-28 w-full max-w-[120px] rounded-md object-cover border" />
          )}
        </div>
      )}

      {file && <p className="text-[#1C8E50] py-3 text-sm">File uploaded successfully </p>}

      <div className="mt-1">
        <label className="inline-flex items-center gap-3 rounded-xl border px-3 py-1.5 text-sm text-[#4753B8] hover:bg-slate-50 cursor-pointer">
          <Upload size={15} /> {file ? "Replace File" : "Select File"}
          <input type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
        </label>
      </div>
    </div>
  );
}

function FileBox({ label, onFile, accept = ".jpg,.jpeg,.png,.webp" }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-medium mb-2">{label}</p>
      <input type="file" accept={accept} onChange={(e) => onFile(e.target.files?.[0] || null)} />
      <p className="text-xs text-slate-500 mt-1">Accepted: JPG, PNG, WEBP (or PDF for ID). Max 5MB.</p>
    </div>
  );
}

function Field({ value, onChange, placeholder, type = "text", required = false, error = "" }) {
  return (
    <div>
      <div className={`border rounded-xl px-3 py-1.5 ${error ? "border-red-400" : "border-slate-300"}`}>
        <input
          className="w-full outline-none text-slate-900 placeholder-slate-400"
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
        />
      </div>
      {error ? <p className="text-red-600 text-xs mt-1">{error}</p> : null}
    </div>
  );
}

function Select({ value, onChange, placeholder, options, error = "" }) {
  return (
    <div>
      <div className={`border rounded-xl px-3 py-1.5 ${error ? "border-red-400" : "border-slate-300"}`}>
        <select className="w-full outline-none text-slate-900" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-red-600 text-xs mt-1">{error}</p> : null}
    </div>
  );
}
