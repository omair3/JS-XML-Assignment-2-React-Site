// client/src/api.js


const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""); 

async function toJson(res) {
  
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return text ? JSON.parse(text) : {};
}


export async function analyzeText(ingredientsText) {
  const res = await fetch(`${BASE}/api/analyze/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredientsText }),
  });
  return toJson(res);
}


export async function analyzeImage(file) {
  const fd = new FormData();
  fd.append("image", file); 

  const res = await fetch(`${BASE}/api/analyze/image`, {
    method: "POST",
    body: fd,
  });
  return toJson(res);
}


export async function listScans() {
  const res = await fetch(`${BASE}/api/scans`);
  return toJson(res);
}


export async function getScan(id) {
  const res = await fetch(`${BASE}/api/scans/${encodeURIComponent(id)}`);
  return toJson(res);
}
