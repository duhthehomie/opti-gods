export type GraphicsPackSkyKey =
  | "vivid_blue" | "sky_blue" | "cyan" | "deep_blue" | "navy"
  | "bubblegum" | "hot_pink" | "rose" | "magenta"
  | "warm_amber" | "golden_sunset" | "deep_orange" | "coral_red"
  | "blood_orange" | "violet_dusk" | "twilight_purple"
  | "emerald_green" | "forest_green" | "crimson_red" | "scarlet_red"
  | "steel_grey" | "dark_grey" | "black_sky";

export interface LocalGraphicsPack {
  packName: string;
  cloudThickness: number;
  jetStreams: number;
  skyColorKey: GraphicsPackSkyKey;
  skyBrightness: number;
  aerialClouds: boolean;
  aerialDensity: number;
  lightRays: boolean;
  lightRayIntensity: number;
  sunIntensity: number;
  atmosphereHaze: boolean;
  freezeTime: boolean;
  freezeHour: number;
  freezeMinute: number;
  disableRain: boolean;
  disableSnow: boolean;
  keepProps: boolean;
  disableBloodDecals: boolean;
  fixFaceQuality: boolean;
  mood: string;
}

export function buildLocalGraphicsPack(description: string): LocalGraphicsPack {
  const prompt = description.toLowerCase();
  const green = /\b(green|emerald|forest|mint|lime|toxic)\b/.test(prompt);
  const red = /\b(red|crimson|scarlet|ruby)\b/.test(prompt);
  const bloodOrange = /\bblood orange\b/.test(prompt);
  const pink = /\b(pink|rose|magenta|bubblegum|miami)\b/.test(prompt);
  const purple = /\b(purple|violet|twilight)\b/.test(prompt);
  const warm = /\b(sunset|sunrise|dawn|dusk|golden|orange|amber|warm|fiery|fire)\b/.test(prompt) || bloodOrange;
  const storm = /\b(storm|stormy|rain|thunder|moody|overcast)\b/.test(prompt);
  const snow = /\b(snow|snowy|winter|blizzard)\b/.test(prompt);
  const night = /\b(night|midnight|dark)\b/.test(prompt);
  const sunrise = /\b(sunrise|dawn|morning)\b/.test(prompt);
  const sunset = /\b(sunset|dusk|golden hour|evening|fiery|fire)\b/.test(prompt) || bloodOrange;
  const performance = /\b(fps|performance|competitive|low lag|smooth|maximum frames)\b/.test(prompt);

  let skyColorKey: GraphicsPackSkyKey = "vivid_blue";
  if (green) {
    skyColorKey = /\b(forest|dark|toxic)\b/.test(prompt) ? "forest_green" : "emerald_green";
  } else if (red) {
    skyColorKey = /\b(scarlet|bright|vivid)\b/.test(prompt) ? "scarlet_red" : "crimson_red";
  } else if (bloodOrange) {
    skyColorKey = "blood_orange";
  } else if (purple) {
    skyColorKey = /\b(twilight|dark)\b/.test(prompt) ? "twilight_purple" : "violet_dusk";
  } else if (pink) {
    skyColorKey = /\b(bubblegum|pastel)\b/.test(prompt) ? "bubblegum" : "hot_pink";
  } else if (warm) {
    skyColorKey = /\b(golden|sunrise|dawn)\b/.test(prompt)
      ? "golden_sunset"
      : /\b(coral|red)\b/.test(prompt)
        ? "coral_red"
        : /\b(orange|fiery|fire)\b/.test(prompt)
          ? "deep_orange"
          : "warm_amber";
  } else if (snow) {
    skyColorKey = "steel_grey";
  } else if (storm) {
    skyColorKey = "dark_grey";
  } else if (night) {
    skyColorKey = "navy";
  } else if (/\b(cyan|teal|aqua)\b/.test(prompt)) {
    skyColorKey = "cyan";
  }

  const colorLabel = skyColorKey.replace(/_/g, " ");
  const packName = performance
    ? "FPS-Safe Sky"
    : green
      ? skyColorKey === "forest_green" ? "Forest Green Sky" : "Emerald Green Sky"
      : red
        ? skyColorKey === "scarlet_red" ? "Scarlet Red Sky" : "Crimson Red Sky"
        : bloodOrange
          ? "Blood Orange Sunset"
          : warm
            ? skyColorKey === "golden_sunset" ? "Golden Sunrise" : skyColorKey === "deep_orange" ? "Deep Orange Sunset" : "Golden Hour"
            : snow
              ? "Winter Sky"
              : storm
                ? "Storm Sky"
                : night
                  ? "Night Drive"
                  : `${colorLabel.replace(/\b\w/g, (letter) => letter.toUpperCase())} Sky`;

  const visualSky = warm || green || red || pink || purple;
  const freezeHour = sunrise ? 7 : sunset ? 19 : night ? 0 : 12;

  return {
    packName: packName.slice(0, 30),
    cloudThickness: performance ? 0 : storm ? 70 : snow ? 25 : visualSky ? 8 : 0,
    jetStreams: !performance && /\b(contrails|jet streams|gta ?6)\b/.test(prompt) ? 55 : 0,
    skyColorKey,
    skyBrightness: performance ? 70 : night ? 42 : warm || red ? 84 : green ? 78 : 72,
    aerialClouds: !performance && (storm || snow),
    aerialDensity: snow ? 35 : 60,
    lightRays: !performance && (warm || red || pink),
    lightRayIntensity: 50,
    sunIntensity: night ? 25 : warm || red ? 86 : 62,
    atmosphereHaze: !performance && (warm || red || storm),
    freezeTime: true,
    freezeHour,
    freezeMinute: 0,
    disableRain: !storm,
    disableSnow: !snow,
    keepProps: true,
    disableBloodDecals: false,
    fixFaceQuality: true,
    mood: `Built-in ${colorLabel} style settings are ready. This citizen pack changes local visual files only; it cannot control server time or weather.`,
  };
}