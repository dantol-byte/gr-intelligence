import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Head from "next/head";

const SYSTEM_PROMPT = `You are a senior Government Relations and Strategic Intelligence Advisor serving a Director at a Jakarta-based advisory firm. You are Indonesia-focused, deeply knowledgeable about Indonesian political economy, regulatory affairs, and business environment.

Coverage mandate — always prioritize these six areas:
1. DEMOKRAT PARTY: Key ministries held by Demokrat, AHY's positioning and recent moves, internal party dynamics, relationship within the Prabowo coalition
2. NATIONAL POLITICAL DYNAMICS: Golkar, Gerindra, PKB, NasDem, PDIP opposition posture, PKS — coalition tensions, alignment shifts, emerging flashpoints
3. REGULATORY DEVELOPMENTS: Mining (mineral downstreaming, IUP/IUPK), Oil & Gas (SKK Migas, upstream licensing), Technology (data governance, digital economy), Renewable Energy (JETP, EBT regulations, PLN procurement)
4. DANANTARA, BKPM & ROSAN ROESLANI: All investment board decisions, Danantara sovereign wealth moves, foreign investor engagements, Rosan's announcements and deal activity
5. ECONOMIC INDICATORS: GDP growth (BPS), inflation (CPI), FDI inflows, Bank Indonesia forex reserves, rupiah vs USD, BI monetary policy stance
6. MILITARY & POLICE: TNI and Polri high command reshuffles, rotation patterns, political significance

Style: Authoritative, concise, analyst-level. Use proper Indonesian institutional terminology (Perpres, PP, Permen, SKK Migas, DIPA, Panja, etc.). Lead with the most significant development. Flag risks and opportunities explicitly. No padding. Every sentence carries weight.`;

const PILLARS = [
  { id: "demokrat",   label: "Demokrat Party",      icon: "⬡", color: "#4a9eff" },
  { id: "political",  label: "Political Dynamics",   icon: "◈", color: "#c9a227" },
  { id: "regulatory", label: "Regulatory",           icon: "⚖", color: "#e05c5c" },
  { id: "danantara",  label: "Danantara / BKPM",     icon: "◉", color: "#4caf7d" },
  { id: "economic",   label: "Economic Indicators",  icon: "▲", color: "#9b7fd4" },
  { id: "military",   label: "Military & Police",    icon: "◆", color: "#ff8c42" },
];

const PILLAR_PROMPTS = {
  demokrat:   "Brief me on Demokrat Party: current ministries held by Demokrat, AHY's positioning and recent moves, internal party dynamics, and Demokrat's relationship within the Prabowo coalition. What should I be watching in the next 30 days? Search for the latest news.",
  political:  "Brief me on Indonesian national political party dynamics right now: Golkar, Gerindra, PKB, NasDem, PDIP opposition posture, PKS. Key coalition tensions, any shifts in alignment, emerging political flashpoints. Search for the latest developments.",
  regulatory: "Brief me on key regulatory developments in Indonesia across: (1) Mining — downstreaming, IUP/IUPK changes, (2) Oil & Gas — SKK Migas, upstream licensing, (3) Technology — data governance, digital economy regs, (4) Renewable Energy — JETP progress, EBT regulations, PLN procurement. What has moved in the last 2 weeks?",
  danantara:  "What are the latest decisions, announcements, and meetings from Danantara and BKPM? Focus on Rosan Roeslani's activities, investment commitments, foreign investor engagements, and sovereign wealth fund moves. Include deal sizes where available.",
  economic:   "Give me the latest Indonesian economic indicators with specific figures: GDP growth rate (latest BPS release), inflation (CPI), FDI inflows, Bank Indonesia foreign exchange reserves, and rupiah vs USD. Note BI's latest monetary policy stance.",
  military:   "Brief me on recent TNI and Polri high command rotations. Who has been moved, to what positions, and what is the political significance? Note any patterns in Prabowo's reshuffling of security leadership.",
};

