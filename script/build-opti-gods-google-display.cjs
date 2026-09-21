const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "marketing", "ads", "google");
const textDir = path.join("/tmp", "opti-gods-google-ad-text");
const font = process.env.OPTI_AD_FONT || "/tmp/opti-ad-font/DMSans.ttf";

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(textDir, { recursive: true });

const copy = {
  hardware: "BUILT FOR YOUR PC",
  free: "15 NATIVE TWEAKS FREE",
  undo: "REVIEW. APPLY. UNDO.",
  cta: "DOWNLOAD FREE",
  url: "OPTIGODS.COM",
};

for (const [name, text] of Object.entries(copy)) {
  fs.writeFileSync(path.join(textDir, `${name}.txt`), text);
}

const splash = path.join(root, "client", "public", "branding", "spin-red.mp4");
const brand = path.join(root, "attached_assets", "generated_images", "optigods_thumbnail.png");
const app = path.join(root, "attached_assets", "opti-gods-landing-reference.jpg");
const preview = path.join(outputDir, "opti-gods-google-display-preview.mp4");
const gif = path.join(outputDir, "opti-gods-google-display-300x250.gif");

const filter = [
  "[0:v]trim=0:2,setpts=PTS-STARTPTS,fps=30,settb=AVTB,scale=900:750:force_original_aspect_ratio=decrease,pad=900:750:(ow-iw)/2:(oh-ih)/2:black,eq=contrast=1.08:saturation=1.05[splash]",
  "[1:v]fps=30,settb=AVTB,scale=900:750:force_original_aspect_ratio=decrease,pad=900:750:(ow-iw)/2:(oh-ih)/2:black,format=rgba,colorchannelmixer=aa=1[brand]",
  "[2:v]fps=30,settb=AVTB,scale=900:750:force_original_aspect_ratio=decrease,pad=900:750:(ow-iw)/2:(oh-ih)/2:black,eq=brightness=-0.08:contrast=1.08[app]",
  "color=c=0x050505:s=900x750:d=2:r=30[cta]",
  "[splash]drawbox=x=0:y=0:w=iw:h=ih:color=black@0.18:t=fill," +
    `drawtext=fontfile='${font}':text='OPTI GODS':fontcolor=white:fontsize=44:x=(w-text_w)/2:y=610,` +
    `drawtext=fontfile='${font}':textfile='${textDir}/hardware.txt':fontcolor=0xff334f:fontsize=28:x=(w-text_w)/2:y=670,format=yuv420p,settb=AVTB[s0]`,
  "[brand]drawbox=x=0:y=0:w=iw:h=ih:color=black@0.12:t=fill," +
    `drawbox=x=115:y=575:w=670:h=108:color=black@0.82:t=fill,` +
    `drawtext=fontfile='${font}':textfile='${textDir}/free.txt':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=597,` +
    `drawtext=fontfile='${font}':textfile='${textDir}/undo.txt':fontcolor=0xff334f:fontsize=25:x=(w-text_w)/2:y=649,format=yuv420p,settb=AVTB[s1]`,
  "[app]drawbox=x=0:y=0:w=iw:h=ih:color=black@0.22:t=fill," +
    `drawbox=x=84:y=545:w=732:h=120:color=black@0.86:t=fill,` +
    `drawtext=fontfile='${font}':text='HARDWARE-AWARE OPTIMIZATION':fontcolor=white:fontsize=33:x=(w-text_w)/2:y=569,` +
    `drawtext=fontfile='${font}':text='EVERY CHANGE STAYS REVERSIBLE':fontcolor=0xff334f:fontsize=25:x=(w-text_w)/2:y=620,format=yuv420p,settb=AVTB[s2]`,
  "[cta]drawbox=x=52:y=52:w=796:h=646:color=0x090909@1:t=fill," +
    "drawbox=x=52:y=52:w=796:h=646:color=0xff243f@0.95:t=3," +
    `drawtext=fontfile='${font}':text='OPTI GODS':fontcolor=0xff334f:fontsize=42:x=(w-text_w)/2:y=170,` +
    `drawtext=fontfile='${font}':textfile='${textDir}/cta.txt':fontcolor=white:fontsize=76:x=(w-text_w)/2:y=290,` +
    `drawtext=fontfile='${font}':textfile='${textDir}/url.txt':fontcolor=0xff334f:fontsize=42:x=(w-text_w)/2:y=408,` +
    `drawtext=fontfile='${font}':text='WINDOWS PERFORMANCE WORKSPACE':fontcolor=white@0.82:fontsize=24:x=(w-text_w)/2:y=520,format=yuv420p,settb=AVTB[s3]`,
  "[s0][s1]xfade=transition=fade:duration=0.28:offset=1.72[x1]",
  "[x1][s2]xfade=transition=fade:duration=0.28:offset=3.44[x2]",
  "[x2][s3]xfade=transition=fade:duration=0.28:offset=5.16,format=yuv420p[out]",
].join(";");

execFileSync(ffmpeg, [
  "-y",
  "-i", splash,
  "-loop", "1", "-t", "2", "-i", brand,
  "-loop", "1", "-t", "2", "-i", app,
  "-filter_complex", filter,
  "-map", "[out]",
  "-t", "7.16",
  "-r", "30",
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "17",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  preview,
], { stdio: "inherit" });

const gifFilter =
  "fps=4,scale=300:250:flags=lanczos,split[a][b];" +
  "[a]palettegen=max_colors=16:stats_mode=diff[p];" +
  "[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle";

execFileSync(ffmpeg, [
  "-y",
  "-i", preview,
  "-filter_complex", gifFilter,
  "-loop", "0",
  gif,
], { stdio: "inherit" });

const bytes = fs.statSync(gif).size;
if (bytes > 150 * 1024) {
  throw new Error(`Google GIF exceeds 150 KB: ${bytes} bytes`);
}

console.log(JSON.stringify({ preview, gif, gifBytes: bytes }, null, 2));