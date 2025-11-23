import { useState, useEffect } from 'preact/hooks';
import confetti from 'canvas-confetti';
import { reportClientError } from '../utils/client-error';

interface Person {
    id: string;
    name: string;
    image: string;
    occupation?: string;
    sitelinks: number;
    birthYear?: number;
    funFact?: string;
}

interface Matchup {
    personA: Person;
    personB: Person;
    difficulty: 'easy' | 'medium' | 'hard';
}

interface GameData {
    date: string;
    matchups: Matchup[];
    sig: string;
}

interface ScoreResult {
    score: number;
    total: number;
    results: {
        correct: boolean;
        correctId: string;
        personA: Person;
        personB: Person;
    }[];
    streak?: {
        streak: number;
        best: number;
        lastDate: string;
    };
    error?: string;
}

interface PersonCardProps {
    person: Person;
    onClick: () => void;
    state: 'loading' | 'playing' | 'revealed' | 'finished';
    selected: boolean;
    isCorrect: boolean;
    isWrong: boolean;
}

export default function GameIsland() {
    const [gameData, setGameData] = useState<GameData | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState<'loading' | 'playing' | 'revealed' | 'finished'>('loading');
    const [userAnswers, setUserAnswers] = useState<string[]>([]);
    const [resultData, setResultData] = useState<ScoreResult | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [correctId, setCorrectId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
    const [clientId, setClientId] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

    useEffect(() => {
        const loadGame = async () => {
            const storedId = localStorage.getItem('slt-client-id');
            const newId = storedId || crypto.randomUUID();
            if (!storedId) localStorage.setItem('slt-client-id', newId);
            setClientId(newId);

            try {
                const res = await fetch('/api/today', { headers: { 'Accept-Language': 'id' } });
                if (!res.ok) throw new Error('Gagal memuat tantangan');
                const data = await res.json();
                setGameData(data);
                setGameState('playing');
            } catch (err) {
                console.error(err);
                setError('Gagal memuat tantangan hari ini. Coba muat ulang.');
                setGameState('finished');
                reportClientError(err as Error, { scope: 'load-game' });
            }
        };

        loadGame();
    }, []);

    const handleGuess = (id: string) => {
        if (gameState !== 'playing' || !gameData) return;

        setSelectedId(id);
        const currentMatchup = gameData.matchups[currentIndex];

        // Who is older? Smaller birth year.
        const pA = currentMatchup.personA;
        const pB = currentMatchup.personB;
        const olderId = pA.birthYear! < pB.birthYear! ? pA.id : pB.id;

        setCorrectId(olderId);
        setGameState('revealed');

        const isCorrect = id === olderId;
        if (isCorrect) {
            setScore(s => s + 1);
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
            setToast({ message: 'Benar!', tone: 'success' });
        }
        if (!isCorrect) {
            setToast({ message: 'Kurang tepat, coba lagi!', tone: 'error' });
        }

        setTimeout(() => setToast(null), 1400);

        const newAnswers = [...userAnswers, id];
        setUserAnswers(newAnswers);

        setTimeout(() => {
            if (currentIndex < gameData!.matchups.length - 1) {
                setCurrentIndex(c => c + 1);
                setGameState('playing');
                setSelectedId(null);
                setCorrectId(null);
            } else {
                finishGame(newAnswers);
            }
        }, 2000);
    };

    const finishGame = async (answers: string[]) => {
        setGameState('finished');
        if (!gameData) return;
        // Submit score
        try {
            const res = await fetch('/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: gameData.date,
                    answers,
                    sig: gameData.sig,
                    clientId
                })
            });
            const data = await res.json();
            setResultData(data as ScoreResult);
            if (data.score === gameData.matchups.length) {
                confetti({ particleCount: 150, spread: 100 });
            }
        } catch (e) {
            console.error(e);
            reportClientError(e as Error, { scope: 'submit-score' });
        }
    };

    if (gameState === 'loading') {
        return (
            <div className="max-w-md mx-auto p-4 space-y-4">
                <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
                <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="p-4 bg-white rounded-2xl shadow-lg space-y-3">
                            <div className="w-24 h-24 mx-auto rounded-full bg-slate-200 animate-pulse" />
                            <div className="h-4 bg-slate-200 rounded animate-pulse" />
                            <div className="h-3 bg-slate-100 rounded animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-4 bg-white rounded-2xl shadow-xl max-w-sm mx-auto mt-10">
                <h2 className="text-2xl font-bold mb-3 text-gray-800">Ada kendala</h2>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="bg-gray-900 text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-800 transition"
                >
                    Muat ulang
                </button>
            </div>
        );
    }

    if (gameState === 'finished') {
        return (
            <div className="text-center p-4 bg-white rounded-2xl shadow-xl max-w-sm mx-auto mt-10">
                <h2 className="text-3xl font-bold mb-4 text-gray-800">Permainan Selesai!</h2>
                <div className="text-6xl font-black text-blue-600 mb-4">{score} / {gameData?.matchups.length}</div>
                <p className="text-gray-600 mb-8">Kembali lagi besok untuk tantangan baru!</p>
                {resultData?.streak && (
                    <div className="mb-6 text-sm text-gray-700" aria-live="polite">
                        <div className="font-semibold">Streak sempurna: {resultData.streak.streak} hari</div>
                        <div>Rekor terbaik: {resultData.streak.best} hari</div>
                    </div>
                )}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left mb-6">
                    <div className="font-semibold mb-2 text-gray-800">Dapatkan kabar rilis dan recap mingguan?</div>
                    <div className="flex flex-col gap-2">
                        <input
                            type="email"
                            value={email}
                            onInput={(e: any) => setEmail(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                            placeholder="email@contoh.com"
                            aria-label="Email opsional"
                            disabled={emailStatus === 'loading' || emailStatus === 'done'}
                        />
                        <button
                            onClick={async () => {
                                if (!email) return;
                                try {
                                    setEmailStatus('loading');
                                    const res = await fetch('/api/subscribe', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ email })
                                    });
                                    if (!res.ok) throw new Error('Gagal menyimpan');
                                    setEmailStatus('done');
                                    setToast({ message: 'Terima kasih! Email tersimpan.', tone: 'success' });
                                } catch (err) {
                                    console.error(err);
                                    setEmailStatus('error');
                                    setToast({ message: 'Email gagal dikirim', tone: 'error' });
                                    reportClientError(err as Error, { scope: 'subscribe' });
                                }
                            }}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={emailStatus === 'loading' || emailStatus === 'done'}
                        >
                            {emailStatus === 'loading' ? 'Mengirim...' : emailStatus === 'done' ? 'Tersimpan' : 'Kirim' }
                        </button>
                        <p className="text-xs text-gray-500">Opsional. Kami simpan secara hash dan tidak membagikannya.</p>
                    </div>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="bg-gray-900 text-white px-8 py-3 rounded-full font-bold hover:bg-gray-800 transition transform hover:scale-105"
                >
                    Main Lagi
                </button>
            </div>
        );
    }

    if (!gameData) return null;

    const m = gameData.matchups[currentIndex];

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 relative min-h-[520px] flex flex-col justify-center gap-5">
            <div className="pointer-events-none fixed top-4 inset-x-0 flex justify-center z-50" aria-live="polite">
                {toast && (
                    <div className={`px-4 py-2 rounded-full shadow-lg text-sm font-semibold text-white ${toast.tone === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                        {toast.message}
                    </div>
                )}
            </div>
            <div className="flex justify-between items-center text-sm font-semibold text-gray-800">
                <span>Tantangan {gameData?.date}</span>
                <span className="text-gray-500">Skor: {score}</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                    className="h-2 bg-blue-600 transition-all"
                    style={{ width: `${((currentIndex) / (gameData.matchups.length)) * 100}%` }}
                    aria-hidden
                />
            </div>
            <div className="flex justify-end">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    m.difficulty === 'hard' ? 'bg-rose-100 text-rose-700' :
                    m.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                }`}>
                    {m.difficulty === 'hard' ? 'Sulit' : m.difficulty === 'medium' ? 'Sedang' : 'Mudah'}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
                <PersonCard
                    person={m.personA}
                    onClick={() => handleGuess(m.personA.id)}
                    state={gameState}
                    selected={selectedId === m.personA.id}
                    isCorrect={correctId === m.personA.id}
                    isWrong={selectedId === m.personA.id && correctId !== m.personA.id}
                />

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full w-12 h-12 flex items-center justify-center font-black text-gray-800 shadow-lg z-10 border-4 border-gray-100" aria-hidden>
                    VS
                </div>

                <PersonCard
                    person={m.personB}
                    onClick={() => handleGuess(m.personB.id)}
                    state={gameState}
                    selected={selectedId === m.personB.id}
                    isCorrect={correctId === m.personB.id}
                    isWrong={selectedId === m.personB.id && correctId !== m.personB.id}
                />
            </div>

            <div className="text-center mt-8 text-xl font-bold text-gray-800">
                Siapa yang lebih tua?
            </div>
        </div>
    );
} function PersonCard({ person, onClick, state, selected, isCorrect, isWrong }: PersonCardProps) {
    let borderClass = "border-transparent ring-0";
    let opacityClass = "opacity-100";

    if (state === 'revealed') {
        if (isCorrect) borderClass = "border-green-500 ring-4 ring-green-200";
        else if (isWrong) borderClass = "border-red-500 ring-4 ring-red-200";
        else opacityClass = "opacity-40 grayscale";
    }

    return (
        <button
            onClick={onClick}
            disabled={state !== 'playing'}
            aria-label={`Pilih ${person.name}${person.occupation ? `, ${person.occupation}` : ''}`}
            className={`relative group flex flex-col items-center p-4 bg-white rounded-2xl shadow-lg transition-all duration-300 transform hover:-translate-y-1 active:scale-95 border-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${borderClass} ${opacityClass} w-full h-full`}
        >
            <div className="w-24 h-24 mb-4 rounded-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 shadow-inner ring-4 ring-white">
                <img
                    src={`/api/image/${person.id}`}
                    alt={person.name}
                    width="96"
                    height="96"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition duration-500 ease-out"
                    sizes="96px"
                />
            </div>
            <h3 className="font-bold text-lg leading-tight mb-2 text-gray-900">{person.name}</h3>

            <div className={`transition-all duration-500 overflow-hidden ${state === 'revealed' ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="text-sm font-mono font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {person.birthYear}
                </div>
                {person.funFact && (
                    <div className="text-xs text-gray-600 mt-3 leading-snug">
                        {person.funFact}
                    </div>
                )}
            </div>
        </button>
    );
}
