/**
 * Records the six demo clips against the live site, in order, then converts them to MP4.
 *
 *   npm run record:demo            all clips, 01 → 06
 *   npm run record:demo -- 03 04   only these clips (they reuse state saved by earlier clips)
 *
 * Env (from .env.local): DEMO_CLINICIAN_EMAIL, DEMO_CLINICIAN_PASSWORD. Optional: DEMO_BASE_URL,
 * FFMPEG / FFPROBE (paths to the binaries if they aren't on PATH).
 * Output: scripts/record-demo/output/ (git-ignored), MP4s copied to ../video/public/recordings/.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { OUT, WEBM, launch, readState } from "./lib";
import clip01 from "./01-quick-check";
import clip02 from "./02-crisis";
import clip03 from "./03-receipt-coping";
import clip04 from "./04-return";
import clip05 from "./05-clinician";
import clip06 from "./06-overview";

const CLIPS = [
  { id: "01", name: "01-quick-check", run: clip01, target: 30 },
  { id: "02", name: "02-crisis", run: clip02, target: 20 },
  { id: "03", name: "03-receipt-coping", run: clip03, target: 25 },
  { id: "04", name: "04-return", run: clip04, target: 15 },
  { id: "05", name: "05-clinician", run: clip05, target: 50 },
  { id: "06", name: "06-overview", run: clip06, target: 25 },
];

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? "ffprobe";
const MP4 = path.join(OUT, "mp4");
const PUBLIC = path.resolve(process.cwd(), "../video/public/recordings");

function seconds(file: string) {
  const out = execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" });
  return Number(out.trim());
}

async function main() {
  const only = process.argv.slice(2);
  const chosen = only.length ? CLIPS.filter((c) => only.includes(c.id)) : CLIPS;
  const browser = await launch();
  try {
    for (const clip of chosen) {
      console.log(`\n● Recording ${clip.name}`);
      await clip.run(browser);
    }
  } finally {
    await browser.close();
  }

  mkdirSync(MP4, { recursive: true });
  mkdirSync(PUBLIC, { recursive: true });
  console.log("\nConverting to MP4");
  for (const clip of chosen) {
    const src = path.join(WEBM, `${clip.name}.webm`);
    const dst = path.join(MP4, `${clip.name}.mp4`);
    execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", src, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", dst]);
    copyFileSync(dst, path.join(PUBLIC, `${clip.name}.mp4`));
  }

  console.log("\nClip            length   target");
  for (const clip of chosen) {
    const len = seconds(path.join(MP4, `${clip.name}.mp4`));
    const flag = len < clip.target * 0.7 ? "  ← much shorter than target" : "";
    console.log(`${clip.name.padEnd(18)} ${len.toFixed(1).padStart(5)} s  ~${clip.target} s${flag}`);
  }
  const state = readState();
  console.log("\nSkipped steps:");
  for (const clip of chosen) console.log(`  ${clip.name}: ${state.skipped[clip.name]?.length ? state.skipped[clip.name].join("; ") : "none"}`);
  console.log("\nTest sessions created:", Object.entries(state.sessions).map(([k, v]) => `${k}=${v}`).join(", "));
  console.log(`MP4s copied to ${PUBLIC}`);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
