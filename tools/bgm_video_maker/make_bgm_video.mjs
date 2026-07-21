import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

function printUsage() {
  console.log([
    "Usage:",
    "  node make_bgm_video.mjs <audio-file...> --dir <image-and-output-dir>",
    "",
    "Audio:",
    `  Supported extensions: ${config.supportedAudioExtensions.join(", ")}`,
    "",
    "Options:",
    "  --dir <path>          Directory containing bgm_back1.png etc. Output is saved here too.",
    "  --image-dir <path>    Directory containing the background images.",
    "  --output-dir <path>   Directory for the rendered mp4.",
    "  --output <path>       Explicit output mp4 path.",
    "  --name <name>         Output file base name without extension.",
    "  --dry-run            Print ffmpeg command without running it.",
    "",
    "Examples:",
    "  node make_bgm_video.mjs C:\\Music\\track.mp3 --dir C:\\Videos\\Youtube",
    "  node make_bgm_video.mjs C:\\Music\\track.ogg --dir C:\\Videos\\Youtube",
    "  node make_bgm_video.mjs C:\\Music\\track1.mp3 C:\\Music\\track2.ogg --dir C:\\Videos\\Youtube"
  ].join("\n"));
}

function parseArgs(argv) {
  const args = {
    audioFiles: [],
    dir: null,
    imageDir: null,
    outputDir: null,
    output: null,
    name: null,
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      if (key === "dir") args.dir = value;
      else if (key === "image-dir") args.imageDir = value;
      else if (key === "output-dir") args.outputDir = value;
      else if (key === "output") args.output = value;
      else if (key === "name") args.name = value;
      else throw new Error(`Unknown option: ${arg}`);
      continue;
    }
    args.audioFiles.push(arg);
  }

  return args;
}

function assertFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function assertDirectory(dirPath, label) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    throw new Error(`${label} not found: ${dirPath}`);
  }
}

function assertSupportedAudioExtension(audioFile) {
  const supportedExtensions = config.supportedAudioExtensions.map((extension) => extension.toLowerCase());
  const actualExtension = path.extname(audioFile).toLowerCase();
  if (!supportedExtensions.includes(actualExtension)) {
    throw new Error(`Unsupported audio extension: ${actualExtension || "(none)"}. Supported: ${supportedExtensions.join(", ")}`);
  }
}

function outputNameFromAudio(audioFile) {
  return `${path.basename(audioFile, path.extname(audioFile))}.mp4`;
}

function quoteArg(arg) {
  return /\s/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg;
}

async function renderVideo({ audioFile, imageDir, outputFile, changeRate, dryRun }) {
  assertFile(audioFile, "Audio file");
  assertSupportedAudioExtension(audioFile);

  const ffmpegArgs = [
    "-hide_banner",
    "-y",
    "-framerate",
    String(changeRate),
    "-stream_loop",
    "-1",
    "-start_number",
    String(config.startNumber),
    "-i",
    path.join(imageDir, config.imagePattern),
    "-stream_loop",
    String(config.audioLoops - 1),
    "-i",
    audioFile,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-vf",
    `fps=${config.fps},format=yuv420p`,
    "-c:v",
    "libx264",
    "-preset",
    config.preset,
    "-crf",
    String(config.crf),
    "-c:a",
    "aac",
    "-b:a",
    config.audioBitrate,
    "-shortest",
    "-movflags",
    "+faststart",
    outputFile
  ];

  console.log(`Audio: ${audioFile}`);
  console.log(`Images: ${imageDir}`);
  console.log(`Output: ${outputFile}`);
  console.log(`Settings: ${config.fps}fps, ${config.framesPerImage} frames/image, audio loops x${config.audioLoops}`);
  if (dryRun) {
    console.log([ffmpegPath, ...ffmpegArgs].map(quoteArg).join(" "));
    return;
  }

  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ffmpegArgs, {
      cwd: imageDir,
      stdio: "inherit",
      windowsHide: true
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed with exit code ${code}`));
    });
  });
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (args.audioFiles.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static did not provide an ffmpeg executable.");
  }
  if (args.audioFiles.length > 1 && args.output) {
    throw new Error("--output can only be used with one audio file.");
  }
  if (args.audioFiles.length > 1 && args.name) {
    throw new Error("--name can only be used with one audio file.");
  }

  const sharedDir = args.dir ? path.resolve(args.dir) : null;
  const imageDir = path.resolve(args.imageDir || sharedDir || process.cwd());
  const outputDir = path.resolve(args.outputDir || sharedDir || process.cwd());

  assertDirectory(imageDir, "Image directory");
  fs.mkdirSync(outputDir, { recursive: true });

  for (let imageNumber = 1; imageNumber <= 3; imageNumber += 1) {
    assertFile(path.join(imageDir, `bgm_back${imageNumber}.png`), `Background image ${imageNumber}`);
  }

  const changeRate = config.fps / config.framesPerImage;
  if (!Number.isFinite(changeRate) || changeRate <= 0) {
    throw new Error("Invalid fps / framesPerImage settings.");
  }

  for (let index = 0; index < args.audioFiles.length; index += 1) {
    const audioFile = path.resolve(args.audioFiles[index]);
    const outputFile = args.output
      ? path.resolve(args.output)
      : path.join(outputDir, args.name ? `${args.name}.mp4` : outputNameFromAudio(audioFile));

    if (args.audioFiles.length > 1) {
      console.log(`\n[${index + 1}/${args.audioFiles.length}]`);
    }
    await renderVideo({
      audioFile,
      imageDir,
      outputFile,
      changeRate,
      dryRun: args.dryRun
    });
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
