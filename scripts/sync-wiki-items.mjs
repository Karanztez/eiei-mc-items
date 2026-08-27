#!/usr/bin/env node
/**
 * Pull inventory icons + item list from minecraft.wiki and keep catalog/icons updated.
 * Source of truth: https://minecraft.wiki/w/Item and Category:InvSprite files
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://minecraft.wiki/api.php";
const FILEPATH = "https://minecraft.wiki/w/Special:FilePath/";
const UA = "eiei-mc-items-bot/1.0 (https://github.com/Karanztez/eiei-mc-items; shop icons for eiei.love)";

function titleCase(id) {
  return String(id || "")
    .replace(/^minecraft:/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function slug(name) {
  return String(name || "")
    .replace(/^File:/i, "")
    .replace(/^Invicon[_ ]/i, "")
    .replace(/\.(png|gif|webp)$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

async function wiki(params) {
  const url = new URL(API);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`wiki ${res.status} ${url}`);
  return res.json();
}

async function listCategory(title) {
  const files = [];
  let cont = "";
  for (let i = 0; i < 40; i++) {
    const data = await wiki({
      action: "query",
      list: "categorymembers",
      cmtitle: title,
      cmtype: "file",
      cmlimit: "500",
      cmcontinue: cont || undefined,
    });
    for (const row of data?.query?.categorymembers || []) {
      if (row.title) files.push(row.title);
    }
    cont = data?.continue?.cmcontinue || "";
    if (!cont) break;
  }
  return files;
}

function expandVariants(variants) {
  const out = [];
  const woods = variants.woods || [];
  const colors = variants.colors || [];
  for (const [family, spec] of Object.entries(variants.families || {})) {
    const keys = spec.pattern.includes("{wood}") ? woods : colors;
    const token = spec.pattern.includes("{wood}") ? "{wood}" : "{color}";
    for (const key of keys) {
      if ((spec.skip || []).includes(key) && spec.extra?.[key]) {
        const extra = spec.extra[key];
        out.push({
          id: extra.id,
          title: extra.title,
          family,
          variant: key,
          page: `https://minecraft.wiki/w/${encodeURIComponent(spec.page.replace(/ /g, "_"))}#${extra.title.split(" ")[0]}`,
          invicon: `Invicon_${extra.title.replace(/ /g, "_")}.png`,
        });
        continue;
      }
      if ((spec.skip || []).includes(key)) continue;
      const pretty = titleCase(key);
      const title = spec.title.replace("{Wood}", pretty).replace("{Color}", pretty);
      const id = spec.pattern.replace(token, key);
      out.push({
        id,
        title,
        family,
        variant: key,
        page: `https://minecraft.wiki/w/${encodeURIComponent(spec.page.replace(/ /g, "_"))}#${pretty}`,
        invicon: `Invicon_${title.replace(/ /g, "_")}.png`,
      });
    }
  }
  return out;
}

async function downloadIcon(fileName, dest) {
  const url = FILEPATH + encodeURIComponent(fileName);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.includes("image")) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 40) return false;
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const variants = JSON.parse(readFileSync(join(ROOT, "catalog/variants.json"), "utf8"));
  const prevPath = join(ROOT, "catalog/items.json");
  const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, "utf8")) : { items: {} };

  console.log("listing wiki InvSprite + Item icons...");
  const spriteFiles = await listCategory("Category:InvSprite files");
  const itemIconFiles = await listCategory("Category:Item icons");
  const files = [...new Set([...spriteFiles, ...itemIconFiles])];

  const items = { ...(prev.items || {}) };

  for (const fileTitle of files) {
    const raw = fileTitle.replace(/^File:/i, "");
    if (!/^Invicon[_ ]/i.test(raw)) continue;
    const id = slug(raw);
    if (!id) continue;
    if (!items[id]) {
      items[id] = {
        title: raw.replace(/^Invicon[_ ]/i, "").replace(/\.(png|gif|webp)$/i, "").replace(/_/g, " "),
        invicon: raw.replace(/ /g, "_"),
        page: `https://minecraft.wiki/w/${encodeURIComponent(slug(raw))}`,
        source: "wiki-invsprite",
      };
    }
  }

  for (const row of expandVariants(variants)) {
    items[row.id] = {
      ...(items[row.id] || {}),
      title: row.title,
      invicon: row.invicon,
      page: row.page,
      family: row.family,
      variant: row.variant,
      source: "variant-family",
    };
  }

  const featured = [
    "diamond", "emerald", "netherite_ingot", "netherite_sword", "netherite_pickaxe",
    "netherite_chestplate", "elytra", "totem_of_undying", "beacon", "oak_boat", "spruce_boat",
  ];
  mkdirSync(join(ROOT, "icons"), { recursive: true });
  let saved = 0;
  for (const id of Object.keys(items)) {
    if (!featured.includes(id) && items[id].family !== "boat" && items[id].family !== "wool") continue;
    const file = items[id].invicon;
    if (!file) continue;
    const ok = await downloadIcon(file, join(ROOT, "icons", `${id}.png`));
    if (ok) {
      items[id].local = `icons/${id}.png`;
      saved += 1;
    }
  }

  const catalog = {
    source: "https://minecraft.wiki/w/Item",
    iconBase: FILEPATH,
    updatedAt: new Date().toISOString().slice(0, 10),
    counts: {
      catalog: Object.keys(items).length,
      wikiFiles: files.length,
      downloaded: saved,
    },
    items,
  };
  writeFileSync(prevPath, JSON.stringify(catalog, null, 2) + "\n");
  writeFileSync(
    join(ROOT, "catalog/index.md"),
    `# Item catalog\n\nUpdated ${catalog.updatedAt}\n\n- ${catalog.counts.catalog} mapped items\n- ${catalog.counts.wikiFiles} wiki files scanned\n- ${catalog.counts.downloaded} local icons\n`
  );
  console.log(catalog.counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
