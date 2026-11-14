import type { Cursor } from "@/hooks/use-presence";

/** Teammates' pointers, drawn inside the scrolling board so they line up with the cards. */
export function Cursors({ cursors }: { cursors: Cursor[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {cursors.map((c) => (
        <div
          key={c.id}
          className="absolute top-0 left-0 transition-transform duration-75 ease-linear will-change-transform"
          style={{ transform: `translate(${c.x}px, ${c.y}px)` }}
        >
          <svg width="20" height="22" viewBox="0 0 20 22" className="drop-shadow-sm">
            <path d="M1 1l6.5 18 2.6-7.4L18 9z" fill={c.color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <span
            className="absolute top-5 left-4 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white shadow-sm"
            style={{ background: c.color }}
          >
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}
