import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// PROCUREMENT CO-PILOT · TransformationX
// A configurable AI workbench. Buyers load THEIR templates, policies
// and category taxonomy once — every output is then shaped to the
// company they work for. Projects keep tenders organised; the library
// is the audit trail.
// ═══════════════════════════════════════════════════════════════

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
.f-display{font-family:'Space Grotesk',sans-serif}
.f-body{font-family:'Inter',sans-serif}
.out h1,.out h2,.out h3{font-family:'Space Grotesk',sans-serif;font-weight:600;color:#0a1428;margin-top:1.1em;margin-bottom:.4em}
.out h1{font-size:1.15rem;border-bottom:2px solid #1e1cb0;padding-bottom:.3em}
.out h2{font-size:1.05rem}.out h3{font-size:.95rem}
.out p{margin-bottom:.6em;line-height:1.65}
.out table{border-collapse:collapse;width:100%;margin:.8em 0;font-size:.82rem}
.out th{background:#0a1428;color:#fff;padding:7px 10px;text-align:left;font-weight:600}
.out td{border:1px solid #dde3ec;padding:6px 10px;vertical-align:top}
.out tr:nth-child(even) td{background:#f4f7fb}
.out ul,.out ol{margin:.5em 0 .8em 1.4em}.out li{margin-bottom:.35em;line-height:1.55}
.out strong{color:#0a1428}
.out blockquote{border-left:3px solid #1e1cb0;padding-left:12px;color:#475569;margin:.7em 0;font-style:italic}
.out code{background:#eef2f8;padding:1px 5px;border-radius:3px;font-size:.85em}
@keyframes pd{0%,100%{opacity:.3}50%{opacity:1}}
.td{animation:pd 1.2s infinite}.td:nth-child(2){animation-delay:.2s}.td:nth-child(3){animation-delay:.4s}
*{box-sizing:border-box}
::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}
`;

function md(t) {
  if (!t) return "";
  let h = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  h = h.replace(/((?:^\|.*\|\s*$\n?)+)/gm, (b) => {
    const rows = b.trim().split("\n").filter(r => r.trim());
    if (rows.length < 2) return b;
    let o = "<table>";
    rows.forEach((row, i) => {
      if (/^\|[\s\-:|]+\|$/.test(row.trim())) return;
      const cells = row.split("|").slice(1, -1).map(c => c.trim());
      const tag = i === 0 ? "th" : "td";
      o += "<tr>" + cells.map(c => `<${tag}>${c}</${tag}>`).join("") + "</tr>";
    });
    return o + "</table>";
  });
  h = h.replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>")
       .replace(/^# (.*)$/gm, "<h1>$1</h1>").replace(/^&gt; (.*)$/gm, "<blockquote>$1</blockquote>")
       .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>")
       .replace(/`(.+?)`/g, "<code>$1</code>");
  h = h.replace(/((?:^[-•] .*$\n?)+)/gm, (b) => "<ul>" + b.trim().split("\n").map(l => `<li>${l.replace(/^[-•] /, "")}</li>`).join("") + "</ul>");
  h = h.replace(/((?:^\d+\. .*$\n?)+)/gm, (b) => "<ol>" + b.trim().split("\n").map(l => `<li>${l.replace(/^\d+\. /, "")}</li>`).join("") + "</ol>");
  h = h.split(/\n{2,}/).map(s => /^<(h\d|ul|ol|table|blockquote)/.test(s.trim()) ? s : `<p>${s.replace(/\n/g, "<br/>")}</p>`).join("");
  return h;
}

async function callClaude(system, user, useSearch) {
  const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("API key not configured. Add REACT_APP_ANTHROPIC_API_KEY to your Vercel environment variables.");
  const body = { model: "claude-sonnet-4-6", max_tokens: 1100, system, messages: [{ role: "user", content: user }] };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-calls": "true" }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API ${r.status}`);
  const d = await r.json();
  return d.content.filter(b => b.type === "text").map(b => b.text).join("\n");
}

const store = {
  async get(k, fb) { try { const v = await window.storage.get(k); return v?.value ? JSON.parse(v.value) : fb; } catch { return fb; } },
  async set(k, val) { try { await window.storage.set(k, JSON.stringify(val)); } catch { /* degrade */ } },
};

const PC = { Strategise: "#a060d0", Source: "#1e1cb0", Evaluate: "#0a9fd8", Award: "#1a9e6e", Contract: "#c4621c", Manage: "#d04848", Anytime: "#64748b" };

const persona = (org, kb, tmpl) => `You are the Procurement Co-Pilot — a world-class procurement advisor embedded in a buyer's workflow, built by TransformationX. Deep GCC expertise: UAE federal procurement law, KSA LCGPA & IKTVA, Emiratisation, ICV, category management (Kraljic, 7-lever framework).
${org ? `\nORGANISATION CONTEXT (always honour):\n${org}\n` : ""}${kb ? `\nCOMPANY KNOWLEDGE BASE — policies & rules you MUST apply and cite:\n${kb}\n` : ""}${tmpl ? `\nCOMPANY TEMPLATE — output MUST follow this exact structure, headings and style:\n${tmpl}\n` : ""}
Rules:
- If a template is provided, mirror its structure exactly; else use best-practice structure.
- If a knowledge base is provided, every recommendation must comply with it and cite the relevant rule.
- Be specific and quantified — never generic filler. Use markdown tables.
- Flag assumptions. End with "⚠ Buyer attention required:" listing items needing human judgement.
- GCC defaults: AED/SAR, local content scoring, DOA thresholds.`;

const MODULES = [
  { id: "rfp", num: "01", name: "RFP Generator", icon: "📋", phase: "Source", tagline: "PR in → complete RFP package, in your template", templateSlot: "RFP template",
    fields: [
      { key: "title", label: "Procurement title", type: "text", placeholder: "e.g. Facilities Management — HQ Campus" },
      { key: "category", label: "Category", type: "catselect" },
      { key: "budget", label: "Budget envelope", type: "text", placeholder: "e.g. AED 4.5M over 3 years" },
      { key: "scope", label: "Scope from the PR", type: "textarea", placeholder: "Summarise the Purchase Requisition — what's needed, volumes, locations, duration, service levels…" },
      { key: "constraints", label: "Special requirements", type: "textarea-sm", optional: true, placeholder: "e.g. ICV min 40%, 24/7 helpdesk, 60-day transition" },
    ],
    btn: "Generate RFP package",
    task: `TASK: Generate a complete RFP package from the PR. Produce: 1) RFP Overview (title, ref, value, duration) 2) Scope of Work — measurable deliverables & category-specific SLAs 3) Bill of Quantities table 4) Technical Evaluation Criteria — weighted to 100%, OBJECTIVE & CATEGORY-SPECIFIC 5) Mandatory pass/fail gates 6) Commercial evaluation approach with local-content formula 7) Instructions to Bidders 8) Gaps in the PR to clarify before publishing.`,
    prompt: (f) => `Title: ${f.title}\nCategory: ${f.category}\nBudget: ${f.budget}\n\nPR/Scope:\n${f.scope}\n\nSpecial requirements:\n${f.constraints || "None"}` },

  { id: "tech", num: "02", name: "Technical Evaluation", icon: "🔬", phase: "Evaluate", tagline: "Score bids against criteria, audit-ready", templateSlot: "Evaluation report template",
    fields: [
      { key: "criteria", label: "Technical criteria (from the RFP)", type: "textarea", placeholder: "Paste the weighted criteria table…" },
      { key: "bids", label: "Supplier bid summaries", type: "textarea", placeholder: "Paste key content per supplier, separated by '---'…" },
    ],
    btn: "Run technical evaluation",
    task: `TASK: Preliminary technical evaluation. Produce: 1) Compliance Gate table (supplier × mandatory reqs, Pass/Fail + evidence) 2) Scoring Matrix (criterion×supplier, /10, weighted, 1-line evidence per cell) 3) 🔶 LOW CONFIDENCE flags where bid info was ambiguous 4) Preliminary ranking 5) Clarification questions per supplier. Penalise vague language; reward evidence. Scores must survive audit.`,
    prompt: (f) => `CRITERIA:\n${f.criteria}\n\nBIDS:\n${f.bids}` },

  { id: "comm", num: "03", name: "Commercial Evaluation", icon: "💰", phase: "Evaluate", tagline: "Weighted scoring with local content",
    fields: [
      { key: "weights", label: "Weightings & local-content rules", type: "textarea-sm", placeholder: "e.g. Technical 60% / Commercial 40%; ICV bonus up to 10%…" },
      { key: "tech", label: "Technical scores (Module 02)", type: "textarea-sm", placeholder: "e.g. A: 78, B: 85, C: 71" },
      { key: "prices", label: "Commercial submissions", type: "textarea", placeholder: "Per supplier: price, payment terms, ICV %, conditions. Separate with '---'" },
    ],
    btn: "Run commercial evaluation",
    task: `TASK: Commercial evaluation + combine with technical. Produce: 1) Price Normalisation table (as-submitted vs normalised; explain each adjustment) 2) Commercial scoring (lowest = full marks, pro-rata; show formula) 3) Local-content adjustment (before/after) 4) Combined ranking table (tech + commercial + LC = final) 5) Anomaly flags (abnormally low/incomplete/conditional) 6) Value-for-money narrative.`,
    prompt: (f) => `WEIGHTINGS:\n${f.weights}\n\nTECH SCORES:\n${f.tech}\n\nCOMMERCIAL:\n${f.prices}` },

  { id: "award", num: "04", name: "Award Brief", icon: "🏛️", phase: "Award", tagline: "Board-ready recommendation pack", templateSlot: "Award / board document template",
    fields: [
      { key: "summary", label: "Evaluation outcome", type: "textarea", placeholder: "Combined ranking & findings from Modules 02–03…" },
      { key: "value", label: "Contract value & duration", type: "text", placeholder: "e.g. AED 4.2M over 3 years (budget 4.5M)" },
      { key: "approver", label: "Approval authority", type: "select", options: ["Procurement Manager (< AED 500K)", "Procurement Director (< AED 2M)", "Tender Committee (< AED 10M)", "Board / GCEO (> AED 10M)"] },
    ],
    btn: "Generate award pack",
    task: `TASK: Award recommendation pack. Produce DOC A — Award Brief (1 page: recommendation, evaluation summary table, price vs budget, key terms). DOC B — Approval Document for the stated authority (exec summary, process summary, evaluation results, financial analysis with savings, top-3 risks + mitigations, local-content confirmation, approval request wording). Plus: Negotiation points — 3 specific BAFO asks if value can improve.`,
    prompt: (f) => `OUTCOME:\n${f.summary}\n\nVALUE: ${f.value}\nAPPROVER: ${f.approver}` },

  { id: "policy", num: "05", name: "Policy Checker", icon: "⚖️", phase: "Anytime", tagline: "Ask anything. Clause-level answers from your policy.", usesKB: true,
    fields: [
      { key: "question", label: "Your question or proposed action", type: "textarea", placeholder: "e.g. Can I extend a contract by 20% without re-tendering? / Single-source this AED 800K purchase — compliant?" },
    ],
    btn: "Check policy",
    task: `TASK: Policy & process compliance checker. Answer against the company knowledge base (if loaded) else GCC best practice. Produce: 1) Verdict — ✅ COMPLIANT / ❌ NON-COMPLIANT / 🔶 NEEDS CLARIFICATION (bold, first) 2) Policy Basis — cite specific clause from the KB, or named best-practice principle 3) Required steps 4) Risk if ignored 5) Compliant alternative if non-compliant. Direct, no hedging.`,
    prompt: (f) => `QUESTION / PROPOSED ACTION:\n${f.question}` },

  { id: "cat", num: "06", name: "Category Strategy", icon: "🧭", phase: "Strategise", tagline: "7-lever analysis from your spend + live market data", useSearch: true, templateSlot: "Category strategy template",
    fields: [
      { key: "category", label: "Category", type: "text", placeholder: "e.g. IT Hardware, Facilities Management, Road Freight" },
      { key: "spend", label: "Spend & supplier data", type: "textarea", placeholder: "Annual spend, top suppliers & share, # suppliers, price trend…" },
      { key: "context", label: "Business context", type: "textarea-sm", placeholder: "e.g. Volume +20% next year; incumbent expires Q4; CFO wants 10% savings" },
    ],
    btn: "Develop category strategy",
    task: `TASK: Category strategy using web search for current market intelligence. Produce: 1) Internal Analysis (Pareto, dependency, price trend) 2) External Analysis (market structure, price outlook, GCC players — cite searches) 3) Kraljic Positioning with rationale 4) 7-Lever Opportunity Map table (each lever × opportunity × impact H/M/L × effort) 5) Strategy Recommendation — 3 priority initiatives, quantified savings, 12-month roadmap 6) 4-5 KPIs.`,
    prompt: (f) => `CATEGORY: ${f.category}\n\nSPEND DATA:\n${f.spend}\n\nCONTEXT:\n${f.context}` },

  { id: "contract", num: "07", name: "Contract Drafting", icon: "✍️", phase: "Contract", tagline: "Terms in → draft + risk flags, your clause library", templateSlot: "Contract / FWA / PO template",
    fields: [
      { key: "type", label: "Contract type", type: "select", options: ["Services Agreement", "Framework Agreement (FWA)", "Purchase Order (Goods)", "Consultancy Agreement", "Maintenance Contract", "Supply Agreement"] },
      { key: "terms", label: "Negotiated terms", type: "textarea", placeholder: "Parties, value, duration, payment terms, deliverables/SLAs, special conditions…" },
      { key: "counter", label: "Supplier counter-positions", type: "textarea-sm", optional: true, placeholder: "Clauses the supplier pushed back on…" },
    ],
    btn: "Draft contract structure",
    task: `TASK: Contract drafting pack (structure + key clauses; flag legal review mandatory). Produce: 1) Contract Structure — numbered clause list 2) Key Clauses drafted (Scope, Price & Payment, Term & Termination, SLA/KPI & Remedies, Liability & Indemnity) populated with terms 3) Risk Flag table (clause, risk, recommended position, fallback) 4) Counter-Position analysis if provided (Accept/Reject/Counter + reasoning) 5) Mandatory clause checklist. End: "📌 Requires legal review before execution."`,
    prompt: (f) => `TYPE: ${f.type}\n\nTERMS:\n${f.terms}\n\nCOUNTER-POSITIONS:\n${f.counter || "None"}` },

  { id: "manage", num: "08", name: "Contract Management", icon: "📡", phase: "Manage", tagline: "Live register → alerts, performance, renewals",
    fields: [
      { key: "register", label: "Contract register", type: "textarea", persist: true, placeholder: "One per line: Supplier | Contract | Value | Start | End | KPIs | Performance notes" },
      { key: "focus", label: "Focus question", type: "text", optional: true, placeholder: "e.g. What needs attention this month? / Should we renew the FM contract?" },
    ],
    btn: "Analyse portfolio",
    task: `TASK: Contract management radar (today is mid-2026). Produce: 1) Portfolio Dashboard table (contract, value, expiry, days remaining, 🔴<90d/🟡<180d/🟢) 2) Performance Watchlist (below-KPI, gap quantified) 3) Prioritised Action List (renewals — re-tender needs 4-6mo lead, interventions, expiry risks) 4) Renewal Recommendations (Renew/Renegotiate/Re-tender + rationale) 5) If focus question asked, answer first under "Direct Answer".`,
    prompt: (f) => `REGISTER:\n${f.register}\n\nFOCUS: ${f.focus || "General review"}` },
];

const PHASES = ["Strategise", "Source", "Evaluate", "Award", "Contract", "Manage", "Anytime"];

const DEFAULT_CATEGORIES = [
  "Facilities Management", "IT Services", "IT Hardware", "Software & SaaS", "Professional Services",
  "Construction & Fit-out", "Logistics & Freight", "Fleet & Transport", "Marketing & Media",
  "HR & Manpower Supply", "MRO & Spares", "Utilities & Energy", "Travel & Events", "Security Services",
  "Catering & Hospitality", "Medical & Lab Supplies", "Office Supplies", "Telecom", "Insurance", "Other",
];

async function loadMammoth() {
  if (window.mammoth) return window.mammoth;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
    s.onload = () => resolve(window.mammoth);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function extractFileText(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "txt" || ext === "md") {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = rej;
      r.readAsText(file);
    });
  }
  if (ext === "docx") {
    const mammoth = await loadMammoth();
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawValue({ arrayBuffer: buf });
    return result.value;
  }
  if (ext === "pdf") {
    const pdfjsLib = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(s => s.str).join(" ") + "\n";
    }
    return text.trim();
  }
  throw new Error(`Unsupported file type: .${ext}`);
}

export default function App() {
  const [view, setView] = useState("module");
  const [active, setActive] = useState("rfp");
  const [inputs, setInputs] = useState({});
  const [outputs, setOutputs] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const [orgProfile, setOrgProfile] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [templates, setTemplates] = useState({});
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [savedOutputs, setSavedOutputs] = useState([]);

  const [uploadStatus, setUploadStatus] = useState({});
  const fileInputRefs = useRef({});
  const outRef = useRef(null);
  const mod = MODULES.find(m => m.id === active);

  const handleFileUpload = async (moduleId, file) => {
    if (!file) return;
    setUploadStatus(p => ({ ...p, [moduleId]: "reading" }));
    try {
      const text = await extractFileText(file);
      saveTemplate(moduleId, text);
      setUploadStatus(p => ({ ...p, [moduleId]: "done" }));
      setTimeout(() => setUploadStatus(p => ({ ...p, [moduleId]: null })), 2500);
    } catch (e) {
      setUploadStatus(p => ({ ...p, [moduleId]: "error: " + e.message }));
    }
  };

  useEffect(() => { (async () => {
    setOrgProfile(await store.get("cp-org", ""));
    setKnowledgeBase(await store.get("cp-kb", ""));
    setTemplates(await store.get("cp-templates", {}));
    setCategories(await store.get("cp-categories", DEFAULT_CATEGORIES));
    setProjects(await store.get("cp-projects", []));
    setActiveProject(await store.get("cp-active-project", null));
    setSavedOutputs(await store.get("cp-library", []));
    setInputs(await store.get("cp-persist-inputs", {}));
  })(); }, []);

  const setField = (key, val) => setInputs(p => ({ ...p, [`${mod.id}.${key}`]: val }));
  const getField = (key) => inputs[`${mod.id}.${key}`] || "";

  const saveOrg = (v) => { setOrgProfile(v); store.set("cp-org", v); };
  const saveKB = (v) => { setKnowledgeBase(v); store.set("cp-kb", v); };
  const saveTemplate = (id, v) => { const n = { ...templates, [id]: v }; setTemplates(n); store.set("cp-templates", n); };
  const saveCategories = (v) => { setCategories(v); store.set("cp-categories", v); };
  const addProject = (name) => { if (!name) return; const n = [...projects, name]; setProjects(n); store.set("cp-projects", n); setActiveProject(name); store.set("cp-active-project", name); };

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const fv = {}; mod.fields.forEach(f => fv[f.key] = getField(f.key));
      const missing = mod.fields.filter(f => !f.optional && !fv[f.key]);
      if (missing.length) { setError(`Fill in: ${missing.map(f => f.label).join(", ")}`); setLoading(false); return; }
      const sys = persona(orgProfile, knowledgeBase, mod.templateSlot ? templates[mod.id] : "") + "\n\n" + mod.task;
      const result = await callClaude(sys, mod.prompt(fv), mod.useSearch);
      setOutputs(p => ({ ...p, [mod.id]: result }));
      const pi = { ...inputs };
      store.set("cp-persist-inputs", Object.fromEntries(Object.entries(pi).filter(([k]) =>
        MODULES.some(m => m.fields.some(f => f.persist && `${m.id}.${f.key}` === k)))));
      setTimeout(() => outRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) { setError("The Co-Pilot hit a snag — try again or shorten the input. (" + e.message + ")"); }
    setLoading(false);
  };

  const copyOut = () => {
    const t = outputs[mod.id]; if (!t) return;
    const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); document.body.removeChild(ta); setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  const saveToLibrary = () => {
    const t = outputs[mod.id]; if (!t) return;
    const entry = { id: Date.now(), module: mod.name, icon: mod.icon, project: activeProject || "Unfiled",
      title: getField("title") || getField("category") || mod.name, date: new Date().toLocaleDateString("en-AE"), content: t };
    const n = [entry, ...savedOutputs].slice(0, 100); setSavedOutputs(n); store.set("cp-library", n);
  };

  const configReady = [orgProfile, knowledgeBase].filter(Boolean).length;
  const templateCount = Object.values(templates).filter(Boolean).length;

  const renderField = (f) => {
    const common = { value: getField(f.key), onChange: e => setField(f.key, e.target.value), placeholder: f.placeholder };
    const st = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d7dfeb", fontSize: 13, fontFamily: "Inter", background: "#fbfcfe", color: "#0a1428" };
    if (f.type === "select") return <select {...common} style={st}><option value="">Select…</option>{f.options.map(o => <option key={o}>{o}</option>)}</select>;
    if (f.type === "catselect") return <select {...common} style={st}><option value="">Select category…</option>{categories.map(o => <option key={o}>{o}</option>)}</select>;
    if (f.type === "text") return <input {...common} style={st} />;
    return <textarea {...common} rows={f.type === "textarea-sm" ? 3 : 7} style={{ ...st, resize: "vertical", lineHeight: 1.5 }} />;
  };

  return (
    <div className="f-body" style={{ display: "flex", height: "100vh", background: "#f4f6fa", color: "#0a1428" }}>
      <style>{FONTS}</style>

      {/* SIDEBAR */}
      <div style={{ width: 256, background: "#050a14", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid #101a2c" }}>
          <img src="/logo.png" alt="TransformationX" style={{ height: 32, display: "block", marginBottom: 8 }} />
          <div className="f-display" style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
            Procurement<span style={{ color: "#1e1cb0" }}> Co-Pilot</span>
          </div>
        </div>

        <div style={{ padding: "12px 14px", borderBottom: "1px solid #101a2c" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3a4a64", marginBottom: 6 }}>Active Project</div>
          <select value={activeProject || ""} onChange={e => { setActiveProject(e.target.value || null); store.set("cp-active-project", e.target.value || null); }}
            style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: "1px solid #1a2a44", background: "#0d1626", color: "#cdd8e8", fontSize: 12, fontFamily: "Inter" }}>
            <option value="">No project</option>{projects.map(p => <option key={p}>{p}</option>)}
          </select>
          <button onClick={() => { const n = prompt("New project name (e.g. 'FM Tender 2026 — ADNOC'):"); if (n) addProject(n); }}
            style={{ marginTop: 6, width: "100%", padding: "6px", borderRadius: 7, border: "1px dashed #1a2a44", background: "transparent", color: "#5a7090", fontSize: 11, cursor: "pointer", fontFamily: "Inter" }}>+ New project</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
          {PHASES.filter(ph => MODULES.some(m => m.phase === ph)).map(phase => (
            <div key={phase} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: PC[phase], padding: "0 8px 4px" }}>{phase}</div>
              {MODULES.filter(m => m.phase === phase).map(m => (
                <button key={m.id} onClick={() => { setActive(m.id); setView("module"); setError(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: active === m.id && view === "module" ? "#1e1cb018" : "transparent",
                    borderLeft: active === m.id && view === "module" ? `3px solid ${PC[phase]}` : "3px solid transparent", textAlign: "left", marginBottom: 1 }}>
                  <span style={{ fontSize: 15 }}>{m.icon}</span>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: active === m.id && view === "module" ? "#fff" : "#8aa0c0" }}>{m.name}</div>
                  {outputs[m.id] && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#1a9e6e" }} />}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid #101a2c", padding: "10px" }}>
          {[
            { id: "templates", icon: "📐", label: "Templates", badge: templateCount || null },
            { id: "knowledge", icon: "📚", label: "Knowledge Base", badge: configReady ? "✓" : null },
            { id: "library", icon: "🗂️", label: "Output Library", badge: savedOutputs.length || null },
            { id: "settings", icon: "⚙️", label: "Setup", badge: null },
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                background: view === item.id ? "#1e1cb018" : "transparent", textAlign: "left", marginBottom: 1 }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: view === item.id ? "#fff" : "#8aa0c0" }}>{item.label}</span>
              {item.badge != null && <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "#1e1cb0", background: "#1e1cb020", borderRadius: 10, padding: "1px 7px" }}>{item.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!configReady && view === "module" && (
          <div style={{ background: "#fff7ed", borderBottom: "1px solid #fed7aa", padding: "8px 28px", fontSize: 12, color: "#9a3412", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>⚡ Make every output yours:</span>
            <button onClick={() => setView("knowledge")} style={{ background: "#c4621c", color: "#fff", border: "none", borderRadius: 6, padding: "4px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Load your policies</button>
            <button onClick={() => setView("templates")} style={{ background: "transparent", color: "#9a3412", border: "1px solid #fdba74", borderRadius: 6, padding: "4px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Add your templates</button>
            <span style={{ color: "#c2854f" }}>— or start now with GCC best-practice defaults.</span>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "26px 32px" }}>
          <div style={{ maxWidth: 1060, margin: "0 auto" }}>

            {view === "module" && (<>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: `${PC[mod.phase]}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23 }}>{mod.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <h1 className="f-display" style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>{mod.name}</h1>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 12, background: `${PC[mod.phase]}14`, color: PC[mod.phase], textTransform: "uppercase", letterSpacing: "0.06em" }}>{mod.phase}</span>
                    {mod.useSearch && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 12, background: "#fef3e2", color: "#c47a1e" }}>🌐 live web data</span>}
                    {mod.templateSlot && templates[mod.id] && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 12, background: "#dcfce7", color: "#15803d" }}>📐 your template</span>}
                    {(mod.usesKB || mod.id === "policy") && knowledgeBase && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 12, background: "#e0e7ff", color: "#4338ca" }}>📚 your policies</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>{mod.tagline}</div>
                </div>
              </div>

              {mod.templateSlot && !templates[mod.id] && (
                <div style={{ background: "#f1f5fd", border: "1px solid #dbe5f5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#475569", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span>💡 No <strong>{mod.templateSlot}</strong> loaded — output uses best-practice structure. Load yours to match your company format exactly.</span>
                  <button onClick={() => setView("templates")} style={{ background: "#1e1cb0", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Add template</button>
                </div>
              )}

              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f2", padding: "22px 24px", marginBottom: 18 }}>
                {mod.fields.map(f => (
                  <div key={f.key} style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                      {f.label}{f.optional && <span style={{ fontWeight: 400, color: "#94a3b8" }}> · optional</span>}{f.persist && <span style={{ fontWeight: 400, color: "#94a3b8" }}> · saved</span>}
                    </label>
                    {renderField(f)}
                  </div>
                ))}
                {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#b91c1c", marginBottom: 14 }}>{error}</div>}
                <button onClick={run} disabled={loading}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, background: loading ? "#94a3b8" : "#1e1cb0", color: "#fff", border: "none", borderRadius: 9, padding: "11px 22px", fontSize: 13.5, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: "Inter", boxShadow: loading ? "none" : "0 2px 8px rgba(10,111,240,0.3)" }}>
                  {loading ? (<><span className="td" style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} /><span className="td" style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} /><span className="td" style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} /><span style={{ marginLeft: 4 }}>Working{mod.useSearch ? " — researching market" : ""}…</span></>) : (<>✦ {mod.btn}</>)}
                </button>
              </div>

              {outputs[mod.id] && (
                <div ref={outRef} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f2", overflow: "hidden", marginBottom: 30 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", background: "#0a1428" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1a9e6e" }} />
                      <span className="f-display" style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Output — {mod.name}{activeProject ? ` · ${activeProject}` : ""}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={saveToLibrary} style={{ background: "#1a2a44", color: "#fff", border: "none", borderRadius: 7, padding: "6px 13px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>＋ Save to library</button>
                      <button onClick={copyOut} style={{ background: copied ? "#1a9e6e" : "#1a2a44", color: "#fff", border: "none", borderRadius: 7, padding: "6px 13px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>{copied ? "✓ Copied" : "Copy"}</button>
                    </div>
                  </div>
                  <div className="out" style={{ padding: "20px 26px", fontSize: 13.5, color: "#1e293b", maxHeight: 560, overflowY: "auto" }} dangerouslySetInnerHTML={{ __html: md(outputs[mod.id]) }} />
                </div>
              )}
            </>)}

            {view === "templates" && (
              <div>
                <h1 className="f-display" style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Templates</h1>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 22, maxWidth: 640 }}>Upload or paste your company templates. The Co-Pilot shapes every output to match your exact structure — so what comes out is ready for your process, not reformatted from scratch.</p>
                {MODULES.filter(m => m.templateSlot).map(m => {
                  const status = uploadStatus[m.id];
                  return (
                  <div key={m.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f2", padding: "18px 20px", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 18 }}>{m.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{m.templateSlot}</div>
                        <div style={{ fontSize: 11.5, color: "#94a3b8" }}>Used by {m.name}</div>
                      </div>
                      {templates[m.id]
                        ? <span style={{ fontSize: 10.5, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "3px 10px", borderRadius: 12 }}>✓ Loaded</span>
                        : <span style={{ fontSize: 10.5, fontWeight: 600, color: "#94a3b8" }}>Not set</span>}
                    </div>

                    {/* File upload drop zone */}
                    <div
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); handleFileUpload(m.id, e.dataTransfer.files[0]); }}
                      onClick={() => fileInputRefs.current[m.id]?.click()}
                      style={{ border: "2px dashed #c7d3e8", borderRadius: 10, padding: "16px 20px", marginBottom: 12, cursor: "pointer", background: "#f8fafd", display: "flex", alignItems: "center", gap: 14, transition: "border-color 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "#1e1cb0"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "#c7d3e8"}
                    >
                      <div style={{ fontSize: 26 }}>📎</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                          {status === "reading" ? "⏳ Extracting text…"
                            : status === "done" ? "✅ Template extracted successfully"
                            : status?.startsWith("error") ? `❌ ${status}`
                            : "Upload template file"}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>PDF, Word (.docx), or plain text — drag & drop or click to browse</div>
                      </div>
                      <input
                        ref={el => fileInputRefs.current[m.id] = el}
                        type="file"
                        accept=".pdf,.docx,.txt,.md"
                        style={{ display: "none" }}
                        onChange={e => handleFileUpload(m.id, e.target.files[0])}
                      />
                    </div>

                    {/* Manual paste fallback */}
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Or paste directly</div>
                    <textarea value={templates[m.id] || ""} onChange={e => saveTemplate(m.id, e.target.value)}
                      placeholder={`Paste your ${m.templateSlot.toLowerCase()} — section headings, standard clauses, table structures, boilerplate.`}
                      rows={templates[m.id] ? 6 : 3}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d7dfeb", fontSize: 12.5, fontFamily: "Inter", background: "#fbfcfe", color: "#0a1428", resize: "vertical", lineHeight: 1.5 }} />
                    {templates[m.id] && (
                      <button onClick={() => saveTemplate(m.id, "")} style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>✕ Clear template</button>
                    )}
                  </div>
                  );
                })}
              </div>
            )}

            {view === "knowledge" && (
              <div>
                <h1 className="f-display" style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Knowledge Base</h1>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 22, maxWidth: 640 }}>The company brain. Load it once and every module applies it — the Policy Checker answers from it, evaluations respect your thresholds, awards cite your DOA. Update as policies change.</p>
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f2", padding: "18px 20px", marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🏢 Organisation Profile</div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 10 }}>Who you're buying for — sector, scale, jurisdiction, standing context.</div>
                  <textarea value={orgProfile} onChange={e => saveOrg(e.target.value)} rows={4}
                    placeholder="e.g. UAE federal government entity. Procurement follows Federal Procurement Law. ICV certificates required above AED 1M. Preference for SME and Emirati-owned suppliers. Approvals: Manager <500K, Director <2M, Tender Committee <10M, Board above."
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d7dfeb", fontSize: 12.5, fontFamily: "Inter", background: "#fbfcfe", color: "#0a1428", resize: "vertical", lineHeight: 1.5 }} />
                </div>
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f2", padding: "18px 20px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📚 Policies, Rules & Standards</div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 10 }}>Procurement policy, DOA matrix, SOPs, approved vendor rules, local-content scoring. The Co-Pilot cites specific clauses when it answers.</div>
                  <textarea value={knowledgeBase} onChange={e => saveKB(e.target.value)} rows={8}
                    placeholder="Paste your procurement policy, delegation of authority matrix, sourcing SOPs, contract extension rules, single-source justification rules, local-content scoring methodology…"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d7dfeb", fontSize: 12.5, fontFamily: "Inter", background: "#fbfcfe", color: "#0a1428", resize: "vertical", lineHeight: 1.5 }} />
                </div>
              </div>
            )}

            {view === "library" && (
              <div>
                <h1 className="f-display" style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Output Library</h1>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 22 }}>Everything you've saved, grouped by project. Your audit trail and reusable starting points.</p>
                {savedOutputs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "50px 20px", color: "#94a3b8", fontSize: 13 }}>Nothing saved yet. Run a module and hit “Save to library”.</div>
                ) : (
                  [...new Set(savedOutputs.map(o => o.project))].map(proj => (
                    <div key={proj} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e1cb0", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{proj}</div>
                      {savedOutputs.filter(o => o.project === proj).map(o => (
                        <details key={o.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f2", padding: "12px 16px", marginBottom: 8 }}>
                          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{o.icon}</span><span style={{ flex: 1 }}>{o.title}</span>
                            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>{o.module} · {o.date}</span>
                          </summary>
                          <div className="out" style={{ marginTop: 12, fontSize: 12.5, color: "#1e293b", borderTop: "1px solid #eef2f8", paddingTop: 12 }} dangerouslySetInnerHTML={{ __html: md(o.content) }} />
                        </details>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}

            {view === "settings" && (
              <div>
                <h1 className="f-display" style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Setup</h1>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 22 }}>Tune the Co-Pilot to your organisation.</p>
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f2", padding: "18px 20px", marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🏷️ Procurement Categories</div>
                  <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 10 }}>The category list used across modules. One per line — match your spend taxonomy.</div>
                  <textarea value={categories.join("\n")} onChange={e => saveCategories(e.target.value.split("\n").map(s => s.trim()).filter(Boolean))} rows={10}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d7dfeb", fontSize: 12.5, fontFamily: "Inter", background: "#fbfcfe", color: "#0a1428", resize: "vertical", lineHeight: 1.6 }} />
                </div>
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f2", padding: "18px 20px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📊 Configuration Status</div>
                  {[
                    ["Organisation profile", orgProfile ? "Set" : "Not set", !!orgProfile],
                    ["Policy knowledge base", knowledgeBase ? "Loaded" : "Not loaded", !!knowledgeBase],
                    ["Templates loaded", `${templateCount} of ${MODULES.filter(m => m.templateSlot).length}`, templateCount > 0],
                    ["Projects", `${projects.length}`, projects.length > 0],
                    ["Saved outputs", `${savedOutputs.length}`, savedOutputs.length > 0],
                  ].map(([k, v, ok]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 12.5 }}>
                      <span style={{ color: "#475569" }}>{k}</span>
                      <span style={{ fontWeight: 600, color: ok ? "#15803d" : "#94a3b8" }}>{ok ? "✓ " : ""}{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        <div style={{ background: "#fff", borderTop: "1px solid #e2e8f2", padding: "8px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10.5, color: "#94a3b8" }}>AI-generated starting points — buyer review and judgement required before use.</span>
          <span className="f-display" style={{ fontSize: 10.5, fontWeight: 600, color: "#cbd5e1", letterSpacing: "0.04em" }}>TX HACKATHON BUILD · 2026</span>
        </div>
      </div>
    </div>
  );
}
