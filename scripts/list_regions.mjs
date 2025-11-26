#!/usr/bin/env node
// Extract list of regions from REGION_SOURCES_JSON secret
// Usage: node scripts/list_regions.mjs

const regionsJson = process.env.REGION_SOURCES_JSON || '{}';
try {
    const regions = JSON.parse(regionsJson);
    const regionIds = Object.keys(regions);
    // Output as JSON array for GitHub Actions matrix
    console.log(JSON.stringify(regionIds));
} catch (e) {
    console.error('[ERROR] Failed to parse REGION_SOURCES_JSON:', e.message);
    process.exit(1);
}
