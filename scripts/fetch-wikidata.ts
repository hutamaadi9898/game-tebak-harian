import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const MAX_FUN_FACT_LENGTH = 160;

// SPARQL query to get popular Indonesian citizens with images and birth dates
const SPARQL_QUERY = `
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX wikibase: <http://wikiba.se/ontology#>

SELECT ?item ?itemLabel ?itemDescription ?dob ?image ?sitelinks (SAMPLE(?occLabel) AS ?occupationLabel)
WHERE {
  ?item wdt:P31 wd:Q5;            # Instance of Human
        wdt:P27 wd:Q252;          # Country of citizenship: Indonesia (guard rail for Phase 0)
        wdt:P18 ?image;           # Has image
        wdt:P569 ?dob;            # Has Date of Birth
        wikibase:sitelinks ?sitelinks.

  ?item wdt:P106 ?occ.
  VALUES ?allowedOcc {
    wd:Q177220   # singer
    wd:Q33999    # actor
    wd:Q245068   # comedian
    wd:Q356183   # YouTuber
  }
  FILTER(?occ = ?allowedOcc)
  ?occ rdfs:label ?occLabel.
  FILTER(LANG(?occLabel) IN ("id", "en"))

  FILTER(?sitelinks > 5)
  FILTER(?dob >= "1960-01-01T00:00:00Z"^^xsd:dateTime)
  FILTER(NOT EXISTS { ?item wdt:P106 wd:Q82955 }) # exclude politicians

  SERVICE wikibase:label { bd:serviceParam wikibase:language "id,en". }
}
GROUP BY ?item ?itemLabel ?itemDescription ?dob ?image ?sitelinks
ORDER BY DESC(?sitelinks)
LIMIT 300
`;

const RawPersonSchema = z.object({
    item: z.object({ value: z.string() }),
    itemLabel: z.object({ value: z.string() }),
    itemDescription: z.object({ value: z.string() }).optional(),
    dob: z.object({ value: z.string() }),
    image: z.object({ value: z.string() }),
    sitelinks: z.object({ value: z.string() }),
    occupationLabel: z.object({ value: z.string() }).optional(),
});

const PersonSchema = z.object({
    id: z.string(),
    name: z.string(),
    birthDate: z.string(), // ISO date
    birthYear: z.number(),
    image: z.string(),
    occupation: z.string().optional(),
    funFact: z.string().optional(),
    sitelinks: z.number(),
});

type Person = z.infer<typeof PersonSchema>;

