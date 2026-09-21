const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "marketing", "video");
const textDir = path.join("/tmp", "opti-gods-ad-text");
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(textDir, { recursive: true });

const copy = {
  first: "YOUR PC ISN'T SLOW.",
  second: "IT'S UNDER-OPTIMIZED.",
  scan: "SCAN YOUR EXACT HARDWARE.",
  reversible: "KEEP EVERY CHANGE REVERSIBLE.",
  cta: "DOWNLOAD FREE\nOPTIGODS.COM",
};

for (const [name, text] of Object.entries(copy)) {
  fs.writeFileSync(path.join(textDir, `${name}.txt`), text);
}

const font = process.env.OPTI_AD_FONT || "/tmp/opti-ad-font/DMSans.ttf";
const pain = path.join(root, "attached_assets", "generated_videos", "opti-gods-ad-pain.mp4");
const win = path.join(root, "attached_assets", "generated_videos", "opti-gods-ad-win.mp4");
const ui = path.join(root, "attached_assets", "opti-gods-landing-reference.jpg");
const voice = path.join(root, "attached_assets", "generated_audio", "opti-gods-ad-voice.mp3");
const music = path.join(root, "attached_assets", "generated_audio", "opti-gods-ad-music.mp3");
const output = path.join(outputDir, "opti-gods-example-ad-vertical.mp4");

const filters = [
  "[0:v]trim=start=0:end=5,setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=contrast=1.08:saturation=0.88[pain]",
  "[2:v]scale=980:-2[ui_scaled]",
  "color=c=0x050505:s=1080x1920:d=5:r=30[ui_bg]",
  "[ui_bg][ui_scaled]overlay=(W-w)/2:(H-h)/2:shortest=1,setsar=1[ui_scene]",
  "[1:v]trim=start=0:end=5,setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=contrast=1.08:saturation=0.92[win]",
  "[pain][ui_scene][win]concat=n=3:v=1:a=0[base]",
  `[base]drawbox=x=0:y=0:w=iw:h=ih:color=black@0.18:t=fill,` +
    `drawtext=fontfile='${font}':text='OPTI GODS':fontcolor=0xef4444:fontsize=48:font='DM Sans':x=70:y=150:enable='between(t,0,15)',` +
    `drawtext=fontfile='${font}':textfile='${textDir}/first.txt':fontcolor=white:fontsize=92:x=70:y=350:enable='between(t,0,2.5)',` +
    `drawtext=fontfile='${font}':textfile='${textDir}/second.txt':fontcolor=0xef4444:fontsize=84:x=70:y=470:enable='between(t,2.2,5)',` +
    `drawtext=fontfile='${font}':textfile='${textDir}/scan.txt':fontcolor=white:fontsize=70:x=70:y=350:enable='between(t,5,9.8)',` +
    `drawtext=fontfile='${font}':textfile='${textDir}/reversible.txt':fontcolor=white:fontsize=60:x=70:y=350:enable='between(t,9.8,12.5)',` +
    `drawbox=x=55:y=720:w=970:h=390:color=black@0.78:t=fill:enable='between(t,12.5,15)',` +
    `drawtext=fontfile='${font}':textfile='${textDir}/cta.txt':fontcolor=white:fontsize=92:line_spacing=24:x=(w-text_w)/2:y=800:enable='between(t,12.5,15)'[video]`,
  "[3:a]volume=1.15,apad=pad_dur=15[voice]",
  "[4:a]atrim=0:15,volume=0.16,afade=t=in:st=0:d=0.3,afade=t=out:st=13.4:d=1.6[music]",
  "[voice][music]amix=inputs=2:duration=longest:dropout_transition=0[audio]",
].join(";");

execFileSync(
  ffmpeg,
  [
    "-y",
    "-i", pain,
    "-i", win,
    "-loop", "1", "-t", "5", "-i", ui,
    "-i", voice,
    "-i", music,
    "-filter_complex", filters,
    "-map", "[video]",
    "-map", "[audio]",
    "-t", "15",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-c:a", "aac",
    "-b:a", "192k",
    output,
  ],
  { stdio: "inherit" },
);

console.log(output);