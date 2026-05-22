const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function post(path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({detail:res.statusText})); throw new Error(e.detail||"API error"); }
  return res.json();
}
async function postForm(path: string, fd: FormData) {
  const res = await fetch(`${BASE}${path}`, { method:"POST", body:fd });
  if (!res.ok) { const e = await res.json().catch(()=>({detail:res.statusText})); throw new Error(e.detail||"API error"); }
  return res.json();
}

export const scanText  = (text: string, apiKey?: string) => post("/scan/text", { text, api_key: apiKey||"" });
export const scanFile  = (file: File, prompt: string, apiKey?: string) => { const fd=new FormData(); fd.append("file",file); fd.append("prompt",prompt); fd.append("api_key",apiKey||""); return postForm("/scan/file",fd); };
export const scanImage = (image: File) => { const fd=new FormData(); fd.append("image",image); return postForm("/scan/image",fd); };
export const getHealth = () => fetch(`${BASE}/health`).then(r=>r.json());
export const getStats  = () => fetch(`${BASE}/analytics/stats`).then(r=>r.json());
export const getLogs   = (limit=100, offset=0, level?: string) => fetch(`${BASE}/analytics/logs?limit=${limit}&offset=${offset}${level?`&level=${level}`:""}`).then(r=>r.json());
export const highlightText = (text: string) => post("/analytics/highlight", { text });
