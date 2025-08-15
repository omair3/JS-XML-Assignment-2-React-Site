import { useEffect, useState } from "react";
import { listScans } from "../api";
import { Link } from "react-router-dom";

export default function History() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    listScans().then(setItems).catch(e=>setErr(e.message));
  }, []);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Recent Scans</h2>
      {err && <p className="text-red-600">{err}</p>}
      <ul className="bg-white rounded shadow divide-y">
        {items.map(i => (
          <li key={i.id} className="p-3 flex justify-between items-center">
            <div>
              <div className="text-sm text-slate-500">{new Date(i.createdAt).toLocaleString()}</div>
              <div className="text-sm">{i.inputType.toUpperCase()} — {i.extractedIngredientsCount} ingredients</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 rounded text-xs ${
                i.riskLevel === 'high' ? 'bg-red-100 text-red-700'
                : i.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
              }`}>{i.riskLevel}</span>
              <Link to={`/scans/${i.id}`} className="text-teal-700 underline">View</Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