const MOCK_PEOPLE: Person[] = [
    { id: "Q12462469", name: "Agnez Mo", birthDate: "1986-07-01T00:00:00Z", birthYear: 1986, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Agnez_Mo_Java_Jazz_Festival_2016.jpg/220px-Agnez_Mo_Java_Jazz_Festival_2016.jpg", occupation: "penyanyi", funFact: "Penyanyi dan aktris Indonesia yang go international.", sitelinks: 90 },
    { id: "Q610843", name: "Ariel Noah", birthDate: "1981-09-16T00:00:00Z", birthYear: 1981, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Ariel_NOAH.jpg/220px-Ariel_NOAH.jpg", occupation: "vokalis", funFact: "Vokalis band NOAH, aktif sejak 2000-an.", sitelinks: 60 },
    { id: "Q3335989", name: "Raisa Andriana", birthDate: "1990-06-06T00:00:00Z", birthYear: 1990, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Raisa_Andriana_at_Indonesia_Fashion_Week_2013.jpg/220px-Raisa_Andriana_at_Indonesia_Fashion_Week_2013.jpg", occupation: "penyanyi", funFact: "Penyanyi pop Indonesia dengan banyak single multi-platinum.", sitelinks: 55 },
    { id: "Q17146411", name: "Isyana Sarasvati", birthDate: "1993-05-02T00:00:00Z", birthYear: 1993, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Isyana_Sarasvati_May_2023.jpg/220px-Isyana_Sarasvati_May_2023.jpg", occupation: "penyanyi", funFact: "Penyanyi-penulis lagu klasik-modern, lahir 1993.", sitelinks: 40 },
    { id: "Q16025179", name: "Atta Halilintar", birthDate: "1994-11-20T00:00:00Z", birthYear: 1994, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Atta_Halilintar_2020.jpg/220px-Atta_Halilintar_2020.jpg", occupation: "YouTuber", funFact: "Salah satu YouTuber Indonesia pertama yang tembus 10 juta subscriber.", sitelinks: 35 },
    { id: "Q18577286", name: "Ria Ricis", birthDate: "1995-07-01T00:00:00Z", birthYear: 1995, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Ria_Ricis.jpg/220px-Ria_Ricis.jpg", occupation: "YouTuber", funFact: "Konten kreator dan aktris, lahir 1995.", sitelinks: 30 },
    { id: "Q4826069", name: "Aya Anjani", birthDate: "1991-10-01T00:00:00Z", birthYear: 1991, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Aya_Anjani.jpg/220px-Aya_Anjani.jpg", occupation: "penyanyi", funFact: "Penyanyi-penulis lagu indie, putri Dian Pramana Poetra.", sitelinks: 20 },
    { id: "Q15956963", name: "Tulus", birthDate: "1987-08-20T00:00:00Z", birthYear: 1987, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Tulus_singer.jpg/220px-Tulus_singer.jpg", occupation: "penyanyi", funFact: "Penyanyi-penulis lagu dengan suara bariton khas.", sitelinks: 50 },
    { id: "Q18902019", name: "Marion Jola", birthDate: "2000-06-12T00:00:00Z", birthYear: 2000, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Marion_Jola.jpg/220px-Marion_Jola.jpg", occupation: "penyanyi", funFact: "Finalis Indonesian Idol 2018 yang merilis hits RnB-pop.", sitelinks: 18 },
    { id: "Q7349812", name: "Rina Nose", birthDate: "1984-01-16T00:00:00Z", birthYear: 1984, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Rina_Nose.jpg/220px-Rina_Nose.jpg", occupation: "komedian", funFact: "Presenter dan komedian dengan karakter parodi yang khas.", sitelinks: 25 }
];

function cleanSentence(value?: string | null): string | undefined {
    if (!value) return undefined;
    const trimmed = value.replace(/\s+/g, ' ').trim();
    if (!trimmed) return undefined;
    const sentence = trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
    const capitalized = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    return capitalized.length > MAX_FUN_FACT_LENGTH
        ? `${capitalized.slice(0, MAX_FUN_FACT_LENGTH - 1).trimEnd()}…`
        : capitalized;
}

function buildFunFact(birthYear: number, occupation?: string, description?: string) {
    // Prefer human-written description, fall back to occupation + birth year.
    const normalizedDescription = cleanSentence(description);
    if (normalizedDescription) return normalizedDescription;

    const normalizedOccupation = occupation?.trim();
    const base = normalizedOccupation
        ? `${normalizedOccupation} kelahiran ${birthYear}.`
        : `Lahir ${birthYear}.`;

    return cleanSentence(base);
}

async function fetchWikidata() {
    console.log('Fetching data from Wikidata...');
    const url = `${ENDPOINT}?query=${encodeURIComponent(SPARQL_QUERY)}&format=json`;

    let people: Person[] = [];

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'GuessGame/1.0 (bot)',
                'Accept': 'application/sparql-results+json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const data = await response.json() as any;
        const bindings = data.results.bindings;

        console.log(`Fetched ${bindings.length} raw records.`);

        const seen = new Set<string>();

        for (const record of bindings) {
            try {
                const validRecord = RawPersonSchema.parse(record);

                const id = validRecord.item.value.split('/').pop()!;
                const name = validRecord.itemLabel.value;
                const occupation = validRecord.occupationLabel?.value;
                const description = validRecord.itemDescription?.value;

                // Clean up date (Wikidata dates can be weird like 1980-00-00)
                let dob = validRecord.dob.value;
                if (dob.endsWith('T00:00:00Z')) {
                    // Keep it simple
                }

                const birthDateObj = new Date(dob);
                const birthYear = birthDateObj.getFullYear();

                // Dedupe by ID or Name+Year
                const key = `${name}-${birthYear}`;
                if (seen.has(id) || seen.has(key)) continue;

                // Basic validation for valid year and not future
                if (isNaN(birthYear) || birthYear > new Date().getFullYear()) continue;

                seen.add(id);
                seen.add(key);

                people.push({
                    id,
                    name,
                    birthDate: dob,
                    birthYear,
                    image: validRecord.image.value,
                    occupation: occupation || undefined,
                    funFact: buildFunFact(birthYear, occupation, description),
                    sitelinks: parseInt(validRecord.sitelinks.value, 10)
                });

            } catch (e) {
                // Skip invalid records
                continue;
            }
        }
    } catch (error) {
        console.error('Error fetching from Wikidata, using mock data:', error);
        people = MOCK_PEOPLE;
    }

    console.log(`Processed ${people.length} valid unique people.`);

    const outputPath = path.join(process.cwd(), 'src/data/people.json');
    await fs.writeFile(outputPath, JSON.stringify(people, null, 2));
    console.log(`Wrote data to ${outputPath}`);
}

fetchWikidata().catch(console.error);
