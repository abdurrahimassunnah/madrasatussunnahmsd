import fs from "fs";
import path from "path";

function findInDir(dir: string, pattern: RegExp) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findInDir(fullPath, pattern);
    } else if (file.endsWith(".js") || file.endsWith(".ts") || file.endsWith(".cjs") || file.endsWith(".mjs")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      if (pattern.test(content)) {
        console.log(`Found pattern in: ${fullPath}`);
        const lines = content.split("\n");
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            console.log(`  Line ${index + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

console.log("Searching for addAuthHeaders...");
findInDir("node_modules/@google/genai", /addAuthHeaders/);
