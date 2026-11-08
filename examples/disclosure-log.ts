import { randomSessionPseudonym, sha256Hex, verifyDisclosureLog } from '@afkzona/telltale';
import { DisclosureLogFile } from '@afkzona/telltale/node';
import { readFile } from 'node:fs/promises';

// Server side: record that a notice was shown. The browser sends kind, lang and text
// from the <ai-disclosure> "telltale-shown" event; validate them before use.
const log = await DisclosureLogFile.open({ dir: '.', name: 'disclosures.jsonl' });
const shownText = 'You are chatting with an AI system, not a person. Its replies are generated automatically.';
await log.append({
  event: 'shown',
  kind: 'chatbot',
  lang: 'en',
  textSha256: await sha256Hex(shownText),
  session: randomSessionPseudonym(),
  surface: 'web-chat',
});
const head = log.head; // store this somewhere else, e.g. in your database
await log.close();

if (head === null) throw new Error('empty log');
const result = await verifyDisclosureLog(await readFile('disclosures.jsonl', 'utf8'), { expectedHead: head });
console.log(result.ok, result.ok ? result.count : result.reason);
// true 1
