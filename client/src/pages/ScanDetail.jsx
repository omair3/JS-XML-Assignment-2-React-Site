import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getScan } from "../api";
import ResultCard from "../components/ResultCard";

export default function ScanDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    getScan(id).then(setData).catch(e=>setErr(e.message));
  }, [id]);

  if (err) return <p className="text-red-600">{err}</p>;
  if (!data) return <p>Loading…</p>;

  return <ResultCard result={data} />;
}
