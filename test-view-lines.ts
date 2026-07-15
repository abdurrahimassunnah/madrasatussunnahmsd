import fs from "fs";

const content = fs.readFileSync("node_modules/@google/genai/dist/index.cjs", "utf-8");
const lines = content.split("\n");
const startLine = 20730;
const endLine = 20790;

for (let i = startLine; i <= endLine; i++) {
  if (lines[i - 1] !== undefined) {
    console.log(`${i}: ${lines[i - 1]}`);
  }
}
