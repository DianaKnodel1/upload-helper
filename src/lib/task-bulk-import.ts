// Parser für den Klartext-Bulk-Import von Auftragsvorlagen.
// Format: Blöcke zwischen "--- AUFTRAG START ---" und "--- AUFTRAG ENDE ---".

export interface ParsedTask {
  index: number; // 1-basiert
  title: string;
  description: string;
  instructions: string;
  compensation: number | null;
  compensationRaw: string;
  imageUrl: string;
  questions: string[];
}

export interface ParseResult {
  tasks: ParsedTask[];
  errors: string[];
}

export const MAX_TASKS = 100;
export const MAX_QUESTIONS = 10;

const START_RE = /^-{2,}\s*AUFTRAG\s+START\s*-{2,}$/i;
const END_RE = /^-{2,}\s*AUFTRAG\s+(ENDE|END)\s*-{2,}$/i;

type FieldKey = "title" | "description" | "instructions" | "compensation" | "image";

function matchLabel(line: string): { key: FieldKey | "question"; rest: string; qNum?: number } | null {
  const m = line.match(/^\s*([A-Za-zÄÖÜäöüß]+(?:\s+\d{1,3})?)\s*:\s*(.*)$/);
  if (!m) return null;
  const label = m[1].trim().toLowerCase();
  const rest = m[2] ?? "";
  if (label === "titel") return { key: "title", rest };
  if (label === "beschreibung") return { key: "description", rest };
  if (label === "anleitung") return { key: "instructions", rest };
  if (label === "vergütung" || label === "verguetung") return { key: "compensation", rest };
  if (label === "bild") return { key: "image", rest };
  const q = label.match(/^frage\s+(\d{1,3})$/);
  if (q) return { key: "question", rest, qNum: parseInt(q[1], 10) };
  return null;
}

function parseBlock(lines: string[], index: number): ParsedTask {
  const buf: Record<FieldKey, string[]> = {
    title: [], description: [], instructions: [], compensation: [], image: [],
  };
  const questions: { num: number; text: string[] }[] = [];
  let current: { kind: "field"; key: FieldKey } | { kind: "question"; i: number } | null = null;

  for (const raw of lines) {
    const hit = matchLabel(raw);
    if (hit) {
      if (hit.key === "question") {
        questions.push({ num: hit.qNum!, text: hit.rest.trim() ? [hit.rest.trim()] : [] });
        current = { kind: "question", i: questions.length - 1 };
      } else {
        current = { kind: "field", key: hit.key };
        if (hit.rest.trim()) buf[hit.key].push(hit.rest.trim());
      }
      continue;
    }
    if (!current) continue;
    if (current.kind === "field") buf[current.key].push(raw.replace(/\s+$/, ""));
    else questions[current.i].text.push(raw.replace(/\s+$/, ""));
  }

  const join = (arr: string[]) => arr.join("\n").replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n").trim();
  const compRaw = join(buf.compensation);
  const compNum = compRaw ? Number(compRaw.replace(/[€\s]/g, "").replace(",", ".")) : NaN;

  return {
    index,
    title: join(buf.title),
    description: join(buf.description),
    instructions: join(buf.instructions),
    compensation: Number.isFinite(compNum) ? compNum : null,
    compensationRaw: compRaw,
    imageUrl: join(buf.image),
    questions: questions
      .sort((a, b) => a.num - b.num)
      .map((q) => join(q.text))
      .filter((t) => t.length > 0),
  };
}

export function parseBulkTasks(input: string): ParseResult {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[][] = [];
  let currentBlock: string[] | null = null;
  let unterminated = false;

  for (const line of lines) {
    const t = line.trim();
    if (START_RE.test(t)) { currentBlock = []; continue; }
    if (END_RE.test(t)) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = null;
      continue;
    }
    if (currentBlock) currentBlock.push(line);
  }
  if (currentBlock) unterminated = true;

  const errors: string[] = [];
  if (blocks.length === 0) {
    errors.push('Keine Aufträge erkannt. Erwartet werden Blöcke zwischen "--- AUFTRAG START ---" und "--- AUFTRAG ENDE ---".');
  }
  if (unterminated) errors.push('Ein Block wurde nicht mit "--- AUFTRAG ENDE ---" abgeschlossen.');
  if (blocks.length > MAX_TASKS) {
    errors.push(`${blocks.length} Aufträge gefunden. Maximal ${MAX_TASKS} pro Import erlaubt.`);
  }

  const tasks = blocks.map((b, i) => parseBlock(b, i + 1));

  for (const t of tasks) {
    if (!t.title) errors.push(`Auftrag ${t.index}: Titel fehlt.`);
    if (!t.description) errors.push(`Auftrag ${t.index}: Beschreibung fehlt.`);
    if (!t.instructions) errors.push(`Auftrag ${t.index}: Anleitung fehlt.`);
    if (!t.compensationRaw) errors.push(`Auftrag ${t.index}: Vergütung fehlt.`);
    else if (t.compensation === null || t.compensation < 0) {
      errors.push(`Auftrag ${t.index}: Vergütung „${t.compensationRaw}" ist keine gültige Zahl.`);
    }
    if (t.questions.length > MAX_QUESTIONS) {
      errors.push(`Auftrag ${t.index}: ${t.questions.length} Fragen gefunden. Maximal ${MAX_QUESTIONS} erlaubt.`);
    }
  }

  return { tasks, errors };
}
