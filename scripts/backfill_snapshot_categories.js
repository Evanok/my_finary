// Backfills category into existing PortfolioSnapshot breakdown JSON.
// Run with: node scripts/backfill_snapshot_categories.js

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.resolve(__dirname, '../prisma/dev.db'));

// Build a map of assetId -> category from the Asset table
const assets = db.prepare('SELECT id, category FROM "Asset"').all();
const categoryById = {};
for (const a of assets) {
  categoryById[a.id] = a.category;
}

const snapshots = db.prepare('SELECT id, date, breakdown FROM "PortfolioSnapshot"').all();

let updated = 0;
for (const snap of snapshots) {
  if (!snap.breakdown) continue;
  const items = JSON.parse(snap.breakdown);
  let changed = false;
  for (const item of items) {
    if (!item.category && item.assetId && categoryById[item.assetId]) {
      item.category = categoryById[item.assetId];
      changed = true;
    }
  }
  if (changed) {
    db.prepare('UPDATE "PortfolioSnapshot" SET breakdown = ? WHERE id = ?')
      .run(JSON.stringify(items), snap.id);
    updated++;
    console.log(`Updated snapshot ${snap.date}`);
  }
}

console.log(`Done — ${updated}/${snapshots.length} snapshots updated.`);
db.close();
