/**
 * URL of `/admin/runners` (pure, tested): the list's search, column filters, sort and page, and the
 * open runner profile (`?coureur=<userId>`, `?fiche=` = tab of the drawer). French parameter names,
 * defaults left out of the URL. The API query of `GET /api/admin/users` is derived from it.
 */

export const RUNNER_SORTS = ["email", "role", "createdAt", "lastSignInAt"] as const;
export type RunnerSort = (typeof RUNNER_SORTS)[number];
export const RUNNER_ROLES = ["all", "user", "admin"] as const;
export type RunnerRoleFilter = (typeof RUNNER_ROLES)[number];
export const RUNNER_PROFILE_TABS = ["resume", "acces", "messages", "retours"] as const;
export type RunnerProfileTab = (typeof RUNNER_PROFILE_TABS)[number];

export type RunnersUrlState = {
  search: string;
  email: string;
  role: RunnerRoleFilter;
  createdFrom: string;
  createdTo: string;
  lastSignInFrom: string;
  lastSignInTo: string;
  sort: RunnerSort;
  order: "asc" | "desc";
  page: number;
  runnerId: string | null;
  tab: RunnerProfileTab;
};

const SORT_PARAM: Record<RunnerSort, string> = { email: "email", role: "role", createdAt: "creation", lastSignInAt: "activite" };
const ROLE_PARAM: Record<RunnerRoleFilter, string> = { all: "", user: "coureur", admin: "admin" };

export const DEFAULT_RUNNERS_STATE: RunnersUrlState = {
  search: "",
  email: "",
  role: "all",
  createdFrom: "",
  createdTo: "",
  lastSignInFrom: "",
  lastSignInTo: "",
  sort: "createdAt",
  order: "desc",
  page: 1,
  runnerId: null,
  tab: "resume",
};

/** Default direction when a column becomes the sort: newest first for dates, A→Z otherwise. */
export const defaultOrderFor = (sort: RunnerSort): "asc" | "desc" => (sort === "createdAt" || sort === "lastSignInAt" ? "desc" : "asc");

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (value: string | null) => (value && DAY.test(value) ? value : "");

export const readRunnersUrl = (search: string): RunnersUrlState => {
  const params = new URLSearchParams(search);
  const sort = RUNNER_SORTS.find((candidate) => SORT_PARAM[candidate] === params.get("tri")) ?? DEFAULT_RUNNERS_STATE.sort;
  const orderParam = params.get("ordre");
  const role = RUNNER_ROLES.find((candidate) => candidate !== "all" && ROLE_PARAM[candidate] === params.get("role")) ?? "all";
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const runner = params.get("coureur")?.trim() ?? "";
  const tab = RUNNER_PROFILE_TABS.find((candidate) => candidate === params.get("fiche")) ?? "resume";
  return {
    search: (params.get("recherche") ?? "").trim(),
    email: (params.get("email") ?? "").trim(),
    role,
    createdFrom: day(params.get("cree_du")),
    createdTo: day(params.get("cree_au")),
    lastSignInFrom: day(params.get("actif_du")),
    lastSignInTo: day(params.get("actif_au")),
    sort,
    order: orderParam === "asc" || orderParam === "desc" ? orderParam : defaultOrderFor(sort),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    runnerId: UUID.test(runner) ? runner : null,
    tab,
  };
};

export const writeRunnersUrl = (state: RunnersUrlState): string => {
  const params = new URLSearchParams();
  if (state.search) params.set("recherche", state.search);
  if (state.email) params.set("email", state.email);
  if (state.role !== "all") params.set("role", ROLE_PARAM[state.role]);
  if (state.createdFrom) params.set("cree_du", state.createdFrom);
  if (state.createdTo) params.set("cree_au", state.createdTo);
  if (state.lastSignInFrom) params.set("actif_du", state.lastSignInFrom);
  if (state.lastSignInTo) params.set("actif_au", state.lastSignInTo);
  if (state.sort !== DEFAULT_RUNNERS_STATE.sort) params.set("tri", SORT_PARAM[state.sort]);
  if (state.order !== defaultOrderFor(state.sort)) params.set("ordre", state.order);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.runnerId) {
    params.set("coureur", state.runnerId);
    if (state.tab !== "resume") params.set("fiche", state.tab);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

/** Query string of `GET /api/admin/users` (same parameter names as before lot 5). */
export const runnersApiQuery = (state: RunnersUrlState): string =>
  new URLSearchParams({
    page: String(state.page),
    search: state.search,
    email: state.email,
    role: state.role,
    createdFrom: state.createdFrom,
    createdTo: state.createdTo,
    lastSignInFrom: state.lastSignInFrom,
    lastSignInTo: state.lastSignInTo,
    sort: state.sort,
    order: state.order,
  }).toString();

/** Clicking a sortable header: same column flips the direction, another column takes its default. */
export const nextSort = (state: Pick<RunnersUrlState, "sort" | "order">, column: RunnerSort): Pick<RunnersUrlState, "sort" | "order"> =>
  state.sort === column ? { sort: column, order: state.order === "asc" ? "desc" : "asc" } : { sort: column, order: defaultOrderFor(column) };