const DEFAULT_STAKEHOLDERS = [
  { id: 1,  name: "Prabowo Subianto",           role: "President of Indonesia",                        party: "Gerindra",         portfolio: "Head of State, Commander-in-Chief, sets broad policy direction",        pillar: "political",  priority: "critical", notes: "" },
  { id: 2,  name: "Agus Harimurti Yudhoyono",   role: "Minister of ATR/BPN",                           party: "Demokrat",         portfolio: "Agrarian Affairs & Spatial Planning; Demokrat Party Chairman (AHY)",     pillar: "demokrat",   priority: "critical", notes: "" },
  { id: 3,  name: "Rosan Roeslani",              role: "Minister of Investment / Head of BKPM",         party: "Gerindra-aligned", portfolio: "Investment, BKPM, Danantara oversight, foreign investor engagement",     pillar: "danantara",  priority: "critical", notes: "" },
  { id: 4,  name: "Bahlil Lahadalia",            role: "Minister of Energy & Mineral Resources (ESDM)", party: "Golkar",           portfolio: "Mining, Oil & Gas, Renewable Energy policy",                             pillar: "regulatory", priority: "high",     notes: "" },
  { id: 5,  name: "Airlangga Hartarto",          role: "Coordinating Minister for Economic Affairs",    party: "Golkar",           portfolio: "Economic coordination, investment climate, trade policy",                 pillar: "economic",   priority: "high",     notes: "" },
  { id: 6,  name: "Sri Mulyani Indrawati",       role: "Minister of Finance",                           party: "Non-partisan",     portfolio: "State budget (APBN), fiscal policy, debt management, taxation",          pillar: "economic",   priority: "critical", notes: "" },
  { id: 7,  name: "Perry Warjiyo",               role: "Governor, Bank Indonesia",                      party: "Non-partisan",     portfolio: "Monetary policy, forex reserves, rupiah stability, macroprudential",     pillar: "economic",   priority: "high",     notes: "" },
  { id: 8,  name: "Agus Gumiwang Kartasasmita",  role: "Minister of Industry",                          party: "Golkar",           portfolio: "Industrial policy, manufacturing downstreaming, EV policy",              pillar: "regulatory", priority: "medium",   notes: "" },
  { id: 9,  name: "Zulkifli Hasan",              role: "Coordinating Minister for People's Welfare",    party: "PAN",              portfolio: "Social policy coordination, food security, human development",           pillar: "political",  priority: "medium",   notes: "" },
  { id: 10, name: "Sufmi Dasco Ahmad",           role: "Deputy Speaker, DPR RI",                        party: "Gerindra",         portfolio: "Parliamentary leadership, Gerindra liaison to executive",                pillar: "political",  priority: "high",     notes: "" },
];

const PRIORITY_COLOR = { critical: "#e05c5c", high: "#c9a227", medium: "#4a9eff" };

// localStorage wrapper
const store = {
  get: (key) => { try { const v = localStorage.getItem(key); return v ? { value: v } : null; } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch {} },
};

function RenderText({ text }) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={i} style={{ marginBottom: 3, lineHeight: 1.75 }}>
        {parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={j} style={{ color: "#c9a227" }}>{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>
        )}
      </div>
    );
  });
}

