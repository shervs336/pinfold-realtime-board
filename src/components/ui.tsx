import { initials } from "@/lib/names";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <rect x="3" y="3" width="8" height="11" rx="2.5" fill="#17181c" />
        <rect x="13" y="3" width="8" height="7" rx="2.5" fill="#ff5c39" />
        <rect x="13" y="12" width="8" height="9" rx="2.5" fill="#17181c" opacity="0.25" />
        <rect x="3" y="16" width="8" height="5" rx="2.5" fill="#17181c" opacity="0.25" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight">Pinfold</span>
    </span>
  );
}

export function Avatar({
  name,
  color,
  size = 28,
  ring = false,
  faded = false,
  title,
}: {
  name: string;
  color: string;
  size?: number;
  ring?: boolean;
  faded?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title ?? name}
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold text-white select-none ${faded ? "opacity-40 grayscale" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: color,
        boxShadow: ring ? `0 0 0 2px #fff, 0 0 0 4px ${color}` : "0 0 0 2px #fff",
      }}
    >
      {initials(name)}
    </span>
  );
}

export const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tomato disabled:opacity-40";
export const btnPrimary = `${btn} bg-ink text-white hover:bg-ink/85`;
export const btnGhost = `${btn} text-ink-soft hover:bg-ink/5 hover:text-ink`;
export const btnOutline = `${btn} border border-line bg-surface text-ink hover:bg-canvas`;
