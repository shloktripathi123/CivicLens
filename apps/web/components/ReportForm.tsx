"use client";
import { useState } from "react";
import { API_URL } from "@/lib/api";

export default function ReportForm({ target = "" }: { target?: string }) {
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await fetch(`${API_URL}/v1/reports`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ target: f.get("target"), kind: f.get("kind"), note: f.get("note") }),
    });
    const j = await res.json();
    setMsg(res.ok ? `Thank you. Report ${j.id} received${j.hidden ? "; the item is hidden until reviewed" : ""}.` : "Please fill in every field.");
  }
  return (
    <form onSubmit={submit}>
      <p><label>Page or item ID or address <input name="target" defaultValue={target} required maxLength={200} /></label></p>
      <p><label>Type{" "}
        <select name="kind"><option value="excluded-category">Shows excluded information</option><option value="factual-error">Factual error</option><option value="rating">Disagree with a credibility grade</option></select>
      </label></p>
      <p><label>What is wrong <textarea name="note" required maxLength={2000} rows={4} /></label></p>
      <button type="submit">Send report</button>
      <p role="status">{msg}</p>
    </form>
  );
}
