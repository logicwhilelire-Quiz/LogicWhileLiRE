const fs = require('fs');
const readline = require('readline');

async function showStep1457Full() {
  const fileStream = fs.createReadStream('C:\\Users\\chitt\\.gemini\\antigravity-ide\\brain\\b0d67fa4-04fc-4a53-98ed-b4e99e2264ff\\.system_generated\\logs\\transcript_full.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (line.includes('"step_index":1457,')) {
      const obj = JSON.parse(line);
      console.log(obj.content);
      break;
    }
  }
}
showStep1457Full();
