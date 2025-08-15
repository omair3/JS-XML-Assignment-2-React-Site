// client/src/pages/Analyze.jsx
import { useEffect, useState } from "react";
import { analyzeText, analyzeImage, listScans } from "../api";

function RiskBadge({ level }) {
  return <span className={`badge ${level || "low"}`}>{level || "low"}</span>;
}

function RiskMeter({ level }) {
  const width = level === "high" ? 100 : level === "medium" ? 65 : 30;
  return (
    <div className={`meter ${level || "low"}`}>
      <div className="meter-bar" style={{ width: `${width}%` }} />
    </div>
  );
}

export default function Analyze() {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [res, setRes] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    listScans().then(setHistory).catch(() => {});
  }, []);

  async function onAnalyzeText(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    setRes(null);
    try {
      const r = await analyzeText(text);
      setRes(r);
      setHistory((h) => [r, ...h].slice(0, 50));
    } catch (ex) {
      setErr(String(ex));
    } finally {
      setLoading(false);
    }
  }

  async function onAnalyzeImage(e) {
    e.preventDefault();
    if (!file) {
      setErr("Please choose an image (PNG/JPG/BMP).");
      return;
    }
    setErr("");
    setLoading(true);
    setRes(null);
    try {
      const r = await analyzeImage(file);
      setRes(r);
      setHistory((h) => [r, ...h].slice(0, 50));
    } catch (ex) {
      setErr(String(ex));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="main">
      <div className="grid--single">
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Analyze Your Food Label</h2>
          <p className="muted">Type ingredients or upload a label to check for health risks.</p>

          <div className="label">Ingredients</div>
          <form onSubmit={onAnalyzeText}>
            <textarea
              placeholder="e.g., Sugar, Palm Oil, Lactose"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Ingredients text"
            />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" disabled={loading}>
                {loading ? "Analyzing…" : "Analyze Text"}
              </button>

              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/bmp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <button className="btn" onClick={onAnalyzeImage} disabled={loading}>
                {loading ? "Analyzing…" : "Analyze Image"}
              </button>
            </div>
          </form>

          {err && <p style={{ color: "#ef4444", marginTop: 10 }}>{err}</p>}
        </section>

        <section className="card" aria-live="polite">
          <div className="kv">
            <h3 style={{ margin: 0 }}>Result</h3>
            {res && <RiskBadge level={res.riskLevel} />}
          </div>

          {!res && <p className="muted">Run an analysis to see results here.</p>}

          {res && (
            <>
              <RiskMeter level={res.riskLevel} />

              <div style={{ marginTop: 14 }}>
                <div className="label">Flags</div>
                {res.flags?.length ? (
                  <div className="flags">
                    {res.flags.map((f) => (
                      <span key={f} className="flag">
                        ⚠ {f}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "#10b981" }}>No harmful ingredients detected ✅</p>
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="label">Explanation</div>
                <div
                  className="prose"
                  dangerouslySetInnerHTML={{ __html: res.geminiSummaryHtml || "" }}
                />
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="label">Ingredients</div>
                <p className="muted">{(res.extractedIngredients || []).join(", ")}</p>
              </div>
            </>
          )}
        </section>

        <section className="card" style={{ marginTop: 2 }}>
          <h3 style={{ marginTop: 0 }}>Recent Scans</h3>
          {!history.length && <p className="muted">No scans yet.</p>}
          <ul className="list">
            {history.map((h) => (
              <li key={h.id} className="item">
                <div>
                  <div className="time">{new Date(h.createdAt).toLocaleString()}</div>
                  <div>
                    {h.inputType?.toUpperCase()} — {(h.extractedIngredients || []).length} ingredients
                  </div>
                </div>
                <RiskBadge level={h.riskLevel} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
