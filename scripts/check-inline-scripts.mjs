import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const file = process.argv[2] || "index.html";
const html = readFileSync(file, "utf8");
const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
let checked = 0;
for (const match of html.matchAll(pattern)) {
  const attrs = match[1] || "";
  const source = match[2] || "";
  if (/\bsrc\s*=/i.test(attrs) || !source.trim()) continue;
  const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
  if (type && !["module", "text/javascript", "application/javascript"].includes(type)) continue;
  const args = type === "module" ? ["--input-type=module", "--check"] : ["--check"];
  const result = spawnSync(process.execPath, args, { input: source, encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write("Syntax error in inline script #" + (checked + 1) + " of " + file + "\n");
    process.stderr.write(result.stderr || result.stdout || "Unknown syntax error\n");
    process.exit(result.status || 1);
  }
  checked++;
}
if (!checked) {
  console.error("No inline JavaScript found in " + file);
  process.exit(1);
}
console.log("Checked " + checked + " inline JavaScript block(s) in " + file);
