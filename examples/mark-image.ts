import { readFile, writeFile } from 'node:fs/promises';
import { markImage, readImageMarking } from '@afkzona/telltale';

const input = new Uint8Array(await readFile('generated.png'));
const { bytes, action } = markImage(input, {
  digitalSourceType: 'trainedAlgorithmicMedia',
  aiSystemUsed: 'Example Image Model',
  aiSystemVersionUsed: '2.0',
});
await writeFile('generated.marked.png', bytes);

const marking = readImageMarking(bytes);
console.log(action, marking.generativeAi, marking.digitalSourceTypes[0]);
// inserted true http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia
