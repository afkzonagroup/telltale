/*
 * Copyright 2026 MB AFKzona Group
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Disclosure wording.
 *
 * Article 50 of Regulation (EU) 2024/1689 prescribes no wording. English is
 * written for this project. Every other language is a translation by the
 * maintainers (`source: "translation"`, `nativeReviewed: false`) and must be
 * reviewed by a native speaker before production use. None of these texts is
 * an official EU text.
 */

import type { DisclosureKind, DisclosureText, EuLanguage, LanguagePack, TextSource, UiStrings } from './types.js';

type Row = readonly [short: string, long: string];

function pack(
  lang: EuLanguage,
  source: TextSource,
  rows: readonly [Row, Row, Row, Row, Row, Row, Row, Row],
  ui: UiStrings,
): LanguagePack {
  const kinds: readonly DisclosureKind[] = [
    'chatbot',
    'deepfake-image',
    'deepfake-audio',
    'deepfake-video',
    'deepfake-creative',
    'public-interest-text',
    'emotion-recognition',
    'biometric-categorisation',
  ];
  const texts = {} as Record<DisclosureKind, DisclosureText>;
  kinds.forEach((k, i) => {
    const r = rows[i];
    if (r) texts[k] = Object.freeze({ short: r[0], long: r[1] });
  });
  return Object.freeze({ lang, source, nativeReviewed: false, texts: Object.freeze(texts), ui: Object.freeze(ui) });
}

