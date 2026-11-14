import Link from "next/link";
import { ArrowRightIcon, LockIcon, MousePointer2Icon, MoveIcon, Undo2Icon, UserPlusIcon, ZapIcon } from "lucide-react";
import { Logo, btnOutline, btnPrimary } from "@/components/ui";

const FEATURES = [
  { icon: MousePointer2Icon, title: "Live cursors", text: "See where teammates are pointing, in their own color, as they move." },
  { icon: ZapIcon, title: "Instant sync", text: "Every card you add, edit or move appears for everyone right away." },
  { icon: MoveIcon, title: "Drag and drop", text: "Move cards between columns with a mouse, a finger or the keyboard." },
  { icon: UserPlusIcon, title: "Invites and roles", text: "Share a link. Owners decide who can edit and who can only view." },
  { icon: Undo2Icon, title: "Undo and redo", text: "Ctrl+Z your own changes, even moves and deleted columns." },
  { icon: LockIcon, title: "Private by design", text: "Database rules make sure people only ever see boards they belong to." },
];

function Cursor({ name, color, className, style }: { name: string; color: string; className: string; style: React.CSSProperties }) {
  return (
    <div aria-hidden className={`absolute ${className}`} style={style}>
      <svg width="18" height="20" viewBox="0 0 20 22">
        <path d="M1 1l6.5 18 2.6-7.4L18 9z" fill={color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span className="absolute top-4 left-3.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white" style={{ background: color }}>
        {name}
      </span>
    </div>
  );
}

function MiniBoard() {
  const cols = [
    { t: "Ideas", cards: [["Dark mode", "bg-violet-400"], ["Shortcuts", "bg-sky-400"]] },
    { t: "In progress", cards: [["Live cursors", "bg-rose-400"], ["Invite links", "bg-lime-500"], ["Roles", "bg-amber-400"]] },
    { t: "Shipped", cards: [["Realtime sync", "bg-violet-400"]] },
  ];
  return (
    <div className="relative mx-auto mt-14 max-w-4xl text-left" role="img" aria-label="A Pinfold board with three teammates' cursors moving around">
      <div className="dot-grid lift-shadow overflow-hidden rounded-3xl border border-line bg-canvas p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="font-display text-sm font-semibold">Launch plan</span>
          <span className="ml-auto flex -space-x-1.5">
            {["#d9381a", "#2563eb", "#047857"].map((c, i) => (
              <span key={c} className="size-6 rounded-full ring-2 ring-white" style={{ background: c, zIndex: 3 - i }} />
            ))}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {cols.map((col) => (
            <div key={col.t} className="rounded-2xl bg-lane p-2">
              <p className="px-1.5 pb-2 font-display text-xs font-semibold sm:text-sm">{col.t}</p>
              <div className="space-y-2">
                {col.cards.map(([title, tone]) => (
                  <div key={title} className="card-shadow rounded-xl bg-surface p-2 sm:p-3">
                    <span className={`inline-block h-1.5 w-8 rounded-full ${tone.split(" ")[0]}`} />
                    <p className="mt-1.5 truncate text-[11px] font-medium sm:text-sm">{title}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Cursor name="Maya" color="#d9381a" className="roam-a" style={{ top: "28%", left: "18%" }} />
      <Cursor name="Dev" color="#2563eb" className="roam-b" style={{ top: "40%", left: "62%" }} />
      <Cursor name="Iris" color="#047857" className="roam-c" style={{ top: "64%", left: "38%" }} />
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-ink/5 hover:text-ink">
          Sign in
        </Link>
      </header>

      <main>
        <section className="px-4 pt-14 pb-20 text-center sm:pt-20">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-soft">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Realtime collaboration, no refresh needed
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl leading-[0.95] font-bold tracking-tight text-balance sm:text-7xl">
            Plan together. <span className="text-tomato-deep">Live.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-balance text-ink-soft">
            A Kanban board where you see your team&apos;s cursors, drag cards side by side, and watch every change land instantly.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link href="/demo" className={`${btnPrimary} h-12 px-6 text-base`}>
              Try the live demo <ArrowRightIcon className="size-4" />
            </Link>
            <Link href="/login" className={`${btnOutline} h-12 px-6 text-base`}>
              Create your own board
            </Link>
          </div>
          <p className="mt-3 text-xs text-ink-soft">No account needed for the demo. Open it in two windows to see realtime in action.</p>
          <MiniBoard />
        </section>

        <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <h2 id="features" className="sr-only">
            Features
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="card-shadow rounded-2xl bg-surface p-6">
                <span className="grid size-9 place-items-center rounded-xl bg-tomato/10 text-tomato-deep">
                  <Icon className="size-4" />
                </span>
                <p className="mt-4 font-display text-lg font-semibold">{title}</p>
                <p className="mt-1 text-sm text-ink-soft">{text}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-8 text-center text-xs text-ink-soft">
        Pinfold is a portfolio project. Built with Next.js, Supabase Realtime and dnd-kit.
      </footer>
    </div>
  );
}
