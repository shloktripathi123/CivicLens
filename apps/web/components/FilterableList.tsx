"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

interface Item { id: string; text: string; content: ReactNode }

export default function FilterableList({
  items, label, listClassName, pageSize = 30, search = true,
}: {
  items: Item[]; label: string; listClassName: string; pageSize?: number; search?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(pageSize);
  const [ready, setReady] = useState(false);
  const id = useId();
  useEffect(() => { setReady(true); }, []);
  const needle = query.trim().toLocaleLowerCase();
  const matching = needle ? items.filter((item) => item.text.toLocaleLowerCase().includes(needle)) : items;
  const visible = matching.slice(0, limit);

  return (
    <>
      {search && items.length > 10 && (
        <div className="filters">
          <label htmlFor={id}>Filter {label}
            <input id={id} type="search" value={query} disabled={!ready} onChange={(event) => {
              setQuery(event.target.value);
              setLimit(pageSize);
            }} />
          </label>
        </div>
      )}
      {(items.length > pageSize || needle) && (
        <p className="status" role="status">Showing {visible.length} of {matching.length} {label}{needle ? ` matching “${query.trim()}”` : ""}.</p>
      )}
      {needle && matching.length === 0 && <p className="empty">No {label} match this filter.</p>}
      <ul className={listClassName}>
        {visible.map((item) => <li key={item.id}>{item.content}</li>)}
      </ul>
      {visible.length < matching.length && <button type="button" disabled={!ready} onClick={() => setLimit((current) => current + pageSize)}>Show more {label}</button>}
      {items.length > pageSize && (
        <noscript>
          <p>Additional {label}:</p>
          <ul className={listClassName}>
            {items.slice(pageSize).map((item) => <li key={item.id}>{item.content}</li>)}
          </ul>
        </noscript>
      )}
    </>
  );
}
