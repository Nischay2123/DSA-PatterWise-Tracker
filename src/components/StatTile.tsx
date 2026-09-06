// One tile, used by both the activity card and the revision dashboard --
// they were the same markup copy-pasted into two files under two names.
//
// The value uses PROPORTIONAL figures on purpose: tabular-nums gives every
// digit the width of a zero, which makes a standalone display number look
// loose. Tabular is for columns that must align, not for headline values.
export function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="card-soft py-2.5 px-3">
      <span className="block text-2xl font-semibold leading-none tracking-tight">{value}</span>
      <span className="block text-micro text-muted mt-1">{label}</span>
    </div>
  );
}
