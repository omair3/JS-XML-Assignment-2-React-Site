import { Link } from "react-router-dom";

export default function Home() {
  return (
    <section className="text-center py-16 space-y-4">
      <h1 className="text-3xl font-bold">Uncover Your Food’s Secrets</h1>
      <p>Type or upload a label and get simple health insights.</p>
      <div className="flex justify-center gap-3">
        <Link to="/analyze" className="bg-orange-500 text-white px-4 py-2 rounded">Start Analyzing</Link>
        <Link to="/history" className="bg-white border px-4 py-2 rounded">View History</Link>
      </div>
    </section>
  );
}
