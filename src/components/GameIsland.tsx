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
                const res = await fetch('/api/today?v=2', { headers: { 'Accept-Language': 'id' } });
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
            if (res.status === 409) {
                setToast({ message: 'Kamu sudah main hari ini. Kembali besok!', tone: 'error' });
                return;
            }
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
            <div className="max-w-2xl mx-auto p-6 space-y-6">
                <div className="h-4 w-40 bg-slate-800 rounded-full animate-pulse mx-auto" />
                <div className="h-2 w-full bg-slate-800 rounded-full animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                        <div key={i} className="aspect-[3/4] p-5 bg-slate-900 rounded-3xl border border-slate-800 space-y-4 flex flex-col items-center justify-center">
                            <div className="w-28 h-28 rounded-3xl bg-slate-800 animate-pulse" />
                            <div className="h-4 w-28 bg-slate-800 rounded animate-pulse" />
                            <div className="h-3 w-20 bg-slate-800 rounded animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-8 bg-slate-800/80 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-700 max-w-sm mx-auto mt-10">
                <div className="text-4xl mb-4">😕</div>
                <h2 className="text-2xl font-bold mb-3 text-white">Ada kendala</h2>
                <p className="text-slate-400 mb-6">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="bg-white text-slate-900 px-6 py-3 rounded-full font-bold hover:bg-slate-200 transition active:scale-95"
                >
                    Muat ulang
                </button>
            </div>
        );
    }

    if (gameState === 'finished') {
        return (
            <div className="text-center p-8 bg-slate-800/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-700/50 max-w-sm mx-auto mt-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

                <h2 className="text-3xl font-black mb-2 text-white tracking-tight">Permainan Selesai!</h2>
                <p className="text-slate-400 mb-6 text-sm">Tantangan hari ini tuntas.</p>

                <div className="relative inline-block mb-8">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 blur-xl opacity-50 rounded-full"></div>
                    <div className="relative text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-300">
                        {score}<span className="text-4xl text-slate-500">/{gameData?.matchups.length}</span>
                    </div>
                </div>

                {resultData?.streak && (
                    <div className="mb-8 grid grid-cols-2 gap-3">
                        <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-700/50">
                            <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Streak</div>
                            <div className="text-xl font-black text-orange-400">🔥 {resultData.streak.streak}</div>
                        </div>
                        <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-700/50">
                            <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Terbaik</div>
                            <div className="text-xl font-black text-emerald-400">🏆 {resultData.streak.best}</div>
                        </div>
                    </div>
                )}

                <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-5 text-left mb-8">
                    <div className="font-bold mb-2 text-white text-sm">Dapatkan notifikasi & recap? 📩</div>
                    <div className="flex flex-col gap-3">
                        <input
                            type="email"
                            value={email}
                            onInput={(e: any) => setEmail(e.target.value)}
                            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            placeholder="email@kamu.com"
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
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
                            disabled={emailStatus === 'loading' || emailStatus === 'done'}
                        >
                            {emailStatus === 'loading' ? 'Mengirim...' : emailStatus === 'done' ? '✅ Tersimpan' : 'Kirim'}
                        </button>
                        <p className="text-[10px] text-slate-500 text-center">Kami menjaga privasimu. Unsubscribe kapan saja.</p>
                    </div>
                </div>

                <button
                    onClick={() => window.location.reload()}
                    className="w-full bg-white text-slate-900 px-8 py-4 rounded-full font-black hover:bg-slate-200 transition transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    Main Lagi
                </button>
            </div>
        );
    }

    if (!gameData) return null;

    const m = gameData.matchups[currentIndex];

    return (
        <div className="max-w-2xl mx-auto p-5 sm:p-8 relative min-h-[520px] flex flex-col justify-center gap-6">
            <div className="pointer-events-none fixed top-6 inset-x-0 flex justify-center z-50" aria-live="polite">
                {toast && (
                    <div className={`px-6 py-3 rounded-full shadow-2xl text-sm font-bold text-white animate-pop ${toast.tone === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                        {toast.message}
                    </div>
                )}
            </div>

            <div className="flex justify-between items-end px-2">
                <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                    {gameData?.date}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Skor</span>
                    <span className="text-2xl font-black text-white">{score}</span>
                </div>
            </div>

            <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
                    style={{ width: `${((currentIndex) / (gameData.matchups.length)) * 100}%` }}
                    aria-hidden
                />
            </div>

            <div className="flex justify-center">
                <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full border ${m.difficulty === 'hard' ? 'bg-rose-900 text-rose-100 border-rose-600/60' :
                        m.difficulty === 'medium' ? 'bg-amber-900 text-amber-100 border-amber-600/60' :
                            'bg-emerald-900 text-emerald-100 border-emerald-600/60'
                    }`}>
                    Level: {m.difficulty === 'hard' ? 'Sulit' : m.difficulty === 'medium' ? 'Sedang' : 'Mudah'}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 relative mt-2">
                <PersonCard
                    person={m.personA}
                    onClick={() => handleGuess(m.personA.id)}
                    state={gameState}
                    selected={selectedId === m.personA.id}
                    isCorrect={correctId === m.personA.id}
                    isWrong={selectedId === m.personA.id && correctId !== m.personA.id}
                />

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <div className="bg-slate-900 rounded-full w-14 h-14 flex items-center justify-center font-black text-white shadow-xl border-4 border-slate-800">
                        <span className="text-transparent bg-clip-text bg-gradient-to-br from-sky-400 to-cyan-300 text-lg">VS</span>
                    </div>
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

            <div className="text-center mt-4">
                <p className="text-slate-400 text-sm font-medium animate-pulse">
                    Pilih yang <span className="text-white font-bold">lebih tua</span>
                </p>
            </div>
        </div>
    );
} function PersonCard({ person, onClick, state, selected, isCorrect, isWrong }: PersonCardProps) {
    let borderClass = "border-slate-700 hover:border-slate-500";
    let ringClass = "ring-0";
    let bgClass = "bg-slate-800/50 backdrop-blur-sm";
    let opacityClass = "opacity-100";
    let scaleClass = "scale-100";

    if (state === 'revealed') {
        if (isCorrect) {
            borderClass = "border-emerald-500";
            ringClass = "ring-4 ring-emerald-500/20";
            bgClass = "bg-emerald-950/40";
        } else if (isWrong) {
            borderClass = "border-rose-500";
            ringClass = "ring-4 ring-rose-500/20";
            bgClass = "bg-rose-950/40";
        } else {
            opacityClass = "opacity-30 grayscale";
            scaleClass = "scale-95";
        }
    }

    return (
        <button
            onClick={onClick}
            disabled={state !== 'playing'}
            aria-label={`Pilih ${person.name}`}
            className={`
                relative group flex flex-col items-center p-6 rounded-3xl shadow-2xl 
                transition-all duration-300 ease-out
                border-2 ${borderClass} ${ringClass} ${bgClass} ${opacityClass} ${scaleClass}
                w-full h-full
                hover:-translate-y-1 active:scale-[0.98]
                focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/50
            `}
        >
            <div className="relative w-28 h-28 mb-5 rounded-full p-1 bg-gradient-to-br from-blue-400 to-purple-500 shadow-lg group-hover:shadow-purple-500/30 transition-shadow duration-300">
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 border-2 border-slate-900">
                    <img
                        src={`/api/image/${person.id}`}
                        alt={person.name}
                        width="112"
                        height="112"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                </div>
            </div>

            <h3 className="font-bold text-xl leading-tight mb-1 text-white group-hover:text-purple-200 transition-colors">
                {person.name}
            </h3>

            {person.occupation && (
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    {person.occupation}
                </p>
            )}

            <div className={`transition-all duration-500 overflow-hidden w-full ${state === 'revealed' ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                <div className="inline-block text-lg font-black text-white bg-gradient-to-r from-blue-500 to-purple-600 px-5 py-1.5 rounded-full shadow-lg mb-3 animate-fade-in-up">
                    {person.birthYear}
                </div>
                {person.funFact && (
                    <div className="text-xs text-slate-300 mt-1 leading-relaxed border-t border-white/10 pt-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                        {person.funFact}
                    </div>
                )}
            </div>
        </button>
    );
}
