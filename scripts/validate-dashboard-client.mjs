import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const slug = process.argv[2] || process.env.VITE_CLIENT_SLUG || "mnc";
const configPath = path.join(root, "clients", slug, "dashboard.config.json");

function fail(message) {
  console.error(`dashboard config error: ${message}`);
  process.exitCode = 1;
}

function readConfig() {
  if (!fs.existsSync(configPath)) {
    fail(`missing ${path.relative(root, configPath)}`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    fail(`invalid JSON in ${path.relative(root, configPath)}: ${error.message}`);
    return null;
  }
}

function requireString(config, keyPath) {
  const value = keyPath.split(".").reduce((acc, key) => acc?.[key], config);
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${keyPath} must be a non-empty string`);
    return "";
  }
  return value;
}

const config = readConfig();

if (config) {
  if (config.schemaVersion !== 1) {
    fail("schemaVersion must be 1");
  }

  const configSlug = requireString(config, "slug");
  if (configSlug !== slug) {
    fail(`slug is "${configSlug}", but active client is "${slug}"`);
  }

  requireString(config, "adminTitle");
  requireString(config, "basePath");
  requireString(config, "defaultPushScreen");

  if (!Array.isArray(config.menuCategories) || config.menuCategories.length === 0) {
    fail("menuCategories must contain at least one category");
  } else {
    const seen = new Set();
    for (const category of config.menuCategories) {
      if (typeof category !== "string" || category.trim().length === 0) {
        fail("every menuCategories item must be a non-empty string");
      } else if (seen.has(category)) {
        fail(`duplicate menu category "${category}"`);
      }
      seen.add(category);
    }

  }

  for (const key of ["menu", "points", "push", "users"]) {
    requireString(config, `tabs.${key}`);
  }

  const allowedPushScreens = new Set([config.tabs?.menu, config.tabs?.points]);
  if (!allowedPushScreens.has(config.defaultPushScreen)) {
    fail("defaultPushScreen should match the mobile MENU or POINTS route");
  }

  if (process.exitCode !== 1) {
    console.log(`dashboard config ok: ${slug}`);
  }
}
