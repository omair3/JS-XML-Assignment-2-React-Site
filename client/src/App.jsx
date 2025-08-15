// client/src/App.jsx
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Landing from "./pages/Landing";
import Analyze from "./pages/Analyze";

export default function App() {
  return (
    <BrowserRouter>
      <header className="header">
        <div className="header-inner">
          <div className="brand">Food Label Analyzer</div>
          <nav style={{display:"flex", gap:12}}>
            <NavLink to="/" className="nav" end>Home</NavLink>
            <NavLink to="/analyze" className="nav">Analyze</NavLink>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/analyze" element={<Analyze />} />
      </Routes>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>© {new Date().getFullYear()} Food Label Analyzer. All rights reserved.</div>
          <div className="muted">Powered by Open Food Facts · AI summaries by Gemini</div>
        </div>
      </footer>
    </BrowserRouter>
  );
}
