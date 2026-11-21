import Search from "@/components/Search";

export default function People() {
  return (
    <>
      <h1>People</h1>
      <p className="lead">Search for any official, former official or candidate by name, from the President to members of Congress and governors.</p>
      <Search peopleOnly />
    </>
  );
}
