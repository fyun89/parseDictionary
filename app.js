const fs = require('fs');
const readline = require('readline');
const file = '../pg29765.txt';
const dest = '../output.txt';
const ws = fs.createWriteStream(dest);

/* 
data structure format:
{
  "word": [{
    word: "string",
    other: "string",
    definitions: "string",
    synonyms: "string",
    notes: "string",
  }],
}
*/

const checkWord = function(elem) {
  if (elem.length && elem === elem.toUpperCase()) {
    return true;
  }
  return false;
}

const checkDef = function(elem) {
  if (elem.slice(0, 5) === 'Defn:') {
    return true;
  }
  return false;
}

const checkSyn = function(elem) {
  if (elem.slice(0, 4) === 'Syn.') {
    return true;
  }
  return false;
}

const checkNote = function(elem) {
  if (elem.slice(0, 5) === 'Note:') {
    return true;
  }
  return false;
}

const handleDef = function(line, output, doubleSpaced) {
  if (output['definitions']) {
    output['definitions'] += ` ${line}`;
  } else {
    // to remove "Defn:"
    output['definitions'] = checkDef(line) ? line.slice(4) : line;
  }
  doubleSpaced.status = false;
}

const handleSyn = function(line, output, doubleSpaced) {
  if (output['synonyms']) {
    output['synonyms'] += ` ${line}`;
  } else {
    output['synonyms'] = line;
  }
  doubleSpaced.status = false;
}

const handleNote = function(line, output, doubleSpaced) {
  if (output['synonyms']) {
    output['synonyms'] += ` ${line}`;
  } else {
    output['synonyms'] = line;
  }
  doubleSpaced.status = false;
}

ws.write('{');

async function processLineByLine(fn) {
  const fileStream = fs.createReadStream(file);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity //consider \r and \n to be single new line
  });
  let bucket = [];
  let output = {};
  let doubleSpaced = {status: true};
  let enable = false; //change to false when testing
  let counter = 0;

  for await (const line of rl) {
    let sectionCount = Object.keys(output).length;
    if (line === `Produced by Graham Lawrence`) {
      enable = true;
      continue;
    }
    if (line === `End of Project Gutenberg's Webster's Unabridged Dictionary, by Various`) {
      console.log('Parsing dictionary finished!')
      enable = false;
    }
    if (!enable && counter) {
      bucket.push(output);
      counter++;
      ws.write(`\n "${output['word']}": ${JSON.stringify(bucket)}, `);
      break;
    }
    if (doubleSpaced.status && enable) {
      if (checkWord(line)) {
        // detects same word
        if (output['word'] === line) {
          bucket.push(output);
          output = {};
          counter++;
        // detects different word
        } else if (output['word']) {
          bucket.push(output);
          counter++;
          ws.write(`\n "${output['word']}": ${JSON.stringify(bucket)}, `);
          bucket = [];
          output = {};
        }
        output['word'] = line;
        doubleSpaced.status = false;
        continue;
      }

      if (checkDef(line) || (!output['synonyms'] && output['definitions'])) {
        handleDef(line, output, doubleSpaced);
        doubleSpaced.status = false;
        continue;
      }

      if (checkSyn(line) || output['synonyms']) {
        handleSyn(line, output, doubleSpaced);
        continue;
      }

      if (checkNote(line) || output['note']) {
        handleNote(line, output, doubleSpaced);
        continue;
      }

    } else if (enable) {
      // if prev line was a word
      if (line === '') {
        doubleSpaced.status = true;
        continue;
      }

      if (sectionCount < 3) {
        if (output['other']) {
          output['other'] += ` ${line}`;
        } else {
          output['other'] = line;
        }
        doubleSpaced.status = false;
        continue;
      }

      if (checkDef(line) || (!output['synonyms'] && output['definitions'])) {
        handleDef(line, output, doubleSpaced);
        continue;
      }

      if (checkSyn(line) || output['synonyms'] ) {
        handleSyn(line, output, doubleSpaced);
        continue;
      }

      if (checkNote(line) || output['note']) {
        handleNote(line, output, doubleSpaced);
        continue;
      }

    }
  }
  ws.write('\n}');
}

processLineByLine();