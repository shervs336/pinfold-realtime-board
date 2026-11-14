export type Role = "owner" | "editor" | "viewer";
export type Label = "rose" | "amber" | "lime" | "sky" | "violet" | "slate";

export type Board = { id: string; name: string; owner_id: string | null; is_demo: boolean; created_at: string };
export type Column = { id: string; board_id: string; title: string; position: number };
export type Card = {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string;
  label: Label | null;
  assignee_id: string | null;
  position: number;
  updated_at?: string;
  updated_by?: string | null;
};
export type Profile = { id: string; display_name: string; color: string };
export type Member = { user_id: string; role: Role; profile?: Profile };

export const LABELS: { id: Label; name: string; bg: string; dot: string }[] = [
  { id: "rose", name: "Urgent", bg: "bg-rose-100 text-rose-800", dot: "bg-rose-500" },
  { id: "amber", name: "Design", bg: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  { id: "lime", name: "Feature", bg: "bg-lime-100 text-lime-800", dot: "bg-lime-500" },
  { id: "sky", name: "Research", bg: "bg-sky-100 text-sky-800", dot: "bg-sky-500" },
  { id: "violet", name: "Infra", bg: "bg-violet-100 text-violet-800", dot: "bg-violet-500" },
  { id: "slate", name: "Chore", bg: "bg-slate-200 text-slate-700", dot: "bg-slate-500" },
];

/**
 * Distinguishable colors for cursors and avatars. Each keeps white name-tag
 * text at a contrast ratio of at least 4.5:1 (WCAG AA).
 */
export const PEOPLE_COLORS = ["#d9381a", "#2563eb", "#047857", "#7c3aed", "#b45309", "#be185d", "#0f766e", "#b91c1c"];
