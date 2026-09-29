import assert from "node:assert/strict";
import { buildLocalGraphicsPack } from "../server/graphics-pack-local";

const emerald = buildLocalGraphicsPack("emerald green sky, clear daytime");
assert.equal(emerald.skyColorKey, "emerald_green");
assert.equal(emerald.freezeTime, true);
assert.equal(emerald.disableRain, true);
assert.match(emerald.mood, /cannot control server time or weather/);

const forest = buildLocalGraphicsPack("dark forest green night");
assert.equal(forest.skyColorKey, "forest_green");
assert.equal(forest.freezeHour, 0);

const scarlet = buildLocalGraphicsPack("bright scarlet red sunset");
assert.equal(scarlet.skyColorKey, "scarlet_red");
assert.equal(scarlet.lightRays, true);

const crimson = buildLocalGraphicsPack("crimson sky");
assert.equal(crimson.skyColorKey, "crimson_red");

const performance = buildLocalGraphicsPack("maximum FPS performance");
assert.equal(performance.cloudThickness, 0);
assert.equal(performance.lightRays, false);

console.log("Local graphics pack checks passed.");