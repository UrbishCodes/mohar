import type { View } from "../components/TopBar";

/** Map an app view to its URL path. */
export function viewToPath(view: View): string {
  switch (view.name) {
    case "landing":
      return "/";
    case "dashboard":
      return "/dashboard";
    case "create":
      return "/create";
    case "detail":
      return `/escrow/${view.escrow}`;
    case "privacy":
      return "/privacy";
    case "terms":
      return "/terms";
    case "profile":
      return "/profile";
    case "guide":
      return "/guide";
  }
}

/** Parse the current URL path back into an app view. Unknown paths → landing. */
export function pathToView(pathname: string): View {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { name: "landing" };
  if (path === "/dashboard") return { name: "dashboard" };
  if (path === "/create") return { name: "create" };
  if (path === "/privacy") return { name: "privacy" };
  if (path === "/terms") return { name: "terms" };
  if (path === "/profile") return { name: "profile" };
  if (path === "/guide") return { name: "guide" };
  const m = path.match(/^\/escrow\/([1-9A-HJ-NP-Za-km-z]+)$/);
  if (m) return { name: "detail", escrow: m[1] };
  return { name: "landing" };
}
