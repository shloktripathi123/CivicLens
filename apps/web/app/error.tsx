"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <article>
      <h1>Page temporarily unavailable</h1>
      <p role="alert">We couldn't load this page. Please try again shortly.</p>
      <button type="button" onClick={reset}>Try again</button>
      <p><a href="/">Return to search</a></p>
    </article>
  );
}
