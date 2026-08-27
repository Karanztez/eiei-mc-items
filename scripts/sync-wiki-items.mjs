#!/usr/bin/env node
/**
 * Pull inventory icons, item list, crop stages, and variants from minecraft.wiki
 * and keep catalog/items.json and categorized icons/ subfolders updated.
 *
 * Source of truth: https://minecraft.wiki/w/Item, Category:InvSprite files,
 * Category:Item icons, Category:Block icons, and item page state variations.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, readdirSync, rmSync } from "node:fs";
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
    .replace(/^(Invicon|ItemSprite|BlockSprite)[_ -]/i, "")
    .replace(/\.(png|gif|webp)$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function cleanTitle(rawName) {
  return String(rawName || "")
    .replace(/^File:/i, "")
    .replace(/^(Invicon|ItemSprite|BlockSprite)[_ -]/i, "")
    .replace(/\.(png|gif|webp)$/i, "")
    .replace(/_/g, " ")
    .trim();
}

function detectCategory(id, rawTitle, inviconName, family, source) {
  const title = (rawTitle || "").toLowerCase();
  const invicon = (inviconName || "").toLowerCase();

  // Damaged items belong to equipment, armor, or items
  if (id.startsWith("damaged_")) {
    if (id.includes("armor") || id.includes("helmet") || id.includes("chestplate") || id.includes("leggings") || id.includes("boots") || id.includes("cap") || id.includes("pants") || id.includes("tunic")) return "armor_trims";
    if (id.includes("sword") || id.includes("pickaxe") || id.includes("axe") || id.includes("shovel") || id.includes("hoe") || id.includes("bow") || id.includes("crossbow") || id.includes("spear") || id.includes("shield") || id.includes("rod") || id.includes("shear") || id.includes("mace") || id.includes("trident") || id.includes("brush")) return "tools_weapons";
    return "items";
  }

  if (id.includes("banner") || id.includes("pattern")) return "banners";
  if (id.includes("spawn_egg")) return "spawn_eggs";

  if (/(_|^)age(_|\d|$)/i.test(id) || id.includes("crop") || id.includes("stage") || id.includes("stem") || id.includes("sprout") || id.includes("plant") || id.includes("flower") || id.includes("leaves") || id.includes("sapling")) {
    return "crops";
  }

  if (id.includes("potion") || id.includes("arrow_of") || id.includes("dye") || id.includes("balloon") || id.includes("beaker") || id.includes("flask") || id.includes("jar") || id.includes("element")) return "potions_dyes";
  if (id.includes("trim") || id.includes("template") || id.includes("armor") || id.includes("helmet") || id.includes("chestplate") || id.includes("leggings") || id.includes("boots")) return "armor_trims";
  if (id.includes("sword") || id.includes("pickaxe") || id.includes("axe") || id.includes("shovel") || id.includes("hoe") || id.includes("bow") || id.includes("crossbow") || id.includes("spear") || id.includes("shield") || id.includes("rod") || id.includes("shear")) return "tools_weapons";
  if (id.includes("map") || id.includes("book") || id.includes("disc") || id.includes("record")) return "maps_books";
  if (id.includes("block") || id.includes("planks") || id.includes("log") || id.includes("stone") || id.includes("brick") || id.includes("slab") || id.includes("stairs") || id.includes("door") || id.includes("gate") || id.includes("trapdoor") || id.includes("button") || id.includes("plate") || id.includes("wall") || id.includes("fence") || invicon.includes("blocksprite") || title.includes("(block)")) return "blocks";
  if (family || source === "variant-family") return "variants";

  if (id.includes("raw_") || id.includes("cooked_") || id.includes("beef") || id.includes("pork") || id.includes("chicken") || id.includes("mutton") || id.includes("rabbit") || id.includes("fish") || id.includes("apple") || id.includes("bread") || id.includes("cookie") || id.includes("pie") || id.includes("stew") || id.includes("soup") || id.includes("cake") || id.includes("golden_") || id.includes("berry") || id.includes("slice") || id.includes("carrot") || id.includes("potato")) {
    return "food";
  }
  if (id.includes("ingot") || id.includes("nugget") || id.includes("ore") || id.includes("raw_") || id.includes("diamond") || id.includes("emerald") || id.includes("amethyst") || id.includes("quartz") || id.includes("coal") || id.includes("redstone") || id.includes("lapis") || id.includes("copper") || id.includes("gold") || id.includes("iron") || id.includes("netherite")) {
    return "materials";
  }
  if (/_(je\d|be\d|lce|revision_\d|legacy)$/i.test(id) || id.includes("revision") || id.includes("legacy")) {
    return "editions";
  }

  return "items";
}

async function wiki(params) {
  const url = new URL(API);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`wiki ${res.status} ${url}`);
  return res.json();
}

async function listCategoryFiles(title) {
  const files = [];
  let cont = "";
  for (let i = 0; i < 60; i++) {
    const params = {
      action: "query",
      list: "categorymembers",
      cmtitle: title,
      cmtype: "file",
      cmlimit: "500",
    };
    if (cont) params.cmcontinue = cont;

    const data = await wiki(params);
    for (const row of data?.query?.categorymembers || []) {
      if (row.title) files.push(row.title);
    }
    cont = data?.continue?.cmcontinue || "";
    if (!cont) break;
  }
  return files;
}

async function searchFiles(query) {
  const data = await wiki({
    action: "query",
    list: "search",
    srsearch: query,
    srnamespace: "6", // File namespace
    srlimit: "100"
  });
  return data?.query?.search?.map(item => item.title) || [];
}

async function getItemPageImagesAndLinks() {
  const images = new Set();
  const links = new Set();

  for (let sec = 4; sec <= 16; sec++) {
    try {
      const data = await wiki({
        action: "parse",
        page: "Item",
        section: String(sec),
        prop: "images|links"
      });
      if (data?.parse?.images) {
        for (const img of data.parse.images) images.add(img);
      }
      if (data?.parse?.links) {
        for (const link of data.parse.links) {
          if (link.ns === 0 && link.title) links.add(link.title);
        }
      }
    } catch {
      // Continue if section doesn't exist
    }
  }
  return { images: Array.from(images), links: Array.from(links) };
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

async function downloadIcon(fileName, dest, retries = 4) {
  if (existsSync(dest)) {
    try {
      const stats = statSync(dest);
      if (stats.size > 40) return true; // Already downloaded
    } catch {}
  }

  const url = FILEPATH + encodeURIComponent(fileName);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
      const type = res.headers.get("content-type") || "";

      if (res.status === 429 || res.status === 503) {
        const delay = Math.pow(2, attempt) * 400 + Math.random() * 300;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (!res.ok || (!type.includes("image") && !type.includes("octet-stream"))) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 300));
          continue;
        }
        return false;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 40) return false;
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, buf);
      return true;
    } catch {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 400 + Math.random() * 300;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  return false;
}

async function downloadBatch(itemsToDownload, rootDir, concurrency = 15) {
  console.log(`Downloading ${itemsToDownload.length} icons into subfolders with concurrency ${concurrency}...`);
  let completed = 0;
  let saved = 0;

  for (let i = 0; i < itemsToDownload.length; i += concurrency) {
    const chunk = itemsToDownload.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (item) => {
        const dest = join(rootDir, "icons", item.category, `${item.id}.png`);
        const ok = await downloadIcon(item.invicon, dest);
        return { item, ok };
      })
    );

    for (const r of results) {
      completed++;
      if (r.ok) {
        r.item.local = `icons/${r.item.category}/${r.item.id}.png`;
        saved++;
      }
    }

    if (completed % 300 === 0 || completed === itemsToDownload.length) {
      console.log(`Progress: ${completed}/${itemsToDownload.length} processed (${saved} saved)`);
    }
  }
  return saved;
}

async function main() {
  const variants = JSON.parse(readFileSync(join(ROOT, "catalog/variants.json"), "utf8"));
  const prevPath = join(ROOT, "catalog/items.json");
  const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, "utf8")) : { items: {} };

  console.log("=== Step 1: Crawling categories ===");
  const spriteFiles = await listCategoryFiles("Category:InvSprite files");
  const itemIconFiles = await listCategoryFiles("Category:Item icons");
  console.log(`InvSprite files: ${spriteFiles.length}, Item icons: ${itemIconFiles.length}`);

  console.log("\n=== Step 2: Parsing 'Item' page sections & links ===");
  const { images: itemPageImages, links: itemPageLinks } = await getItemPageImagesAndLinks();
  console.log(`Item page section images: ${itemPageImages.length}, links: ${itemPageLinks.length}`);

  console.log("\n=== Step 3: Searching crop growth stages and item state files ===");
  const cropSearchTerms = [
    "Pitcher Crop Age", "Wheat Age", "Torchflower Age", "Torchflower Crop",
    "Sweet Berry Bush Age", "Beetroots Age", "Carrots Age", "Potatoes Age",
    "Nether Wart Age", "Stem Age", "Root Vegetables", "Crop Age"
  ];
  const stateFilesSet = new Set();
  for (const term of cropSearchTerms) {
    const found = await searchFiles(term);
    for (const f of found) stateFilesSet.add(f);
  }
  console.log(`Discovered ${stateFilesSet.size} item state / crop growth stage files.`);

  // Combine all discovered file sources
  const allRawFiles = [
    ...spriteFiles,
    ...itemIconFiles,
    ...itemPageImages.map(i => i.startsWith("File:") ? i : `File:${i}`),
    ...Array.from(stateFilesSet)
  ];

  const items = { ...(prev.items || {}) };

  // Map raw file titles into item objects
  for (const fileTitle of allRawFiles) {
    const raw = fileTitle.replace(/^File:/i, "");
    
    // Ignore non-icon generic files
    if (/\.(svg|jpeg|jpg|ogg|wav)$/i.test(raw)) continue;
    if (/^(Disambig|Comment|Search_|AchievementSprite|Advancement|EntitySprite|EnvSprite)/i.test(raw)) continue;

    const id = slug(raw);
    if (!id || id.length < 2) continue;

    const fileName = raw.replace(/ /g, "_");
    const category = detectCategory(id, raw, fileName, null, "wiki-discovery");

    if (!items[id]) {
      items[id] = {
        title: cleanTitle(raw),
        invicon: fileName,
        category,
        page: `https://minecraft.wiki/w/${encodeURIComponent(slug(raw))}`,
        source: "wiki-discovery",
      };
    } else {
      items[id].category = category;
    }
  }

  // Map variants (wood, boat, wool, bed, dye, etc.)
  for (const row of expandVariants(variants)) {
    const category = detectCategory(row.id, row.title, row.invicon, row.family, "variant-family");
    items[row.id] = {
      ...(items[row.id] || {}),
      title: row.title,
      invicon: row.invicon,
      category,
      page: row.page,
      family: row.family,
      variant: row.variant,
      source: "variant-family",
    };
  }

  // Ensure all items have a valid category
  for (const [id, item] of Object.entries(items)) {
    if (!item.category) {
      item.category = detectCategory(id, item.title, item.invicon, item.family, item.source);
    }
  }

  console.log(`\nTotal items mapped in catalog: ${Object.keys(items).length}`);

  // Prepare items for downloading
  const itemsList = Object.entries(items).map(([id, data]) => ({ id, ...data }));
  
  // Create category subfolders
  const categoriesSet = new Set(itemsList.map(i => i.category).filter(Boolean));
  for (const cat of categoriesSet) {
    mkdirSync(join(ROOT, "icons", cat), { recursive: true });
  }

  // Clean up any loose files directly under root `icons/` folder (moving them to subfolder if needed)
  try {
    const rootFiles = readdirSync(join(ROOT, "icons"), { withFileTypes: true });
    for (const entry of rootFiles) {
      if (entry.isFile() && entry.name.endsWith(".png")) {
        rmSync(join(ROOT, "icons", entry.name), { force: true });
      }
    }
  } catch {}

  // Download Pass 1
  let savedCount = await downloadBatch(itemsList, ROOT, 16);

  // Download Pass 2: Retry pass for any missing downloads
  const missingItems = itemsList.filter(item => !item.local || !existsSync(join(ROOT, item.local)));
  if (missingItems.length > 0) {
    console.log(`\n=== Retry Pass: Retrying ${missingItems.length} missing icons ===`);
    const retrySaved = await downloadBatch(missingItems, ROOT, 8);
    savedCount += retrySaved;
  }

  // Update items map with local paths
  let finalSavedOnDisk = 0;
  const categoryCounts = {};
  for (const item of itemsList) {
    const localPath = `icons/${item.category}/${item.id}.png`;
    if (existsSync(join(ROOT, localPath))) {
      items[item.id].local = localPath;
      finalSavedOnDisk++;
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    } else {
      delete items[item.id].local;
    }
  }

  const catalog = {
    source: "https://minecraft.wiki/w/Item",
    iconBase: FILEPATH,
    updatedAt: new Date().toISOString().slice(0, 10),
    counts: {
      catalog: Object.keys(items).length,
      wikiFilesScanned: allRawFiles.length,
      downloaded: finalSavedOnDisk,
      byCategory: categoryCounts,
    },
    items,
  };

  writeFileSync(prevPath, JSON.stringify(catalog, null, 2) + "\n");
  
  const categorySummaryLines = Object.entries(categoryCounts)
    .map(([cat, count]) => `  - \`icons/${cat}/\`: ${count} icons`)
    .join("\n");

  writeFileSync(
    join(ROOT, "catalog/index.md"),
    `# Item catalog\n\nUpdated ${catalog.updatedAt}\n\n- ${catalog.counts.catalog} mapped items\n- ${catalog.counts.wikiFilesScanned} wiki files scanned\n- ${catalog.counts.downloaded} local icons downloaded across subfolders:\n${categorySummaryLines}\n`
  );

  console.log("\nCatalog Sync & Subfolder Categorization Finished Successfully!");
  console.log(catalog.counts);
}

main().catch((err) => {
  console.error("Sync Error:", err);
  process.exit(1);
});
