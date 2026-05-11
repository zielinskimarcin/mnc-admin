import mncConfig from "../clients/mnc/dashboard.config.json";
import mozziConfig from "../clients/mozzi/dashboard.config.json";
import demoEnklawaConfig from "../clients/demo-enklawa/dashboard.config.json";
// DASHBOARD_CONFIG_IMPORTS

export type DashboardConfig = typeof mncConfig;

const dashboardConfigs = {
  mnc: mncConfig,
  mozzi: mozziConfig,
  "demo-enklawa": demoEnklawaConfig,
  // DASHBOARD_CONFIGS
} satisfies Record<string, DashboardConfig>;

export type DashboardSlug = keyof typeof dashboardConfigs;

const fallbackSlug = "mnc" satisfies DashboardSlug;
const requestedSlugValue = import.meta.env.VITE_CLIENT_SLUG;
const requestedSlug =
  typeof requestedSlugValue === "string" && requestedSlugValue.trim().length > 0
    ? (requestedSlugValue.trim() as DashboardSlug)
    : undefined;
const activeSlug: DashboardSlug =
  requestedSlug && requestedSlug in dashboardConfigs ? requestedSlug : fallbackSlug;

export const tenant = dashboardConfigs[activeSlug];

export type MenuCategory = (typeof tenant.menuCategories)[number];

export const defaultMenuCategory = tenant.menuCategories[0];
