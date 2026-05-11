import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const [slugArg, titleArg, basePathArg] = process.argv.slice(2);

function usage() {
  console.log(
    "Usage: npm run client:new -- <slug> \"Dashboard Title\" [/base-path/]"
  );
  console.log(
    "Example: npm run client:new -- pogodna \"POGODNA ADMIN\" /pogodna-admin/"
  );
}

function toSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toIdentifier(value) {
  const parts = toSlug(value).split("-").filter(Boolean);
  return parts
    .map((part, index) =>
      index === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`
    )
    .join("");
}

if (!slugArg || !titleArg) {
  usage();
  process.exit(1);
}

const slug = toSlug(slugArg);
const title = titleArg.trim();
const basePath = basePathArg?.trim() || `/${slug}-admin/`;

if (!slug) {
  console.error("client:new error: slug cannot be empty");
  process.exit(1);
}

const targetDir = path.join(root, "clients", slug);
const targetPath = path.join(targetDir, "dashboard.config.json");

if (fs.existsSync(targetPath)) {
  console.error(`client:new error: ${path.relative(root, targetPath)} already exists`);
  process.exit(1);
}

const templatePath = path.join(root, "clients", "mnc", "dashboard.config.json");
const config = JSON.parse(fs.readFileSync(templatePath, "utf8"));

config.slug = slug;
config.adminTitle = title;
config.basePath = basePath;

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(targetPath, `${JSON.stringify(config, null, 2)}\n`);

const registryPath = path.join(root, "src", "tenant.ts");
const registry = fs.readFileSync(registryPath, "utf8");
const identifier = `${toIdentifier(slug)}Config`;
const importLine = `import ${identifier} from "../clients/${slug}/dashboard.config.json";`;
const registryLine = `  ${JSON.stringify(slug)}: ${identifier},`;

let updatedRegistry = registry;
if (!updatedRegistry.includes(importLine)) {
  updatedRegistry = updatedRegistry.replace(
    "// DASHBOARD_CONFIG_IMPORTS",
    `${importLine}\n// DASHBOARD_CONFIG_IMPORTS`
  );
}

if (!updatedRegistry.includes(registryLine)) {
  updatedRegistry = updatedRegistry.replace(
    "  // DASHBOARD_CONFIGS",
    `${registryLine}\n  // DASHBOARD_CONFIGS`
  );
}

fs.writeFileSync(registryPath, updatedRegistry);

console.log(`created ${path.relative(root, targetPath)}`);
console.log("Next:");
console.log("1. Align menuCategories with the mobile client and Supabase menu_items.category");
console.log(`2. Run: VITE_CLIENT_SLUG=${slug} npm run client:validate -- ${slug}`);
console.log(`3. Run: VITE_CLIENT_SLUG=${slug} npm run build`);
