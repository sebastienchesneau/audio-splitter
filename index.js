const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const input = process.argv[2];

if (!input) {
  console.log("Usage: node split-on-silence.js <audio.mp3>");
  process.exit(1);
}

if (!fs.existsSync(input)) {
  console.error("Fichier introuvable:", input);
  process.exit(1);
}

const outputDir = "segments";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Paramètres ajustables
const SILENCE_DB = -40;     // seuil de silence
const SILENCE_DURATION = 1.5; // durée min du blanc (secondes)

console.log("Détection des silences...");

// 1) Lancer ffmpeg pour détecter les silences
const detectCmd = `ffmpeg -i "${input}" -af silencedetect=noise=${SILENCE_DB}dB:d=${SILENCE_DURATION} -f null - 2>&1`;
const raw = execSync(detectCmd).toString();

// 2) Récupérer les timestamps
const silenceStarts = [...raw.matchAll(/silence_start: (\d+(\.\d+)?)/g)]
  .map(m => parseFloat(m[1]));

const silenceEnds = [...raw.matchAll(/silence_end: (\d+(\.\d+)?)/g)]
  .map(m => parseFloat(m[1]));

// 3) Récupérer la durée totale
const durationCmd = `ffprobe -i "${input}" -show_entries format=duration -v quiet -of csv="p=0"`;
const duration = parseFloat(execSync(durationCmd).toString());

console.log("Durée totale:", duration, "sec");

// 4) Construire les segments sonores (entre les blancs)
let segments = [];
let lastEnd = 0;

for (let i = 0; i < silenceStarts.length; i++) {
  const start = lastEnd;
  const end = silenceStarts[i];

  if (end - start > 0.2) {
    segments.push({ start, end });
  }

  lastEnd = silenceEnds[i];
}

// Dernier segment
if (lastEnd < duration) {
  segments.push({ start: lastEnd, end: duration });
}

console.log("Segments détectés:", segments.length);

// 5) Exporter chaque segment en MP3
segments.forEach((seg, i) => {
  const outFile = path.join(
    outputDir,
    `part_${String(i).padStart(3, "0")}.mp3`
  );

  const cutCmd = `ffmpeg -y -i "${input}" -ss ${seg.start} -to ${seg.end} -c copy "${outFile}"`;
  execSync(cutCmd);

  console.log(`Créé: ${outFile} (${seg.start.toFixed(2)}s → ${seg.end.toFixed(2)}s)`);
});

console.log("Terminé.");
