export default function Loading() {
  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold">loading...</h2>
      <p className="text-sm mt-2">
        First load pulls every day of the season from Fantrax (a couple of minutes). Later loads come from the local cache.
      </p>
    </div>
  );
}
