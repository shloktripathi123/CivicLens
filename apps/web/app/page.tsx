import Search from "@/components/Search";

export default function Home() {
  return (
    <>
      <h1>Who represents you, and what are they doing?</h1>
      <p className="lead">Search by name, ZIP code, city, county or state. See background, bills, funding and agenda, with a link to the source of every fact.</p>
      <Search />
    </>
  );
}