export const PACKS: readonly LanguagePack[] = Object.freeze([
  pack('en', 'authored', [
    ['You are chatting with an AI system.', 'You are chatting with an AI system, not a person. Its replies are generated automatically.'],
    ['AI-generated or manipulated image', 'This image was generated or manipulated with artificial intelligence. It may look real, but it is not authentic.'],
    ['AI-generated or manipulated audio', 'This audio was generated or manipulated with artificial intelligence. It may sound real, but it is not authentic.'],
    ['AI-generated or manipulated video', 'This video was generated or manipulated with artificial intelligence. It may look real, but it is not authentic.'],
    ['Contains AI-generated or manipulated content', 'This work contains content that was generated or manipulated with artificial intelligence.'],
    ['AI-generated or manipulated text', 'This text was generated or manipulated with artificial intelligence.'],
    ['Emotion recognition in use', 'An AI system here analyses biometric data, such as facial expressions or voice, to identify or infer emotions or intentions. See the privacy notice for how your personal data is processed.'],
    ['Biometric categorisation in use', 'An AI system here uses biometric data, such as facial images, to assign people to categories such as age group. See the privacy notice for how your personal data is processed.'],
  ], { badge: 'AI', region: 'AI disclosure', hide: 'Hide notice', more: 'More information', close: 'Close' }),

  pack('bg', 'translation', [
    ['Разговаряте със система с изкуствен интелект.', 'Разговаряте със система с изкуствен интелект, а не с човек. Отговорите ѝ се генерират автоматично.'],
    ['Изображение, генерирано или манипулирано с ИИ', 'Това изображение е генерирано или манипулирано с изкуствен интелект. То може да изглежда истинско, но не е автентично.'],
    ['Аудио, генерирано или манипулирано с ИИ', 'Този аудиозапис е генериран или манипулиран с изкуствен интелект. Той може да звучи истински, но не е автентичен.'],
    ['Видео, генерирано или манипулирано с ИИ', 'Това видео е генерирано или манипулирано с изкуствен интелект. То може да изглежда истинско, но не е автентично.'],
    ['Съдържа съдържание, генерирано или манипулирано с ИИ', 'Това произведение съдържа съдържание, генерирано или манипулирано с изкуствен интелект.'],
    ['Текст, генериран или манипулиран с ИИ', 'Този текст е генериран или манипулиран с изкуствен интелект.'],
    ['Използва се разпознаване на емоции', 'Тук система с изкуствен интелект анализира биометрични данни, като изражение на лицето или глас, за да установи или да направи извод за емоции или намерения. Вижте уведомлението за поверителност относно обработването на личните Ви данни.'],
    ['Използва се биометрично категоризиране', 'Тук система с изкуствен интелект използва биометрични данни, като лицеви изображения, за да причислява хората към категории, например възрастова група. Вижте уведомлението за поверителност относно обработването на личните Ви данни.'],
  ], { badge: 'ИИ', region: 'Информация за ИИ', hide: 'Скриване на съобщението', more: 'Повече информация', close: 'Затваряне' }),

  pack('cs', 'translation', [
    ['Komunikujete se systémem umělé inteligence.', 'Komunikujete se systémem umělé inteligence, nikoli s člověkem. Jeho odpovědi se generují automaticky.'],
    ['Obrázek vytvořený nebo zmanipulovaný pomocí AI', 'Tento obrázek byl vytvořen nebo zmanipulován pomocí umělé inteligence. Může vypadat skutečně, ale není autentický.'],
    ['Zvuk vytvořený nebo zmanipulovaný pomocí AI', 'Tento zvukový záznam byl vytvořen nebo zmanipulován pomocí umělé inteligence. Může znít skutečně, ale není autentický.'],
    ['Video vytvořené nebo zmanipulované pomocí AI', 'Toto video bylo vytvořeno nebo zmanipulováno pomocí umělé inteligence. Může vypadat skutečně, ale není autentické.'],
    ['Obsahuje obsah vytvořený nebo zmanipulovaný pomocí AI', 'Toto dílo obsahuje obsah, který byl vytvořen nebo zmanipulován pomocí umělé inteligence.'],
    ['Text vytvořený nebo zmanipulovaný pomocí AI', 'Tento text byl vytvořen nebo zmanipulován pomocí umělé inteligence.'],
    ['Používá se rozpoznávání emocí', 'Systém umělé inteligence zde analyzuje biometrické údaje, například výraz obličeje nebo hlas, aby rozpoznal nebo odvodil emoce či záměry. Informace o zpracování vašich osobních údajů najdete v oznámení o ochraně osobních údajů.'],
    ['Používá se biometrická kategorizace', 'Systém umělé inteligence zde používá biometrické údaje, například snímky obličeje, k zařazování osob do kategorií, jako je věková skupina. Informace o zpracování vašich osobních údajů najdete v oznámení o ochraně osobních údajů.'],
  ], { badge: 'AI', region: 'Informace o AI', hide: 'Skrýt oznámení', more: 'Další informace', close: 'Zavřít' }),

  pack('da', 'translation', [
    ['Du chatter med et AI-system.', 'Du chatter med et AI-system, ikke et menneske. Svarene genereres automatisk.'],
    ['AI-genereret eller manipuleret billede', 'Dette billede er genereret eller manipuleret med kunstig intelligens. Det kan se ægte ud, men det er ikke autentisk.'],
    ['AI-genereret eller manipuleret lyd', 'Denne lyd er genereret eller manipuleret med kunstig intelligens. Den kan lyde ægte, men den er ikke autentisk.'],
    ['AI-genereret eller manipuleret video', 'Denne video er genereret eller manipuleret med kunstig intelligens. Den kan se ægte ud, men den er ikke autentisk.'],
    ['Indeholder AI-genereret eller manipuleret indhold', 'Dette værk indeholder indhold, der er genereret eller manipuleret med kunstig intelligens.'],
    ['AI-genereret eller manipuleret tekst', 'Denne tekst er genereret eller manipuleret med kunstig intelligens.'],
    ['Følelsesgenkendelse er i brug', 'Et AI-system analyserer her biometriske data, f.eks. ansigtsudtryk eller stemme, for at identificere eller udlede følelser eller hensigter. Se privatlivserklæringen for, hvordan dine personoplysninger behandles.'],
    ['Biometrisk kategorisering er i brug', 'Et AI-system bruger her biometriske data, f.eks. ansigtsbilleder, til at inddele personer i kategorier som aldersgruppe. Se privatlivserklæringen for, hvordan dine personoplysninger behandles.'],
  ], { badge: 'AI', region: 'AI-oplysning', hide: 'Skjul meddelelse', more: 'Mere information', close: 'Luk' }),

  pack('de', 'translation', [
    ['Sie chatten mit einem KI-System.', 'Sie chatten mit einem KI-System, nicht mit einem Menschen. Die Antworten werden automatisch erzeugt.'],
    ['KI-generiertes oder manipuliertes Bild', 'Dieses Bild wurde mit künstlicher Intelligenz erzeugt oder manipuliert. Es kann echt wirken, ist aber nicht authentisch.'],
    ['KI-generierte oder manipulierte Tonaufnahme', 'Diese Tonaufnahme wurde mit künstlicher Intelligenz erzeugt oder manipuliert. Sie kann echt klingen, ist aber nicht authentisch.'],
    ['KI-generiertes oder manipuliertes Video', 'Dieses Video wurde mit künstlicher Intelligenz erzeugt oder manipuliert. Es kann echt wirken, ist aber nicht authentisch.'],
    ['Enthält KI-generierte oder manipulierte Inhalte', 'Dieses Werk enthält Inhalte, die mit künstlicher Intelligenz erzeugt oder manipuliert wurden.'],
    ['KI-generierter oder manipulierter Text', 'Dieser Text wurde mit künstlicher Intelligenz erzeugt oder manipuliert.'],
    ['Emotionserkennung im Einsatz', 'Ein KI-System analysiert hier biometrische Daten, etwa Gesichtsausdruck oder Stimme, um Emotionen oder Absichten zu erkennen oder abzuleiten. Wie Ihre personenbezogenen Daten verarbeitet werden, steht in der Datenschutzerklärung.'],
    ['Biometrische Kategorisierung im Einsatz', 'Ein KI-System verwendet hier biometrische Daten, etwa Gesichtsbilder, um Personen Kategorien wie einer Altersgruppe zuzuordnen. Wie Ihre personenbezogenen Daten verarbeitet werden, steht in der Datenschutzerklärung.'],
  ], { badge: 'KI', region: 'KI-Hinweis', hide: 'Hinweis ausblenden', more: 'Mehr Informationen', close: 'Schließen' }),

  pack('el', 'translation', [
    ['Συνομιλείτε με σύστημα τεχνητής νοημοσύνης.', 'Συνομιλείτε με σύστημα τεχνητής νοημοσύνης, όχι με άνθρωπο. Οι απαντήσεις του παράγονται αυτόματα.'],
    ['Εικόνα που δημιουργήθηκε ή χειραγωγήθηκε με ΤΝ', 'Αυτή η εικόνα δημιουργήθηκε ή χειραγωγήθηκε με τεχνητή νοημοσύνη. Μπορεί να φαίνεται αληθινή, αλλά δεν είναι αυθεντική.'],
    ['Ήχος που δημιουργήθηκε ή χειραγωγήθηκε με ΤΝ', 'Αυτός ο ήχος δημιουργήθηκε ή χειραγωγήθηκε με τεχνητή νοημοσύνη. Μπορεί να ακούγεται αληθινός, αλλά δεν είναι αυθεντικός.'],
    ['Βίντεο που δημιουργήθηκε ή χειραγωγήθηκε με ΤΝ', 'Αυτό το βίντεο δημιουργήθηκε ή χειραγωγήθηκε με τεχνητή νοημοσύνη. Μπορεί να φαίνεται αληθινό, αλλά δεν είναι αυθεντικό.'],
    ['Περιέχει περιεχόμενο που δημιουργήθηκε ή χειραγωγήθηκε με ΤΝ', 'Αυτό το έργο περιέχει περιεχόμενο που δημιουργήθηκε ή χειραγωγήθηκε με τεχνητή νοημοσύνη.'],
    ['Κείμενο που δημιουργήθηκε ή χειραγωγήθηκε με ΤΝ', 'Αυτό το κείμενο δημιουργήθηκε ή χειραγωγήθηκε με τεχνητή νοημοσύνη.'],
    ['Χρησιμοποιείται αναγνώριση συναισθημάτων', 'Εδώ ένα σύστημα τεχνητής νοημοσύνης αναλύει βιομετρικά δεδομένα, όπως εκφράσεις του προσώπου ή τη φωνή, για να αναγνωρίσει ή να συναγάγει συναισθήματα ή προθέσεις. Δείτε τη δήλωση απορρήτου για το πώς υποβάλλονται σε επεξεργασία τα δεδομένα προσωπικού χαρακτήρα σας.'],
    ['Χρησιμοποιείται βιομετρική κατηγοριοποίηση', 'Εδώ ένα σύστημα τεχνητής νοημοσύνης χρησιμοποιεί βιομετρικά δεδομένα, όπως εικόνες προσώπου, για να κατατάσσει πρόσωπα σε κατηγορίες, όπως ηλικιακή ομάδα. Δείτε τη δήλωση απορρήτου για το πώς υποβάλλονται σε επεξεργασία τα δεδομένα προσωπικού χαρακτήρα σας.'],
  ], { badge: 'ΤΝ', region: 'Ενημέρωση για ΤΝ', hide: 'Απόκρυψη ειδοποίησης', more: 'Περισσότερες πληροφορίες', close: 'Κλείσιμο' }),

  pack('es', 'translation', [
    ['Está chateando con un sistema de IA.', 'Está chateando con un sistema de inteligencia artificial, no con una persona. Sus respuestas se generan automáticamente.'],
    ['Imagen generada o manipulada con IA', 'Esta imagen se ha generado o manipulado con inteligencia artificial. Puede parecer real, pero no es auténtica.'],
    ['Audio generado o manipulado con IA', 'Este audio se ha generado o manipulado con inteligencia artificial. Puede sonar real, pero no es auténtico.'],
    ['Vídeo generado o manipulado con IA', 'Este vídeo se ha generado o manipulado con inteligencia artificial. Puede parecer real, pero no es auténtico.'],
    ['Contiene contenido generado o manipulado con IA', 'Esta obra contiene contenido generado o manipulado con inteligencia artificial.'],
    ['Texto generado o manipulado con IA', 'Este texto se ha generado o manipulado con inteligencia artificial.'],
    ['Reconocimiento de emociones en uso', 'Aquí un sistema de inteligencia artificial analiza datos biométricos, como las expresiones faciales o la voz, para detectar o inferir emociones o intenciones. Consulte el aviso de privacidad para saber cómo se tratan sus datos personales.'],
    ['Categorización biométrica en uso', 'Aquí un sistema de inteligencia artificial utiliza datos biométricos, como imágenes faciales, para clasificar a las personas en categorías como el grupo de edad. Consulte el aviso de privacidad para saber cómo se tratan sus datos personales.'],
  ], { badge: 'IA', region: 'Aviso sobre IA', hide: 'Ocultar aviso', more: 'Más información', close: 'Cerrar' }),

  pack('et', 'translation', [
    ['Vestlete tehisintellektisüsteemiga.', 'Vestlete tehisintellektisüsteemiga, mitte inimesega. Selle vastused luuakse automaatselt.'],
    ['Tehisintellektiga loodud või manipuleeritud pilt', 'See pilt on loodud või manipuleeritud tehisintellekti abil. See võib tunduda tõeline, kuid ei ole autentne.'],
    ['Tehisintellektiga loodud või manipuleeritud heli', 'See heli on loodud või manipuleeritud tehisintellekti abil. See võib kõlada tõeliselt, kuid ei ole autentne.'],
    ['Tehisintellektiga loodud või manipuleeritud video', 'See video on loodud või manipuleeritud tehisintellekti abil. See võib tunduda tõeline, kuid ei ole autentne.'],
    ['Sisaldab tehisintellektiga loodud või manipuleeritud sisu', 'See teos sisaldab sisu, mis on loodud või manipuleeritud tehisintellekti abil.'],
    ['Tehisintellektiga loodud või manipuleeritud tekst', 'See tekst on loodud või manipuleeritud tehisintellekti abil.'],
    ['Kasutusel on emotsioonituvastus', 'Tehisintellektisüsteem analüüsib siin biomeetrilisi andmeid, näiteks näoilmeid või häält, et tuvastada või tuletada emotsioone või kavatsusi. Teavet isikuandmete töötlemise kohta leiate privaatsusteatest.'],
    ['Kasutusel on biomeetriline kategoriseerimine', 'Tehisintellektisüsteem kasutab siin biomeetrilisi andmeid, näiteks näokujutisi, et liigitada inimesi kategooriatesse, näiteks vanuserühma järgi. Teavet isikuandmete töötlemise kohta leiate privaatsusteatest.'],
  ], { badge: 'TI', region: 'Teave tehisintellekti kohta', hide: 'Peida teade', more: 'Lisateave', close: 'Sulge' }),

  pack('fi', 'translation', [
    ['Keskustelet tekoälyjärjestelmän kanssa.', 'Keskustelet tekoälyjärjestelmän kanssa, et ihmisen. Sen vastaukset luodaan automaattisesti.'],
    ['Tekoälyllä luotu tai manipuloitu kuva', 'Tämä kuva on luotu tai sitä on manipuloitu tekoälyllä. Se voi näyttää aidolta, mutta se ei ole autenttinen.'],
    ['Tekoälyllä luotu tai manipuloitu ääni', 'Tämä äänite on luotu tai sitä on manipuloitu tekoälyllä. Se voi kuulostaa aidolta, mutta se ei ole autenttinen.'],
    ['Tekoälyllä luotu tai manipuloitu video', 'Tämä video on luotu tai sitä on manipuloitu tekoälyllä. Se voi näyttää aidolta, mutta se ei ole autenttinen.'],
    ['Sisältää tekoälyllä luotua tai manipuloitua sisältöä', 'Tämä teos sisältää sisältöä, joka on luotu tai jota on manipuloitu tekoälyllä.'],
    ['Tekoälyllä luotu tai manipuloitu teksti', 'Tämä teksti on luotu tai sitä on manipuloitu tekoälyllä.'],
    ['Tunteiden tunnistus on käytössä', 'Tekoälyjärjestelmä analysoi täällä biometrisiä tietoja, kuten kasvonilmeitä tai ääntä, tunnistaakseen tai päätelläkseen tunteita tai aikomuksia. Tietosuojaselosteesta näet, miten henkilötietojasi käsitellään.'],
    ['Biometrinen luokittelu on käytössä', 'Tekoälyjärjestelmä käyttää täällä biometrisiä tietoja, kuten kasvokuvia, luokitellakseen ihmisiä esimerkiksi ikäryhmän mukaan. Tietosuojaselosteesta näet, miten henkilötietojasi käsitellään.'],
  ], { badge: 'Tekoäly', region: 'Tekoälytiedote', hide: 'Piilota ilmoitus', more: 'Lisätietoja', close: 'Sulje' }),

  pack('fr', 'translation', [
    ['Vous discutez avec un système d’IA.', 'Vous discutez avec un système d’intelligence artificielle, pas avec une personne. Ses réponses sont générées automatiquement.'],
    ['Image générée ou manipulée par IA', 'Cette image a été générée ou manipulée au moyen de l’intelligence artificielle. Elle peut sembler réelle, mais elle n’est pas authentique.'],
    ['Audio généré ou manipulé par IA', 'Cet enregistrement audio a été généré ou manipulé au moyen de l’intelligence artificielle. Il peut sembler réel, mais il n’est pas authentique.'],
    ['Vidéo générée ou manipulée par IA', 'Cette vidéo a été générée ou manipulée au moyen de l’intelligence artificielle. Elle peut sembler réelle, mais elle n’est pas authentique.'],
    ['Contient des contenus générés ou manipulés par IA', 'Cette œuvre contient des contenus générés ou manipulés au moyen de l’intelligence artificielle.'],
    ['Texte généré ou manipulé par IA', 'Ce texte a été généré ou manipulé au moyen de l’intelligence artificielle.'],
    ['Reconnaissance des émotions en cours', 'Ici, un système d’intelligence artificielle analyse des données biométriques, comme les expressions du visage ou la voix, pour identifier ou déduire des émotions ou des intentions. Consultez la politique de confidentialité pour savoir comment vos données à caractère personnel sont traitées.'],
    ['Catégorisation biométrique en cours', 'Ici, un système d’intelligence artificielle utilise des données biométriques, comme des images du visage, pour classer les personnes dans des catégories telles que la tranche d’âge. Consultez la politique de confidentialité pour savoir comment vos données à caractère personnel sont traitées.'],
  ], { badge: 'IA', region: 'Information sur l’IA', hide: 'Masquer l’avis', more: 'Plus d’informations', close: 'Fermer' }),

  pack('ga', 'translation', [
    ['Tá tú ag comhrá le córas intleachta saorga.', 'Tá tú ag comhrá le córas intleachta saorga, ní le duine. Gintear a fhreagraí go huathoibríoch.'],
    ['Íomhá a gineadh nó a ionramháladh le IS', 'Gineadh nó ionramháladh an íomhá seo le hintleacht shaorga. D’fhéadfadh cuma fhíor a bheith uirthi, ach níl sí barántúil.'],
    ['Fuaim a gineadh nó a ionramháladh le IS', 'Gineadh nó ionramháladh an fhuaim seo le hintleacht shaorga. B’fhéidir go mbeadh sí cosúil le fuaim fhíor, ach níl sí barántúil.'],
    ['Físeán a gineadh nó a ionramháladh le IS', 'Gineadh nó ionramháladh an físeán seo le hintleacht shaorga. D’fhéadfadh cuma fhíor a bheith air, ach níl sé barántúil.'],
    ['Tá ábhar a gineadh nó a ionramháladh le IS ann', 'Tá ábhar sa saothar seo a gineadh nó a ionramháladh le hintleacht shaorga.'],
    ['Téacs a gineadh nó a ionramháladh le IS', 'Gineadh nó ionramháladh an téacs seo le hintleacht shaorga.'],
    ['Aithint mothúchán in úsáid', 'Déanann córas intleachta saorga anseo anailís ar shonraí bithmhéadracha, amhail gnúis nó guth, chun mothúcháin nó intinní a aithint nó a thátal. Féach an fógra príobháideachais chun a fháil amach conas a phróiseáiltear do shonraí pearsanta.'],
    ['Catagóiriú bithmhéadrach in úsáid', 'Úsáideann córas intleachta saorga anseo sonraí bithmhéadracha, amhail íomhánna aghaidhe, chun daoine a shannadh do chatagóirí, amhail aoisghrúpa. Féach an fógra príobháideachais chun a fháil amach conas a phróiseáiltear do shonraí pearsanta.'],
  ], { badge: 'IS', region: 'Fógra IS', hide: 'Folaigh an fógra', more: 'Tuilleadh faisnéise', close: 'Dún' }),

  pack('hr', 'translation', [
    ['Razgovarate sa sustavom umjetne inteligencije.', 'Razgovarate sa sustavom umjetne inteligencije, a ne s osobom. Njegovi se odgovori generiraju automatski.'],
    ['Slika generirana ili manipulirana s pomoću UI-ja', 'Ova je slika generirana ili manipulirana s pomoću umjetne inteligencije. Može izgledati stvarno, ali nije autentična.'],
    ['Zvuk generiran ili manipuliran s pomoću UI-ja', 'Ovaj je zvučni zapis generiran ili manipuliran s pomoću umjetne inteligencije. Može zvučati stvarno, ali nije autentičan.'],
    ['Video generiran ili manipuliran s pomoću UI-ja', 'Ovaj je video generiran ili manipuliran s pomoću umjetne inteligencije. Može izgledati stvarno, ali nije autentičan.'],
    ['Sadržava sadržaj generiran ili manipuliran s pomoću UI-ja', 'Ovo djelo sadržava sadržaj koji je generiran ili manipuliran s pomoću umjetne inteligencije.'],
    ['Tekst generiran ili manipuliran s pomoću UI-ja', 'Ovaj je tekst generiran ili manipuliran s pomoću umjetne inteligencije.'],
    ['Upotrebljava se prepoznavanje emocija', 'Ovdje sustav umjetne inteligencije analizira biometrijske podatke, kao što su izrazi lica ili glas, kako bi prepoznao ili zaključio emocije ili namjere. Informacije o obradi vaših osobnih podataka potražite u obavijesti o privatnosti.'],
    ['Upotrebljava se biometrijska kategorizacija', 'Ovdje sustav umjetne inteligencije upotrebljava biometrijske podatke, kao što su slike lica, kako bi osobe svrstao u kategorije kao što je dobna skupina. Informacije o obradi vaših osobnih podataka potražite u obavijesti o privatnosti.'],
  ], { badge: 'UI', region: 'Obavijest o UI-ju', hide: 'Sakrij obavijest', more: 'Više informacija', close: 'Zatvori' }),

  pack('hu', 'translation', [
    ['Ön egy MI-rendszerrel cseveg.', 'Ön egy mesterséges intelligencián alapuló rendszerrel cseveg, nem emberrel. A válaszai automatikusan jönnek létre.'],
    ['MI-vel generált vagy manipulált kép', 'Ezt a képet mesterséges intelligenciával generálták vagy manipulálták. Valódinak tűnhet, de nem hiteles.'],
    ['MI-vel generált vagy manipulált hanganyag', 'Ezt a hanganyagot mesterséges intelligenciával generálták vagy manipulálták. Valódinak hangozhat, de nem hiteles.'],
    ['MI-vel generált vagy manipulált videó', 'Ezt a videót mesterséges intelligenciával generálták vagy manipulálták. Valódinak tűnhet, de nem hiteles.'],
    ['MI-vel generált vagy manipulált tartalmat tartalmaz', 'Ez a mű mesterséges intelligenciával generált vagy manipulált tartalmat tartalmaz.'],
    ['MI-vel generált vagy manipulált szöveg', 'Ezt a szöveget mesterséges intelligenciával generálták vagy manipulálták.'],
    ['Érzelemfelismerés működik', 'Itt egy mesterséges intelligencián alapuló rendszer biometrikus adatokat, például arckifejezést vagy hangot elemez, hogy érzelmeket vagy szándékokat azonosítson vagy következtessen ki. Személyes adatai kezeléséről az adatvédelmi tájékoztatóban olvashat.'],
    ['Biometrikus kategorizálás működik', 'Itt egy mesterséges intelligencián alapuló rendszer biometrikus adatokat, például arcképeket használ arra, hogy a személyeket kategóriákba, például korcsoportokba sorolja. Személyes adatai kezeléséről az adatvédelmi tájékoztatóban olvashat.'],
  ], { badge: 'MI', region: 'MI-tájékoztatás', hide: 'Értesítés elrejtése', more: 'További információ', close: 'Bezárás' }),

  pack('it', 'translation', [
    ['Stai chattando con un sistema di IA.', 'Stai chattando con un sistema di intelligenza artificiale, non con una persona. Le sue risposte sono generate automaticamente.'],
    ['Immagine generata o manipolata con l’IA', 'Questa immagine è stata generata o manipolata con l’intelligenza artificiale. Può sembrare reale, ma non è autentica.'],
    ['Audio generato o manipolato con l’IA', 'Questo audio è stato generato o manipolato con l’intelligenza artificiale. Può sembrare reale, ma non è autentico.'],
    ['Video generato o manipolato con l’IA', 'Questo video è stato generato o manipolato con l’intelligenza artificiale. Può sembrare reale, ma non è autentico.'],
    ['Contiene contenuti generati o manipolati con l’IA', 'Quest’opera contiene contenuti generati o manipolati con l’intelligenza artificiale.'],
    ['Testo generato o manipolato con l’IA', 'Questo testo è stato generato o manipolato con l’intelligenza artificiale.'],
    ['Riconoscimento delle emozioni in uso', 'Qui un sistema di intelligenza artificiale analizza dati biometrici, come espressioni del viso o voce, per identificare o dedurre emozioni o intenzioni. Consulta l’informativa sulla privacy per sapere come sono trattati i tuoi dati personali.'],
    ['Categorizzazione biometrica in uso', 'Qui un sistema di intelligenza artificiale utilizza dati biometrici, come immagini del viso, per assegnare le persone a categorie come la fascia d’età. Consulta l’informativa sulla privacy per sapere come sono trattati i tuoi dati personali.'],
  ], { badge: 'IA', region: 'Avviso sull’IA', hide: 'Nascondi avviso', more: 'Maggiori informazioni', close: 'Chiudi' }),

  pack('lt', 'translation', [
    ['Bendraujate su dirbtinio intelekto sistema.', 'Bendraujate su dirbtinio intelekto sistema, o ne su žmogumi. Jos atsakymai sugeneruojami automatiškai.'],
    ['DI sugeneruotas arba manipuliuotas vaizdas', 'Šis vaizdas sugeneruotas arba manipuliuotas naudojant dirbtinį intelektą. Jis gali atrodyti tikras, tačiau nėra autentiškas.'],
    ['DI sugeneruotas arba manipuliuotas garso įrašas', 'Šis garso įrašas sugeneruotas arba manipuliuotas naudojant dirbtinį intelektą. Jis gali skambėti tikroviškai, tačiau nėra autentiškas.'],
    ['DI sugeneruotas arba manipuliuotas vaizdo įrašas', 'Šis vaizdo įrašas sugeneruotas arba manipuliuotas naudojant dirbtinį intelektą. Jis gali atrodyti tikras, tačiau nėra autentiškas.'],
    ['Yra DI sugeneruoto arba manipuliuoto turinio', 'Šiame kūrinyje yra turinio, sugeneruoto arba manipuliuoto naudojant dirbtinį intelektą.'],
    ['DI sugeneruotas arba manipuliuotas tekstas', 'Šis tekstas sugeneruotas arba manipuliuotas naudojant dirbtinį intelektą.'],
    ['Naudojamas emocijų atpažinimas', 'Čia dirbtinio intelekto sistema analizuoja biometrinius duomenis, pavyzdžiui, veido išraišką ar balsą, kad atpažintų ar nustatytų emocijas ar ketinimus. Kaip tvarkomi jūsų asmens duomenys, rasite privatumo pranešime.'],
    ['Naudojamas biometrinis skirstymas į kategorijas', 'Čia dirbtinio intelekto sistema naudoja biometrinius duomenis, pavyzdžiui, veido atvaizdus, kad priskirtų žmones kategorijoms, pavyzdžiui, amžiaus grupei. Kaip tvarkomi jūsų asmens duomenys, rasite privatumo pranešime.'],
  ], { badge: 'DI', region: 'Informacija apie DI', hide: 'Slėpti pranešimą', more: 'Daugiau informacijos', close: 'Uždaryti' }),

  pack('lv', 'translation', [
    ['Jūs sarakstāties ar MI sistēmu.', 'Jūs sarakstāties ar mākslīgā intelekta sistēmu, nevis cilvēku. Tās atbildes tiek ģenerētas automātiski.'],
    ['Ar MI ģenerēts vai manipulēts attēls', 'Šis attēls ir ģenerēts vai manipulēts ar mākslīgo intelektu. Tas var izskatīties īsts, taču tas nav autentisks.'],
    ['Ar MI ģenerēts vai manipulēts audio', 'Šis audio ir ģenerēts vai manipulēts ar mākslīgo intelektu. Tas var izklausīties īsts, taču tas nav autentisks.'],
    ['Ar MI ģenerēts vai manipulēts video', 'Šis video ir ģenerēts vai manipulēts ar mākslīgo intelektu. Tas var izskatīties īsts, taču tas nav autentisks.'],
    ['Satur ar MI ģenerētu vai manipulētu saturu', 'Šis darbs satur saturu, kas ir ģenerēts vai manipulēts ar mākslīgo intelektu.'],
    ['Ar MI ģenerēts vai manipulēts teksts', 'Šis teksts ir ģenerēts vai manipulēts ar mākslīgo intelektu.'],
    ['Tiek izmantota emociju atpazīšana', 'Šeit mākslīgā intelekta sistēma analizē biometriskos datus, piemēram, sejas izteiksmi vai balsi, lai identificētu vai secinātu emocijas vai nodomus. Kā tiek apstrādāti jūsu personas dati, skatiet privātuma paziņojumā.'],
    ['Tiek izmantota biometriskā kategorizācija', 'Šeit mākslīgā intelekta sistēma izmanto biometriskos datus, piemēram, sejas attēlus, lai iedalītu cilvēkus kategorijās, piemēram, vecuma grupās. Kā tiek apstrādāti jūsu personas dati, skatiet privātuma paziņojumā.'],
  ], { badge: 'MI', region: 'Informācija par MI', hide: 'Paslēpt paziņojumu', more: 'Vairāk informācijas', close: 'Aizvērt' }),

  pack('mt', 'translation', [
    ['Qed tikkomunika ma’ sistema tal-IA.', 'Qed tikkomunika ma’ sistema tal-intelliġenza artifiċjali, mhux ma’ persuna. It-tweġibiet tagħha jiġu ġġenerati awtomatikament.'],
    ['Immaġni ġġenerata jew manipulata bl-IA', 'Din l-immaġni ġiet iġġenerata jew manipulata bl-intelliġenza artifiċjali. Tista’ tidher reali, iżda mhijiex awtentika.'],
    ['Awdjo ġġenerat jew manipulat bl-IA', 'Dan l-awdjo ġie ġġenerat jew manipulat bl-intelliġenza artifiċjali. Jista’ jinstema’ reali, iżda mhuwiex awtentiku.'],
    ['Vidjo ġġenerat jew manipulat bl-IA', 'Dan il-vidjo ġie ġġenerat jew manipulat bl-intelliġenza artifiċjali. Jista’ jidher reali, iżda mhuwiex awtentiku.'],
    ['Fih kontenut iġġenerat jew manipulat bl-IA', 'Dan ix-xogħol fih kontenut iġġenerat jew manipulat bl-intelliġenza artifiċjali.'],
    ['Test iġġenerat jew manipulat bl-IA', 'Dan it-test ġie ġġenerat jew manipulat bl-intelliġenza artifiċjali.'],
    ['Qed jintuża r-rikonoxximent tal-emozzjonijiet', 'Hawnhekk sistema tal-intelliġenza artifiċjali tanalizza data bijometrika, bħall-espressjonijiet tal-wiċċ jew il-vuċi, biex tidentifika jew tinferixxi emozzjonijiet jew intenzjonijiet. Ara l-avviż ta’ privatezza dwar kif tiġi pproċessata d-data personali tiegħek.'],
    ['Qed tintuża l-kategorizzazzjoni bijometrika', 'Hawnhekk sistema tal-intelliġenza artifiċjali tuża data bijometrika, bħal immaġnijiet tal-wiċċ, biex tassenja persuni f’kategoriji bħall-grupp tal-età. Ara l-avviż ta’ privatezza dwar kif tiġi pproċessata d-data personali tiegħek.'],
  ], { badge: 'IA', region: 'Avviż dwar l-IA', hide: 'Aħbi l-avviż', more: 'Aktar informazzjoni', close: 'Agħlaq' }),

  pack('nl', 'translation', [
    ['U chat met een AI-systeem.', 'U chat met een AI-systeem, niet met een mens. De antwoorden worden automatisch gegenereerd.'],
    ['Met AI gegenereerde of gemanipuleerde afbeelding', 'Deze afbeelding is met kunstmatige intelligentie gegenereerd of gemanipuleerd. Ze kan echt lijken, maar is niet authentiek.'],
    ['Met AI gegenereerde of gemanipuleerde audio', 'Deze audio is met kunstmatige intelligentie gegenereerd of gemanipuleerd. Ze kan echt klinken, maar is niet authentiek.'],
    ['Met AI gegenereerde of gemanipuleerde video', 'Deze video is met kunstmatige intelligentie gegenereerd of gemanipuleerd. Hij kan echt lijken, maar is niet authentiek.'],
    ['Bevat met AI gegenereerde of gemanipuleerde inhoud', 'Dit werk bevat inhoud die met kunstmatige intelligentie is gegenereerd of gemanipuleerd.'],
    ['Met AI gegenereerde of gemanipuleerde tekst', 'Deze tekst is met kunstmatige intelligentie gegenereerd of gemanipuleerd.'],
    ['Emotieherkenning in gebruik', 'Hier analyseert een AI-systeem biometrische gegevens, zoals gezichtsuitdrukkingen of stem, om emoties of intenties te herkennen of af te leiden. Lees in de privacyverklaring hoe uw persoonsgegevens worden verwerkt.'],
    ['Biometrische categorisering in gebruik', 'Hier gebruikt een AI-systeem biometrische gegevens, zoals gezichtsafbeeldingen, om mensen in te delen in categorieën zoals leeftijdsgroep. Lees in de privacyverklaring hoe uw persoonsgegevens worden verwerkt.'],
  ], { badge: 'AI', region: 'AI-melding', hide: 'Melding verbergen', more: 'Meer informatie', close: 'Sluiten' }),

  pack('pl', 'translation', [
    ['Rozmawiasz z systemem SI.', 'Rozmawiasz z systemem sztucznej inteligencji, a nie z człowiekiem. Jego odpowiedzi są generowane automatycznie.'],
    ['Obraz wygenerowany lub zmanipulowany przez SI', 'Ten obraz został wygenerowany lub zmanipulowany za pomocą sztucznej inteligencji. Może wyglądać realistycznie, ale nie jest autentyczny.'],
    ['Dźwięk wygenerowany lub zmanipulowany przez SI', 'Ten dźwięk został wygenerowany lub zmanipulowany za pomocą sztucznej inteligencji. Może brzmieć realistycznie, ale nie jest autentyczny.'],
    ['Wideo wygenerowane lub zmanipulowane przez SI', 'To wideo zostało wygenerowane lub zmanipulowane za pomocą sztucznej inteligencji. Może wyglądać realistycznie, ale nie jest autentyczne.'],
    ['Zawiera treści wygenerowane lub zmanipulowane przez SI', 'To dzieło zawiera treści wygenerowane lub zmanipulowane za pomocą sztucznej inteligencji.'],
    ['Tekst wygenerowany lub zmanipulowany przez SI', 'Ten tekst został wygenerowany lub zmanipulowany za pomocą sztucznej inteligencji.'],
    ['Działa rozpoznawanie emocji', 'System sztucznej inteligencji analizuje tutaj dane biometryczne, takie jak mimika twarzy lub głos, aby rozpoznać lub wywnioskować emocje lub zamiary. Informacje o przetwarzaniu Twoich danych osobowych znajdziesz w informacji o prywatności.'],
    ['Działa kategoryzacja biometryczna', 'System sztucznej inteligencji wykorzystuje tutaj dane biometryczne, takie jak wizerunki twarzy, aby przypisywać osoby do kategorii, na przykład grup wiekowych. Informacje o przetwarzaniu Twoich danych osobowych znajdziesz w informacji o prywatności.'],
  ], { badge: 'SI', region: 'Informacja o SI', hide: 'Ukryj komunikat', more: 'Więcej informacji', close: 'Zamknij' }),

  pack('pt', 'translation', [
    ['Está a conversar com um sistema de IA.', 'Está a conversar com um sistema de inteligência artificial, não com uma pessoa. As respostas são geradas automaticamente.'],
    ['Imagem gerada ou manipulada por IA', 'Esta imagem foi gerada ou manipulada com inteligência artificial. Pode parecer real, mas não é autêntica.'],
    ['Áudio gerado ou manipulado por IA', 'Este áudio foi gerado ou manipulado com inteligência artificial. Pode parecer real, mas não é autêntico.'],
    ['Vídeo gerado ou manipulado por IA', 'Este vídeo foi gerado ou manipulado com inteligência artificial. Pode parecer real, mas não é autêntico.'],
    ['Contém conteúdos gerados ou manipulados por IA', 'Esta obra contém conteúdos gerados ou manipulados com inteligência artificial.'],
    ['Texto gerado ou manipulado por IA', 'Este texto foi gerado ou manipulado com inteligência artificial.'],
    ['Reconhecimento de emoções em utilização', 'Aqui, um sistema de inteligência artificial analisa dados biométricos, como expressões faciais ou a voz, para identificar ou inferir emoções ou intenções. Consulte o aviso de privacidade para saber como os seus dados pessoais são tratados.'],
    ['Categorização biométrica em utilização', 'Aqui, um sistema de inteligência artificial utiliza dados biométricos, como imagens faciais, para atribuir pessoas a categorias como a faixa etária. Consulte o aviso de privacidade para saber como os seus dados pessoais são tratados.'],
  ], { badge: 'IA', region: 'Aviso sobre IA', hide: 'Ocultar aviso', more: 'Mais informações', close: 'Fechar' }),

  pack('ro', 'translation', [
    ['Conversați cu un sistem de IA.', 'Conversați cu un sistem de inteligență artificială, nu cu o persoană. Răspunsurile sale sunt generate automat.'],
    ['Imagine generată sau manipulată cu IA', 'Această imagine a fost generată sau manipulată cu ajutorul inteligenței artificiale. Poate părea reală, dar nu este autentică.'],
    ['Conținut audio generat sau manipulat cu IA', 'Acest conținut audio a fost generat sau manipulat cu ajutorul inteligenței artificiale. Poate suna real, dar nu este autentic.'],
    ['Videoclip generat sau manipulat cu IA', 'Acest videoclip a fost generat sau manipulat cu ajutorul inteligenței artificiale. Poate părea real, dar nu este autentic.'],
    ['Conține conținut generat sau manipulat cu IA', 'Această operă conține conținut generat sau manipulat cu ajutorul inteligenței artificiale.'],
    ['Text generat sau manipulat cu IA', 'Acest text a fost generat sau manipulat cu ajutorul inteligenței artificiale.'],
    ['Se utilizează recunoașterea emoțiilor', 'Aici, un sistem de inteligență artificială analizează date biometrice, cum ar fi expresiile faciale sau vocea, pentru a identifica sau a deduce emoții sau intenții. Consultați nota de informare privind confidențialitatea pentru a afla cum sunt prelucrate datele dumneavoastră cu caracter personal.'],
    ['Se utilizează clasificarea biometrică', 'Aici, un sistem de inteligență artificială utilizează date biometrice, cum ar fi imaginile faciale, pentru a încadra persoanele în categorii precum grupa de vârstă. Consultați nota de informare privind confidențialitatea pentru a afla cum sunt prelucrate datele dumneavoastră cu caracter personal.'],
  ], { badge: 'IA', region: 'Informare privind IA', hide: 'Ascundeți notificarea', more: 'Mai multe informații', close: 'Închideți' }),

  pack('sk', 'translation', [
    ['Komunikujete so systémom umelej inteligencie.', 'Komunikujete so systémom umelej inteligencie, nie s človekom. Jeho odpovede sa generujú automaticky.'],
    ['Obrázok vygenerovaný alebo zmanipulovaný pomocou AI', 'Tento obrázok bol vygenerovaný alebo zmanipulovaný pomocou umelej inteligencie. Môže vyzerať skutočne, ale nie je autentický.'],
    ['Zvuk vygenerovaný alebo zmanipulovaný pomocou AI', 'Tento zvukový záznam bol vygenerovaný alebo zmanipulovaný pomocou umelej inteligencie. Môže znieť skutočne, ale nie je autentický.'],
    ['Video vygenerované alebo zmanipulované pomocou AI', 'Toto video bolo vygenerované alebo zmanipulované pomocou umelej inteligencie. Môže vyzerať skutočne, ale nie je autentické.'],
    ['Obsahuje obsah vygenerovaný alebo zmanipulovaný pomocou AI', 'Toto dielo obsahuje obsah, ktorý bol vygenerovaný alebo zmanipulovaný pomocou umelej inteligencie.'],
    ['Text vygenerovaný alebo zmanipulovaný pomocou AI', 'Tento text bol vygenerovaný alebo zmanipulovaný pomocou umelej inteligencie.'],
    ['Používa sa rozpoznávanie emócií', 'Systém umelej inteligencie tu analyzuje biometrické údaje, napríklad výraz tváre alebo hlas, aby rozpoznal alebo odvodil emócie alebo úmysly. Informácie o spracúvaní vašich osobných údajov nájdete v oznámení o ochrane súkromia.'],
    ['Používa sa biometrická kategorizácia', 'Systém umelej inteligencie tu používa biometrické údaje, napríklad snímky tváre, na zaraďovanie osôb do kategórií, ako je veková skupina. Informácie o spracúvaní vašich osobných údajov nájdete v oznámení o ochrane súkromia.'],
  ], { badge: 'AI', region: 'Informácie o AI', hide: 'Skryť oznámenie', more: 'Ďalšie informácie', close: 'Zavrieť' }),

  pack('sl', 'translation', [
    ['Klepetate s sistemom umetne inteligence.', 'Klepetate s sistemom umetne inteligence, ne s človekom. Njegovi odgovori se ustvarjajo samodejno.'],
    ['Slika, ustvarjena ali manipulirana z UI', 'Ta slika je bila ustvarjena ali manipulirana z umetno inteligenco. Morda je videti resnična, vendar ni avtentična.'],
    ['Zvok, ustvarjen ali manipuliran z UI', 'Ta zvočni posnetek je bil ustvarjen ali manipuliran z umetno inteligenco. Morda zveni resnično, vendar ni avtentičen.'],
    ['Video, ustvarjen ali manipuliran z UI', 'Ta video je bil ustvarjen ali manipuliran z umetno inteligenco. Morda je videti resničen, vendar ni avtentičen.'],
    ['Vsebuje vsebino, ustvarjeno ali manipulirano z UI', 'To delo vsebuje vsebino, ki je bila ustvarjena ali manipulirana z umetno inteligenco.'],
    ['Besedilo, ustvarjeno ali manipulirano z UI', 'To besedilo je bilo ustvarjeno ali manipulirano z umetno inteligenco.'],
    ['V uporabi je prepoznavanje čustev', 'Sistem umetne inteligence tukaj analizira biometrične podatke, kot sta izraz obraza ali glas, da bi prepoznal ali sklepal o čustvih ali namerah. Kako se obdelujejo vaši osebni podatki, si oglejte v obvestilu o zasebnosti.'],
    ['V uporabi je biometrična kategorizacija', 'Sistem umetne inteligence tukaj uporablja biometrične podatke, kot so podobe obraza, da ljudi razvršča v kategorije, kot je starostna skupina. Kako se obdelujejo vaši osebni podatki, si oglejte v obvestilu o zasebnosti.'],
  ], { badge: 'UI', region: 'Obvestilo o UI', hide: 'Skrij obvestilo', more: 'Več informacij', close: 'Zapri' }),

  pack('sv', 'translation', [
    ['Du chattar med ett AI-system.', 'Du chattar med ett AI-system, inte med en människa. Svaren genereras automatiskt.'],
    ['AI-genererad eller manipulerad bild', 'Den här bilden har genererats eller manipulerats med artificiell intelligens. Den kan se äkta ut, men den är inte autentisk.'],
    ['AI-genererat eller manipulerat ljud', 'Det här ljudet har genererats eller manipulerats med artificiell intelligens. Det kan låta äkta, men det är inte autentiskt.'],
    ['AI-genererad eller manipulerad video', 'Den här videon har genererats eller manipulerats med artificiell intelligens. Den kan se äkta ut, men den är inte autentisk.'],
    ['Innehåller AI-genererat eller manipulerat innehåll', 'Det här verket innehåller innehåll som har genererats eller manipulerats med artificiell intelligens.'],
    ['AI-genererad eller manipulerad text', 'Den här texten har genererats eller manipulerats med artificiell intelligens.'],
    ['Känsloigenkänning används', 'Här analyserar ett AI-system biometriska uppgifter, till exempel ansiktsuttryck eller röst, för att identifiera eller härleda känslor eller avsikter. Läs integritetsmeddelandet för att se hur dina personuppgifter behandlas.'],
    ['Biometrisk kategorisering används', 'Här använder ett AI-system biometriska uppgifter, till exempel ansiktsbilder, för att dela in personer i kategorier som åldersgrupp. Läs integritetsmeddelandet för att se hur dina personuppgifter behandlas.'],
  ], { badge: 'AI', region: 'AI-information', hide: 'Dölj meddelandet', more: 'Mer information', close: 'Stäng' }),
]);
