export interface Person {
    id: string;
    name: string;
    birthDate: string;
    birthYear: number;
    image: string;
    occupation?: string;
    funFact?: string;
    sitelinks: number;
}

export interface Matchup {
    personA: Person;
    personB: Person;
    olderId: string;
    difficulty: 'easy' | 'medium' | 'hard';
    ageGap: number;
}

// Simple seeded random number generator (Mulberry32)
function mulberry32(a: number) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

export function generateMatchups(people: Person[], dateSeed: string, count: number = 10): Matchup[] {
    // Convert date string (YYYY-MM-DD) to a number seed
    const seed = parseInt(dateSeed.replace(/-/g, ''), 10);
    const random = mulberry32(seed);

    const matchups: Matchup[] = [];
    const usedIds = new Set<string>();

    // We want a mix of difficulties: 2 hard, 2 medium, 1 easy
    const targets = [
        { type: 'hard', min: 0, max: 4, count: 3 },
        { type: 'medium', min: 4, max: 12, count: 4 },
        { type: 'easy', min: 12, max: 80, count: 3 }
    ];

    // Shuffle people first to get randomness
    const shuffledPeople = [...people].sort(() => random() - 0.5);

    for (const target of targets) {
        let found = 0;
        // Try to find pairs
        for (let i = 0; i < shuffledPeople.length; i++) {
            if (found >= target.count) break;

            const p1 = shuffledPeople[i];
            if (usedIds.has(p1.id)) continue;

            for (let j = i + 1; j < shuffledPeople.length; j++) {
                const p2 = shuffledPeople[j];
                if (usedIds.has(p2.id)) continue;

                const ageGap = Math.abs(p1.birthYear - p2.birthYear);

                if (ageGap >= target.min && ageGap < target.max) {
                    matchups.push({
                        personA: p1,
                        personB: p2,
                        olderId: p1.birthDate < p2.birthDate ? p1.id : p2.id,
                        difficulty: target.type as any,
                        ageGap
                    });
                    usedIds.add(p1.id);
                    usedIds.add(p2.id);
                    found++;
                    break; // Move to next p1
                }
            }
        }
    }

    // If we didn't fill enough, fill with random remaining pairs
    while (matchups.length < count) {
        // Find two unused people
        let p1: Person | undefined, p2: Person | undefined;

        for (const p of shuffledPeople) {
            if (!usedIds.has(p.id)) {
                if (!p1) p1 = p;
                else if (!p2) {
                    p2 = p;
                    break;
                }
            }
        }

        if (p1 && p2) {
            const ageGap = Math.abs(p1.birthYear - p2.birthYear);
            let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
            if (ageGap < 5) difficulty = 'hard';
            else if (ageGap > 20) difficulty = 'easy';

            matchups.push({
                personA: p1,
                personB: p2,
                olderId: p1.birthDate < p2.birthDate ? p1.id : p2.id,
                difficulty,
                ageGap
            });
            usedIds.add(p1.id);
            usedIds.add(p2.id);
        } else {
            break; // No more people
        }
    }

    // Randomize orientation per pair for fairness
    return matchups.map((m) => {
        if (random() > 0.5) {
            return {
                ...m,
                personA: m.personB,
                personB: m.personA
            };
        }
        return m;
    });
}
