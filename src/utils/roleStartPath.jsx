// Maps a logged-in user to their landing route.
// Admin -> /admin, Cashier/Server -> /cashier/sale, everything else -> cashier flow.

export function roleStartPath(user) {
  const role = (user?.role || "").toLowerCase();
  if (role === "admin") return "/admin";
  if (role === "cashier" || role === "server") return "/cashier/sale";
  return "/cashier/sale"; // default
}

// Optional default export so either import style works
export default roleStartPath;