export default function GRIntelligence() {
  const [tab, setTab]                   = useState("overview");
  const [briefings, setBriefings]       = useState({});
  const [loadingId, setLoadingId]       = useState(null);
  const [activePillar, setActivePillar] = useState("demokrat");
  const [stakeholders, setStakeholders] = useState(DEFAULT_STAKEHOLDERS);
  const [selectedSH, setSelectedSH]     = useState(null);
  const [shFilter, setShFilter]         = useState("all");
  const [shSearch, setShSearch]         = useState("");
  const [ecoData, setEcoData]           = useState(null);
  const [chatMsgs, setChatMsgs]         = useState([]);
  const [chatInput, setChatInput]       = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    const br = store.get("gri_briefings"); if (br) setBriefings(JSON.parse(br.value));
    const st = store.get("gri_stakeholders"); if (st) setStakeholders(JSON.parse(st.value));
    const ec = store.get("gri_economic"); if (ec) setEcoData(JSON.parse(ec.value));
    const ch = store.get("gri_chat"); if (ch) setChatMsgs(JSON.parse(ch.value));
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  const callAPI = async (messages) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages,
      }),
    });
    const data = await res.json();
    return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
  };

  const generateBriefing = async (pillarId) => {
    setLoadingId(pillarId);
    try {
      const text = await callAPI([{ role: "user", content: PILLAR_PROMPTS[pillarId] }]);
      const updated = { ...briefings, [pillarId]: { content: text, ts: new Date().toISOString() } };
      setBriefings(updated);
      store.set("gri_briefings", JSON.stringify(updated));
    } catch (e) { console.error(e); }
    setLoadingId(null);
  };

  const refreshEconomics = async () => {
    setLoadingId("economic");
    try {
      const prompt = `Search for the latest Indonesian economic data and return ONLY a valid JSON object (no markdown, no explanation) with these keys:
      gdp_growth (number), inflation_rate (number), fdi_usd_bn (number), forex_reserves_usd_bn (number),
      rupiah_usd (number), bi_rate (number),
      gdp_trend (array of 6 objects {period: string, value: number}),
      inflation_trend (array of 6 objects {period: string, value: number}).
      Return ONLY the JSON object, nothing else.`;
      const text = await callAPI([{ role: "user", content: prompt }]);
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const withTs = { ...parsed, fetchedAt: new Date().toISOString() };
      setEcoData(withTs);
      store.set("gri_economic", JSON.stringify(withTs));
    } catch (e) { console.error("Eco error:", e); }
    setLoadingId(null);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || loadingId === "chat") return;
    const userMsg = chatInput.trim();
    const newMsgs = [...chatMsgs, { role: "user", content: userMsg }];
    setChatMsgs(newMsgs);
    setChatInput("");
    setLoadingId("chat");
    try {
      const text = await callAPI(newMsgs);
      const final = [...newMsgs, { role: "assistant", content: text }];
      setChatMsgs(final);
      store.set("gri_chat", JSON.stringify(final.slice(-20)));
    } catch (e) { console.error(e); }
    setLoadingId(null);
  };

  const saveNote = (id, notes) => {
    const updated = stakeholders.map(s => s.id === id ? { ...s, notes } : s);
    setStakeholders(updated);
    if (selectedSH?.id === id) setSelectedSH(prev => ({ ...prev, notes }));
    store.set("gri_stakeholders", JSON.stringify(updated));
  };

  const fmtTime = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const filteredSH = stakeholders.filter(s =>
    (shFilter === "all" || s.pillar === shFilter) &&
    (s.name.toLowerCase().includes(shSearch.toLowerCase()) || s.role.toLowerCase().includes(shSearch.toLowerCase()))
  );

  const TABS = ["overview", "intel", "economics", "stakeholders", "advisor"];
  const TAB_LABELS = { overview: "Overview", intel: "Intel Feed", economics: "Economics", stakeholders: "Stakeholders", advisor: "Advisor" };

  return (
    <>
      <Head>
        <title>GR Intelligence · Indonesia</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={st.root}>
        {/* Header */}
        <div style={st.header}>
          <div>
            <div style={st.title}>GR Intelligence</div>
            <div style={st.subtitle}>Indonesia · Director&apos;s Briefing Terminal</div>
          </div>
          <div style={st.headerRight}>
            <div style={st.liveChip}><div style={st.liveDot} />LIVE SEARCH</div>
            <div style={st.dateBadge}>{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={st.tabBar}>
          {TABS.map(t => (
            <button key={t} className="tab-btn" onClick={() => setTab(t)}
              style={{ ...st.tab, ...(tab === t ? st.tabOn : {}) }}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div style={st.body}>

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div style={st.grid}>
              {PILLARS.map(p => {
                const b = briefings[p.id];
                const isLoading = loadingId === p.id;
                return (
                  <div key={p.id} className="card" style={st.pillarCard}
                    onClick={() => { setActivePillar(p.id); setTab("intel"); }}>
                    <div style={st.cardTop}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: p.color, fontSize: 15 }}>{p.icon}</span>
                        <span style={st.cardLabel}>{p.label}</span>
                      </div>
                      {b && <div style={st.ts}>{fmtTime(b.ts)}</div>}
                    </div>
                    <div style={st.cardExcerpt}>
                      {b ? b.content.slice(0, 200) + "…" : <span style={{ color: "#333", fontStyle: "italic" }}>No briefing yet</span>}
                    </div>
                    <button className="btn" onClick={e => { e.stopPropagation(); generateBriefing(p.id); }}
                      disabled={isLoading} style={{ ...st.btn, marginTop: "auto" }}>
                      {isLoading ? "Searching…" : b ? "↻ Refresh" : "Brief Me"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* INTEL FEED */}
          {tab === "intel" && (
            <div style={st.intelWrap}>
              <div style={st.intelNav}>
                <div style={st.navLabel}>COVERAGE</div>
                {PILLARS.map(p => (
                  <div key={p.id} className="nav-item" onClick={() => setActivePillar(p.id)}
                    style={{ ...st.navItem, ...(activePillar === p.id ? { background: "#0d1520", color: "#c8bfaf", borderLeftColor: p.color } : {}) }}>
                    <span style={{ color: p.color }}>{p.icon}</span>
                    <span style={{ flex: 1 }}>{p.label}</span>
                    {briefings[p.id] && <div style={{ width: 5, height: 5, borderRadius: "50%", background: p.color }} />}
                  </div>
                ))}
              </div>
              <div style={st.intelMain}>
                {(() => {
                  const p = PILLARS.find(x => x.id === activePillar);
                  const b = briefings[activePillar];
                  const ld = loadingId === activePillar;
                  return (
                    <>
                      <div style={st.intelHead}>
                        <div>
                          <div style={{ ...st.intelTitle, color: p.color }}>{p.label}</div>
                          {b && <div style={st.ts}>Updated {fmtTime(b.ts)}</div>}
                        </div>
                        <button className="btn" onClick={() => generateBriefing(activePillar)} disabled={ld} style={st.btn}>
                          {ld ? "Searching…" : b ? "↻ Refresh" : "Generate Brief"}
                        </button>
                      </div>
                      <div style={st.intelBody}>
                        {ld
                          ? <div style={st.loadingMsg}>Searching intelligence sources…</div>
                          : b
                            ? <div style={st.briefText}><RenderText text={b.content} /></div>
                            : <div style={st.empty}>Click &ldquo;Generate Brief&rdquo; to pull the latest intelligence on {p.label}.</div>
                        }
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ECONOMICS */}
          {tab === "economics" && (
            <div style={st.ecoWrap}>
              <div style={st.ecoHead}>
                <div>
                  <div style={st.secTitle}>Economic Indicators</div>
                  {ecoData?.fetchedAt && <div style={st.ts}>Data as of {fmtTime(ecoData.fetchedAt)}</div>}
                </div>
                <button className="btn" onClick={refreshEconomics} disabled={loadingId === "economic"} style={st.btn}>
                  {loadingId === "economic" ? "Fetching…" : "↻ Refresh Data"}
                </button>
              </div>

              {!ecoData && loadingId !== "economic" && (
                <div style={st.empty}>Click &ldquo;Refresh Data&rdquo; to pull the latest Indonesian economic indicators.</div>
              )}
              {loadingId === "economic" && <div style={st.loadingMsg}>Fetching latest figures from Bank Indonesia and BPS…</div>}

              {ecoData && loadingId !== "economic" && (
                <>
                  <div style={st.kpiGrid}>
                    {[
                      { label: "GDP Growth",      value: `${ecoData.gdp_growth}%`,                        sub: "YoY (BPS)",       color: "#4caf7d" },
                      { label: "Inflation (CPI)", value: `${ecoData.inflation_rate}%`,                     sub: "Monthly",         color: "#c9a227" },
                      { label: "FDI",             value: `$${ecoData.fdi_usd_bn}B`,                        sub: "Latest Quarter",  color: "#4a9eff" },
                      { label: "Forex Reserves",  value: `$${ecoData.forex_reserves_usd_bn}B`,             sub: "Bank Indonesia",  color: "#9b7fd4" },
                      { label: "USD/IDR",         value: Number(ecoData.rupiah_usd).toLocaleString(),      sub: "Rupiah Rate",     color: "#ff8c42" },
                      { label: "BI Rate",         value: `${ecoData.bi_rate}%`,                            sub: "Benchmark Rate",  color: "#e05c5c" },
                    ].map(k => (
                      <div key={k.label} style={st.kpi}>
                        <div style={st.kpiLabel}>{k.label}</div>
                        <div style={{ ...st.kpiVal, color: k.color }}>{k.value}</div>
                        <div style={st.kpiSub}>{k.sub}</div>
                      </div>
                    ))}
                  </div>
                  <div style={st.chartsRow}>
                    {ecoData.gdp_trend?.length > 0 && (
                      <div style={st.chartBox}>
                        <div style={st.chartLabel}>GDP GROWTH TREND (%)</div>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={ecoData.gdp_trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#131d28" />
                            <XAxis dataKey="period" tick={{ fill: "#444", fontSize: 10 }} />
                            <YAxis tick={{ fill: "#444", fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: "#0b1018", border: "1px solid #1e2a38", color: "#c8bfaf", fontSize: 11 }} />
                            <Line type="monotone" dataKey="value" stroke="#4caf7d" strokeWidth={2} dot={{ fill: "#4caf7d", r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {ecoData.inflation_trend?.length > 0 && (
                      <div style={st.chartBox}>
                        <div style={st.chartLabel}>INFLATION TREND (%)</div>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={ecoData.inflation_trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#131d28" />
                            <XAxis dataKey="period" tick={{ fill: "#444", fontSize: 10 }} />
                            <YAxis tick={{ fill: "#444", fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: "#0b1018", border: "1px solid #1e2a38", color: "#c8bfaf", fontSize: 11 }} />
                            <Line type="monotone" dataKey="value" stroke="#c9a227" strokeWidth={2} dot={{ fill: "#c9a227", r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STAKEHOLDERS */}
          {tab === "stakeholders" && (
            <div style={st.shWrap}>
              {selectedSH ? (
                <div style={st.shProfile}>
                  <button className="clear" onClick={() => setSelectedSH(null)}
                    style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.08em", marginBottom: 20 }}>
                    ← Back to Directory
                  </button>
                  <div style={st.shName}>{selectedSH.name}</div>
                  <div style={st.shRole}>{selectedSH.role}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <span style={st.badge}>{PILLARS.find(p => p.id === selectedSH.pillar)?.label}</span>
                    <span style={{ ...st.badge, color: PRIORITY_COLOR[selectedSH.priority], borderColor: PRIORITY_COLOR[selectedSH.priority] + "44" }}>{selectedSH.priority.toUpperCase()}</span>
                    {selectedSH.party && <span style={st.badge}>{selectedSH.party}</span>}
                  </div>
                  <div style={st.shSection}>
                    <div style={st.shSecLabel}>PORTFOLIO & MANDATE</div>
                    <div style={st.shSecText}>{selectedSH.portfolio}</div>
                  </div>
                  <div style={st.shSection}>
                    <div style={st.shSecLabel}>YOUR NOTES</div>
                    <textarea style={st.notesBox}
                      value={selectedSH.notes}
                      placeholder="Meeting notes, positions observed, engagement history, relationships…"
                      onChange={e => saveNote(selectedSH.id, e.target.value)} />
                  </div>
                </div>
              ) : (
                <>
                  <div style={st.shHead}>
                    <div style={st.secTitle}>Stakeholder Directory</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input style={st.searchBox} value={shSearch} onChange={e => setShSearch(e.target.value)} placeholder="Search name or role…" />
                      {["all", ...PILLARS.map(p => p.id)].map(f => (
                        <button key={f} className="filter-btn" onClick={() => setShFilter(f)}
                          style={{ ...st.filterBtn, ...(shFilter === f ? { borderColor: "#c9a227", color: "#c9a227" } : {}) }}>
                          {f === "all" ? "All" : PILLARS.find(p => p.id === f)?.label.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={st.shTable}>
                    <div style={st.shHead2}>
                      <div style={{ flex: 2 }}>NAME</div>
                      <div style={{ flex: 2 }}>ROLE</div>
                      <div style={{ flex: 1 }}>PILLAR</div>
                      <div style={{ flex: 1 }}>PRIORITY</div>
                      <div style={{ flex: 1 }}>PARTY</div>
                    </div>
                    {filteredSH.map(s => (
                      <div key={s.id} className="sh-row" onClick={() => setSelectedSH(s)} style={st.shRow}>
                        <div style={{ flex: 2, color: "#e0d8c8", fontWeight: 500, fontSize: 13 }}>{s.name}</div>
                        <div style={{ flex: 2, color: "#666", fontSize: 12 }}>{s.role}</div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 11, color: PILLARS.find(p => p.id === s.pillar)?.color }}>
                            {PILLARS.find(p => p.id === s.pillar)?.label.split(" ")[0]}
                          </span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 11, color: PRIORITY_COLOR[s.priority], textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.priority}</span>
                        </div>
                        <div style={{ flex: 1, fontSize: 11, color: "#555" }}>{s.party}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ADVISOR */}
          {tab === "advisor" && (
            <div style={st.chatWrap}>
              <div style={st.chatFeed}>
                {chatMsgs.length === 0 && (
                  <div style={st.empty}>Ask me anything about Indonesian politics, policy, regulations, or stakeholders. I&apos;ll search live sources before answering.</div>
                )}
                {chatMsgs.map((m, i) => (
                  <div key={i} style={m.role === "user" ? st.userRow : st.asstRow}>
                    <div style={m.role === "user" ? st.userLbl : st.asstLbl}>{m.role === "user" ? "YOU" : "ADVISOR"}</div>
                    <div style={m.role === "user" ? st.userBubble : st.asstBubble}>
                      <RenderText text={m.content} />
                    </div>
                  </div>
                ))}
                {loadingId === "chat" && (
                  <div style={st.asstRow}>
                    <div style={st.asstLbl}>ADVISOR</div>
                    <div style={st.asstBubble}><span style={{ color: "#c9a227" }}>Searching…</span></div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div style={st.chatBar}>
                {chatMsgs.length > 0 && (
                  <button className="clear" onClick={() => { setChatMsgs([]); store.set("gri_chat", "[]"); }}
                    style={{ background: "none", border: "none", color: "#333", fontSize: 10, cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.1em", alignSelf: "center" }}>
                    CLEAR
                  </button>
                )}
                <textarea style={st.chatArea} value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Ask about Indonesian policy, regulations, key officials, political dynamics…"
                  rows={2} />
                <button onClick={sendChat} disabled={loadingId === "chat" || !chatInput.trim()}
                  style={{ ...st.sendBtn, opacity: loadingId === "chat" || !chatInput.trim() ? 0.35 : 1 }}>▶</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

const st = {
  root:        { fontFamily: "'Inter',sans-serif", background: "#080c13", color: "#b8b0a0", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" },
  header:      { background: "#050810", borderBottom: "1px solid #141e2c", padding: "11px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  title:       { fontFamily: "'Playfair Display',serif", fontSize: 19, color: "#e0d8c8", letterSpacing: "0.01em" },
  subtitle:    { fontSize: 10, color: "#3a4455", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 2, fontFamily: "'IBM Plex Mono',monospace" },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  liveChip:    { display: "flex", alignItems: "center", gap: 6, background: "rgba(63,185,80,0.07)", border: "1px solid rgba(63,185,80,0.18)", borderRadius: 20, padding: "3px 10px", fontSize: 10, color: "#3fb950", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.1em" },
  liveDot:     { width: 6, height: 6, borderRadius: "50%", background: "#3fb950", boxShadow: "0 0 6px #3fb950" },
  dateBadge:   { fontSize: 11, color: "#3a4455", fontFamily: "'IBM Plex Mono',monospace" },
  tabBar:      { background: "#050810", borderBottom: "1px solid #141e2c", display: "flex", padding: "0 18px", flexShrink: 0 },
  tab:         { background: "none", border: "none", borderBottom: "2px solid transparent", padding: "9px 15px", fontSize: 11, color: "#3a4455", cursor: "pointer", letterSpacing: "0.09em", fontFamily: "'IBM Plex Mono',monospace", transition: "all 0.15s" },
  tabOn:       { color: "#c9a227", borderBottomColor: "#c9a227" },
  body:        { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },
  grid:        { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 13, padding: 18, overflowY: "auto" },
  pillarCard:  { background: "#0a1018", border: "1px solid #141e2c", borderRadius: 8, padding: 15, display: "flex", flexDirection: "column", gap: 10, cursor: "pointer", transition: "all 0.15s" },
  cardTop:     { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardLabel:   { fontSize: 12, color: "#d0c8b8", fontWeight: 500 },
  cardExcerpt: { fontSize: 11.5, color: "#555", lineHeight: 1.65, flex: 1 },
  ts:          { fontSize: 9.5, color: "#333", fontFamily: "'IBM Plex Mono',monospace" },
  btn:         { background: "#c9a227", color: "#050810", border: "none", borderRadius: 4, padding: "6px 13px", fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em", fontFamily: "'IBM Plex Mono',monospace", transition: "background 0.15s", whiteSpace: "nowrap" },
  intelWrap:   { display: "flex", flex: 1, overflow: "hidden" },
  intelNav:    { width: 196, background: "#050810", borderRight: "1px solid #141e2c", padding: "16px 0", display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 },
  navLabel:    { fontSize: 9, color: "#2a3545", letterSpacing: "0.18em", padding: "0 14px 8px", fontFamily: "'IBM Plex Mono',monospace" },
  navItem:     { display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", fontSize: 12, color: "#3a4a5a", cursor: "pointer", borderLeft: "3px solid transparent", transition: "all 0.15s" },
  intelMain:   { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  intelHead:   { borderBottom: "1px solid #141e2c", padding: "14px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  intelTitle:  { fontFamily: "'Playfair Display',serif", fontSize: 17 },
  intelBody:   { flex: 1, overflowY: "auto", padding: "18px 22px" },
  briefText:   { fontSize: 13, lineHeight: 1.8, color: "#b0a898" },
  loadingMsg:  { color: "#445", fontSize: 13, fontStyle: "italic" },
  empty:       { color: "#2a3545", fontSize: 13, fontStyle: "italic", padding: "30px 0" },
  ecoWrap:     { flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 18 },
  ecoHead:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  secTitle:    { fontFamily: "'Playfair Display',serif", fontSize: 17, color: "#e0d8c8", marginBottom: 4 },
  kpiGrid:     { display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10 },
  kpi:         { background: "#0a1018", border: "1px solid #141e2c", borderRadius: 7, padding: "13px 10px", textAlign: "center" },
  kpiLabel:    { fontSize: 9, color: "#3a4455", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 7, fontFamily: "'IBM Plex Mono',monospace" },
  kpiVal:      { fontSize: 18, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", marginBottom: 4 },
  kpiSub:      { fontSize: 9.5, color: "#333" },
  chartsRow:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  chartBox:    { background: "#0a1018", border: "1px solid #141e2c", borderRadius: 7, padding: 14 },
  chartLabel:  { fontSize: 9, color: "#3a4455", letterSpacing: "0.12em", marginBottom: 12, fontFamily: "'IBM Plex Mono',monospace" },
  shWrap:      { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  shHead:      { padding: "14px 22px", borderBottom: "1px solid #141e2c", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: 12, flexWrap: "wrap" },
  shHead2:     { display: "flex", gap: 12, padding: "9px 8px", fontSize: 9.5, color: "#2a3545", letterSpacing: "0.12em", fontFamily: "'IBM Plex Mono',monospace", borderBottom: "1px solid #141e2c", position: "sticky", top: 0, background: "#080c13" },
  shTable:     { flex: 1, overflowY: "auto", padding: "0 22px" },
  shRow:       { display: "flex", gap: 12, padding: "11px 8px", borderBottom: "1px solid #0d1520", transition: "background 0.1s", borderRadius: 4 },
  searchBox:   { background: "#0a1018", border: "1px solid #141e2c", borderRadius: 4, color: "#b8b0a0", padding: "5px 10px", fontSize: 12, fontFamily: "'Inter',sans-serif", width: 180 },
  filterBtn:   { background: "none", border: "1px solid #141e2c", borderRadius: 20, padding: "3px 11px", fontSize: 10.5, color: "#3a4455", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", transition: "all 0.15s" },
  shProfile:   { padding: 24, overflowY: "auto", flex: 1 },
  shName:      { fontFamily: "'Playfair Display',serif", fontSize: 21, color: "#e0d8c8", marginBottom: 5, marginTop: 16 },
  shRole:      { fontSize: 13, color: "#666" },
  badge:       { fontSize: 10.5, padding: "2px 8px", borderRadius: 3, border: "1px solid #1e2a38", color: "#666", fontFamily: "'IBM Plex Mono',monospace" },
  shSection:   { marginBottom: 20, marginTop: 16 },
  shSecLabel:  { fontSize: 9, color: "#3a4455", letterSpacing: "0.15em", fontFamily: "'IBM Plex Mono',monospace", marginBottom: 8 },
  shSecText:   { fontSize: 13, color: "#8a8278", lineHeight: 1.7 },
  notesBox:    { width: "100%", background: "#0a1018", border: "1px solid #141e2c", borderRadius: 6, color: "#b8b0a0", padding: 12, fontSize: 13, fontFamily: "'Inter',sans-serif", lineHeight: 1.65, resize: "vertical", minHeight: 130 },
  chatWrap:    { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  chatFeed:    { flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 },
  userRow:     { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  asstRow:     { display: "flex", flexDirection: "column", alignItems: "flex-start" },
  userLbl:     { fontSize: 9, color: "#333", letterSpacing: "0.18em", marginBottom: 4, fontFamily: "'IBM Plex Mono',monospace" },
  asstLbl:     { fontSize: 9, color: "#c9a227", letterSpacing: "0.18em", marginBottom: 4, fontFamily: "'IBM Plex Mono',monospace" },
  userBubble:  { background: "#0d1520", border: "1px solid #182030", borderRadius: "8px 8px 2px 8px", padding: "10px 14px", maxWidth: "68%", fontSize: 13 },
  asstBubble:  { background: "#090e18", border: "1px solid #141e2c", borderLeft: "3px solid #c9a227", borderRadius: "2px 8px 8px 8px", padding: "12px 16px", maxWidth: "86%", fontSize: 13 },
  chatBar:     { borderTop: "1px solid #141e2c", padding: "11px 18px", display: "flex", gap: 9, background: "#050810", flexShrink: 0, alignItems: "flex-end" },
  chatArea:    { flex: 1, background: "#080c13", border: "1px solid #141e2c", borderRadius: 6, color: "#b8b0a0", padding: "9px 13px", fontSize: 13, fontFamily: "'Inter',sans-serif", resize: "none", lineHeight: 1.5 },
  sendBtn:     { background: "#c9a227", color: "#050810", border: "none", borderRadius: 6, width: 42, height: 42, fontSize: 15, cursor: "pointer", flexShrink: 0, transition: "opacity 0.2s" },
};
