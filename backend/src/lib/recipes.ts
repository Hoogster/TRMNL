export type Season = "spring" | "summer" | "autumn" | "winter";

export interface Recipe {
  name: string;
  description: string;
  prepMinutes: number;
  kidsNote: string;
}

export const SEASON_LABEL_DE: Record<Season, string> = {
  spring: "Frühling",
  summer: "Sommer",
  autumn: "Herbst",
  winter: "Winter",
};

/**
 * Curated, hand-picked family-friendly meals for German-speaking Central Europe, grouped
 * by season. No external recipe API is used here - free-tier options are either paid,
 * heavily rate-limited, or not curated for "family-friendly", so a small maintained list
 * beats an API integration that would need its own credentials and quota management for
 * comparatively little payoff. Add more any time by extending these arrays.
 */
export const RECIPES: Record<Season, Recipe[]> = {
  spring: [
    { name: "Spargelrisotto mit Parmesan", description: "Cremiges Risotto mit frischem grünem Spargel und Parmesan.", prepMinutes: 35, kidsNote: "Mild im Geschmack, kommt bei Kindern gut an" },
    { name: "Bärlauch-Gnocchi mit Cherrytomaten", description: "Selbstgemachte oder fertige Gnocchi in Bärlauch-Sahnesauce.", prepMinutes: 25, kidsNote: "Bärlauch-Menge nach Geschmack der Kinder anpassen" },
    { name: "Erbsen-Pasta mit Speck und Frühlingszwiebeln", description: "Schnelle Pasta mit süssen Erbsen, knusprigem Speck und Parmesan.", prepMinutes: 20, kidsNote: "Klassiker, der fast immer funktioniert" },
    { name: "Ofenpouletschenkel mit Radieschen-Salat", description: "Knusprige Pouletschenkel aus dem Ofen mit frischem Frühlingssalat.", prepMinutes: 45, kidsNote: "Pouletschenkel sind bei Kindern meist beliebt" },
    { name: "Kartoffel-Lauch-Suppe mit Croutons", description: "Cremige Suppe mit selbstgemachten Croutons zum Dippen.", prepMinutes: 30, kidsNote: "Suppe fein pürieren für kleinere Kinder" },
    { name: "Spinat-Ricotta-Cannelloni", description: "Gefüllte Nudelröllchen mit Spinat, Ricotta und Tomatensauce überbacken.", prepMinutes: 40, kidsNote: "Versteckt Gemüse gut in der Füllung" },
    { name: "Poulet-Gemüse-Spiesse mit Kräuterquark", description: "Bunte Spiesse vom Grill oder aus der Pfanne mit cremigem Kräuterquark.", prepMinutes: 30, kidsNote: "Kinder helfen gern beim Aufspiessen mit" },
    { name: "Rhabarber-Crumble", description: "Süss-säuerlicher Rhabarber unter knusprigen Streuseln, mit Vanillesauce.", prepMinutes: 35, kidsNote: "Beliebtes Dessert für den Frühlingssonntag" },
  ],
  summer: [
    { name: "Gegrillte Poulet-Spiesse mit Tomaten-Gurken-Salat", description: "Saftige Grillspiesse mit knackigem Sommersalat.", prepMinutes: 30, kidsNote: "Am Grillabend alle Familienmitglieder einbeziehen" },
    { name: "Zucchetti-Puffer mit Kräuterjoghurt", description: "Knusprige Gemüsepuffer aus Zucchetti mit frischem Kräuterjoghurt.", prepMinutes: 25, kidsNote: "Gute Methode, um Zucchetti unterzubringen" },
    { name: "Caprese-Pasta mit frischem Basilikum", description: "Pasta mit Tomaten, Mozzarella und viel frischem Basilikum.", prepMinutes: 20, kidsNote: "Einfach und mild, funktioniert fast immer" },
    { name: "Gefüllte Peperoni vom Grill", description: "Peperoni gefüllt mit Hackfleisch-Reis-Mischung, vom Grill oder aus dem Ofen.", prepMinutes: 45, kidsNote: "Milde Peperoni-Sorten für Kinder wählen" },
    { name: "Melonen-Feta-Salat mit Poulet-Streifen", description: "Erfrischender Sommersalat mit süsser Melone und salzigem Feta.", prepMinutes: 20, kidsNote: "Melone separat servieren, falls Feta nicht ankommt" },
    { name: "Fischspiesse mit Sommergemüse", description: "Fischwürfel und buntes Gemüse vom Grill mit Zitronen-Kräuter-Marinade.", prepMinutes: 30, kidsNote: "Gräten vorher sorgfältig entfernen" },
    { name: "Maiskolben und Burger vom Grill", description: "Hausgemachte Burger mit gegrilltem Maiskolben als Beilage.", prepMinutes: 35, kidsNote: "Klassiker für einen unkomplizierten Grillabend" },
    { name: "Auberginen-Curry mit Reis", description: "Mildes Kokos-Curry mit Auberginen und Sommergemüse.", prepMinutes: 35, kidsNote: "Schärfe bewusst mild halten" },
  ],
  autumn: [
    { name: "Kürbis-Ravioli mit Salbeibutter", description: "Fertige oder selbstgemachte Kürbisravioli in brauner Salbeibutter.", prepMinutes: 25, kidsNote: "Süsslicher Kürbisgeschmack kommt oft gut an" },
    { name: "Rüeblisuppe mit Ingwer", description: "Wärmende Karottensuppe mit einem Hauch Ingwer.", prepMinutes: 30, kidsNote: "Ingwer sparsam dosieren für milden Geschmack" },
    { name: "Pilzrisotto mit Rosmarin", description: "Cremiges Risotto mit gemischten Pilzen und Rosmarin.", prepMinutes: 40, kidsNote: "Pilze klein schneiden, falls nötig" },
    { name: "Ofengemüse mit Pouletbrust und Kräuterdip", description: "Buntes Herbstgemüse aus dem Ofen mit zartem Poulet und Dip.", prepMinutes: 40, kidsNote: "Gemüsesorten nach Vorlieben der Kinder auswählen" },
    { name: "Herbstlicher Linseneintopf mit Würstchen", description: "Herzhafter Eintopf mit Linsen, Wurzelgemüse und Würstchen.", prepMinutes: 45, kidsNote: "Sättigend für kühlere Tage" },
    { name: "Hackbraten mit Kartoffelstock", description: "Klassischer Hackbraten aus dem Ofen mit cremigem Kartoffelstock.", prepMinutes: 60, kidsNote: "Bewährter Familienklassiker" },
    { name: "Zwiebelwähe mit grünem Salat", description: "Herzhafte Wähe mit karamellisierten Zwiebeln, dazu ein frischer Salat.", prepMinutes: 50, kidsNote: "Mild und cremig, auch für wählerische Esser" },
    { name: "Randen-Risotto mit Ziegenkäse", description: "Leuchtend pinkes Risotto mit süsslichen Randen und cremigem Ziegenkäse.", prepMinutes: 40, kidsNote: "Die Farbe begeistert oft schon vor dem ersten Bissen" },
  ],
  winter: [
    { name: "Käsefondue mit Brot und Gemüse", description: "Klassisches Fondue mit Brotwürfeln und Gemüsesticks zum Dippen.", prepMinutes: 20, kidsNote: "Gemeinsames Dippen macht allen Spass" },
    { name: "Älplermagronen mit Apfelmus", description: "Herzhafte Käse-Kartoffel-Nudeln mit süssem Apfelmus dazu.", prepMinutes: 35, kidsNote: "Schweizer Familienklassiker" },
    { name: "Rindsvoressen mit Kartoffelstock", description: "Zartes, geschmortes Rindfleisch mit cremigem Kartoffelstock.", prepMinutes: 90, kidsNote: "Lange Garzeit, aber wenig Aufwand zwischendurch" },
    { name: "Ofenkartoffeln mit Quark und Speck", description: "Knusprige Ofenkartoffeln mit cremigem Quark und knusprigem Speck.", prepMinutes: 45, kidsNote: "Einfach und beliebt, auch als Resteverwertung" },
    { name: "Poulet-Curry mit Kokosmilch und Reis", description: "Mildes, wärmendes Curry mit zartem Poulet und Kokosmilch.", prepMinutes: 35, kidsNote: "Schärfe weglassen für Kinderportionen" },
    { name: "Rösti mit Spiegelei und Apfelmus", description: "Knusprige Rösti mit Spiegelei und süssem Apfelmus.", prepMinutes: 30, kidsNote: "Schnell gemacht an stressigen Wochentagen" },
    { name: "Gemüse-Lasagne", description: "Ofenfrische Lasagne mit Winter-Gemüse und viel Käse überbacken.", prepMinutes: 55, kidsNote: "Gemüse fein schneiden für weniger wählerische Esser" },
    { name: "Chäshörnli mit Apfelmus", description: "Käse-Hörnli mit gerösteten Zwiebeln und süssem Apfelmus.", prepMinutes: 25, kidsNote: "Schneller Wochentags-Favorit" },
  ],
};
