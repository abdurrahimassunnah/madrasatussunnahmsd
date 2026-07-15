import fs from "fs";

if (fs.existsSync("node_modules/@google/genai/dist/node/index.cjs")) {
  const content = fs.readFileSync("node_modules/@google/genai/dist/node/index.cjs", "utf-8");
  const lines = content.split("\n");
  const startLine = 19450;
  const endLine = 19510;

  for (let i = startLine; i <= endLine; i++) {
    if (lines[i - 1] !== undefined) {
      console.log(`${i}: ${lines[i - 1]}`);
    }
  }
} else {
  console.log("File node_modules/@google/genai/dist/node/index.cjs not found!");
}
