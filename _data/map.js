import fs from "node:fs";

// ---------------------------------------------------------------------------
// EDIT HERE. Coordinates are on a 100 x 60 grid: x runs left to right, y runs
// top to bottom. A node links to /locations/<id>/ automatically if a matching
// locations/<id>.md exists, so use the location's filename as its id.
// ---------------------------------------------------------------------------

const nodes = [
    { id: "romanetsk",       label: "Romanetsk",        x: 30, y: 32 },
    { id: "karsk_headwater", label: "???",  x: 45, y: 14 },
];

// An optional third entry is the edge's label. Keep it short.
const edges = [
    ["romanetsk", "karsk_headwater", "2d (water), 9d (land)"],
];

// ---------------------------------------------------------------------------

const width = 100;
const height = 60;

export default function() {
    const resolved = nodes.map(node => ({
        ...node,
        url: node.url !== undefined
            ? node.url
            : fs.existsSync(`locations/${node.id}.md`) ? `/locations/${node.id}/` : null
    }));

    const byId = Object.fromEntries(resolved.map(node => [node.id, node]));

    return {
        width,
        height,
        nodes: resolved,
        // Resolved to coordinates here so the template stays a dumb loop.
        edges: edges.map(([from, to, label]) => {
            if (!byId[from] || !byId[to]) {
                throw new Error(`_data/map.js: edge ["${from}", "${to}"] names a node that doesn't exist.`);
            }
            const [x1, y1] = [byId[from].x, byId[from].y];
            const [x2, y2] = [byId[to].x, byId[to].y];

            // Nudge the label off the line along its normal, so the two don't sit on top
            // of each other. Rounded because these land straight in the markup.
            const length = Math.hypot(x2 - x1, y2 - y1) || 1;
            const offset = 1.8;
            const round = value => Math.round(value * 10) / 10;

            return {
                x1, y1, x2, y2,
                label: label || null,
                mx: round((x1 + x2) / 2 - ((y2 - y1) / length) * offset),
                my: round((y1 + y2) / 2 + ((x2 - x1) / length) * offset)
            };
        })
    };
}
