import { getDisclosure, languagesNeedingReview } from '@afkzona/telltale';

const notice = getDisclosure('chatbot', 'de-AT');
console.log(notice.lang, notice.short, notice.article, notice.source);
// de Sie chatten mit einem KI-System. 50(1) translation

console.log(languagesNeedingReview().length);
// 23
