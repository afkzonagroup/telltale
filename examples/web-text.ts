import { aiDisclosureHeader, jsonLdForAiContent, jsonLdScriptText } from '@afkzona/telltale';

// JSON-LD for an AI-generated article (put it in <script type="application/ld+json">).
const jsonLd = jsonLdScriptText(jsonLdForAiContent({ type: 'NewsArticle' }));
console.log(jsonLd);
// {"@context":"https://schema.org","@type":"NewsArticle","digitalSourceType":"https://schema.org/TrainedAlgorithmicMediaDigitalSource"}

// Experimental HTTP header from an expired Internet-Draft; not a standard.
const header = aiDisclosureHeader({ mode: 'machine-generated', model: 'example-model' });
console.log(`${header.name}: ${header.value}`);
// AI-Disclosure: mode=machine-generated, model="example-model"
