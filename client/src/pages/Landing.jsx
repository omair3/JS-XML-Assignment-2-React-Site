// client/src/pages/Landing.jsx
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-overlay" />
        <div className="hero-inner">
          <h1>Uncover Your Food’s Secrets</h1>
          <p>Type or scan ingredients for clear, friendly health insights.</p>
          <div className="hero-cta">
            <Link to="/analyze" className="cta">Start Analyzing</Link>
          </div>
          <div className="hero-badges">
            <span>Powered by Open Food Facts</span>
            <span>AI insights by Gemini</span>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <main className="main">
        <h2 className="section-title">How It Works</h2>
        <div className="how-grid">
          <div className="how-card">
            <div className="how-icon">⬆️</div>
            <h3>Input Ingredients</h3>
            <p>Type ingredients or snap a label.</p>
          </div>
          <div className="how-card">
            <div className="how-icon">🔎</div>
            <h3>Analyze</h3>
            <p>Checks Open Food Facts and runs OCR if you upload an image.</p>
          </div>
          <div className="how-card">
            <div className="how-icon">💡</div>
            <h3>Get Insights</h3>
            <p>Friendly, simple explanations powered by Gemini.</p>
          </div>
        </div>
      </main>
    </>
  );
}
