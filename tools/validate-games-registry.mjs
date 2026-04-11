import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const registryPath = resolve("Projects", "data", "games.json");

if (!existsSync(registryPath)) {
  console.error("Registry not found:", registryPath);
  process.exit(1);
}

const requiredFields = ["id", "title", "desc", "href", "thumbnail", "badges", "counted", "sourcePath"];

let payload;
try {
  payload = JSON.parse(readFileSync(registryPath, "utf8"));
} catch (error) {
  console.error("games.json is invalid JSON.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (!payload || !Array.isArray(payload.games)) {
  console.error("games.json must contain a top-level 'games' array.");
  process.exit(1);
}

const duplicateIds = new Set();
const seenIds = new Set();
const errors = [];

payload.games.forEach((game, index) => {
  const label = `games[${index}]`;

  requiredFields.forEach((field) => {
    if (!(field in game)) {
      errors.push(`${label} is missing '${field}'.`);
    }
  });

  if (typeof game.id !== "string" || !game.id.trim()) {
    errors.push(`${label}.id must be a non-empty string.`);
  } else if (seenIds.has(game.id)) {
    duplicateIds.add(game.id);
  } else {
    seenIds.add(game.id);
  }

  if (!Array.isArray(game.badges)) {
    errors.push(`${label}.badges must be an array.`);
  }
});

if (duplicateIds.size) {
  errors.push(`Duplicate game ids found: ${Array.from(duplicateIds).join(", ")}`);
}

if (errors.length) {
  console.error("Registry validation failed:");
  errors.forEach((error) => console.error("- " + error));
  process.exit(1);
}

console.log(`Registry OK: ${payload.games.length} games validated from ${registryPath}`);
