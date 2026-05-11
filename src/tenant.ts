export const tenant = {
  adminTitle: "MNC ADMIN",
  basePath: "/mnc-admin/",
  defaultPushScreen: "MENU",
  menuCategories: ["MATCHA", "NAPOJE", "JEDZENIE"],
  tabs: {
    menu: "MENU",
    points: "PUNKTY",
    push: "PUSH",
    users: "USERS",
  },
} as const;

export type MenuCategory = (typeof tenant.menuCategories)[number];

export const defaultMenuCategory = tenant.menuCategories[0];
