/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Database, 
  BarChart3, 
  Settings, 
  LogOut, 
  ChevronRight,
  Trophy,
  History,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  orderBy,
  limit,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Test, TestResult, UserProfile, Question } from './types';

// Mock data for initial states
const MOCK_TESTS: Test[] = [
  {
    id: 'mat-2023-1',
    title: 'Cermat Matematika 2023 (1. řádný)',
    subject: 'MAT',
    year: 2023,
    term: 'řádný',
    durationMinutes: 70,
    totalPoints: 50,
    questions: [
      {
        id: 'q1',
        text: 'Vypočítejte: (-2)^2 - 3^2',
        type: 'open-ended',
        correctAnswer: '-5',
        points: 2
      },
      {
        id: 'q2',
        text: 'Které z následujících čísel je největší?',
        type: 'single-choice',
        options: ['0.5', '1/3', '0.45', '2/5'],
        correctAnswer: '0.5',
        points: 1
      }
    ]
  },
  {
    id: 'cjl-2023-1',
    title: 'Cermat Čeština 2023 (1. řádný)',
    subject: 'CJL',
    year: 2023,
    term: 'řádný',
    durationMinutes: 75,
    totalPoints: 50,
    questions: [
      {
        id: 'q1',
        text: 'Ve které z následujících vět je pravopisná chyba?',
        type: 'single-choice',
        options: [
          'Psi hlasitě štěkali.',
          'Dívky se smáli.',
          'Děti si hrály v parku.',
          'Husaři jeli na koních.'
        ],
        correctAnswer: 'Dívky se smáli.',
        points: 1
      }
    ]
  }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentTest, setCurrentTest] = useState<Test | null>(null);
  const [testAnswers, setTestAnswers] = useState<Record<string, any>>({});
  const [isTakingTest, setIsTakingTest] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [availableTests, setAvailableTests] = useState<Test[]>(MOCK_TESTS);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch or create profile
        const profileRef = doc(db, 'users', u.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          setProfile(profileSnap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || 'Uživatel',
            stats: {
              testsTaken: 0,
              averageScore: 0,
              totalPoints: 0,
              lastActive: new Date().toISOString()
            }
          };
          await setDoc(profileRef, newProfile);
          setProfile(newProfile);
        }

        // Fetch results
        const resultsQuery = query(
          collection(db, 'results'),
          where('userId', '==', u.uid),
          orderBy('completedAt', 'desc'),
          limit(10)
        );
        const resultsSnap = await getDocs(resultsQuery);
        setTestResults(resultsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TestResult)));
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const startTest = (test: Test) => {
    setCurrentTest(test);
    setTestAnswers({});
    setIsTakingTest(true);
  };

  const submitTest = async () => {
    if (!currentTest || !user) return;

    let score = 0;
    currentTest.questions.forEach(q => {
      if (testAnswers[q.id] === q.correctAnswer) {
        score += q.points;
      }
    });

    const result: Omit<TestResult, 'id'> = {
      testId: currentTest.id,
      userId: user.uid,
      score,
      maxScore: currentTest.totalPoints,
      completedAt: new Date().toISOString(),
      answers: testAnswers
    };

    try {
      await addDoc(collection(db, 'results'), result);
      
      // Update profile stats
      if (profile) {
        const newStats = {
          ...profile.stats,
          testsTaken: profile.stats.testsTaken + 1,
          totalPoints: profile.stats.totalPoints + score,
          averageScore: Math.round(((profile.stats.averageScore * profile.stats.testsTaken) + (score / currentTest.totalPoints * 100)) / (profile.stats.testsTaken + 1)),
          lastActive: new Date().toISOString()
        };
        const newProfile = { ...profile, stats: newStats };
        await setDoc(doc(db, 'users', user.uid), newProfile);
        setProfile(newProfile);
      }

      // Refresh results list
      setTestResults(prev => [{ ...result, id: Date.now().toString() }, ...prev].slice(0, 10));
      setIsTakingTest(false);
      setCurrentTest(null);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Error submitting test:', error);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold text-accent">CerMate</h1>
            <p className="text-text-secondary">Tvoje cesta k úspěšné maturitě začíná zde.</p>
          </div>
          <div className="py-8">
            <LayoutDashboard className="w-20 h-20 text-accent/50 mx-auto" />
          </div>
          <button 
            onClick={handleLogin}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Přihlásit se přes Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-card-border bg-bg p-6 flex flex-col hidden md:flex">
        <div className="logo text-2xl font-black text-accent mb-12 flex items-center gap-2">
          CerMate
        </div>
        
        <nav className="flex-1 space-y-2">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<BookOpen size={20} />} 
            label="Moje Testy" 
            active={activeTab === 'my-tests'} 
            onClick={() => setActiveTab('my-tests')} 
          />
          <NavItem 
            icon={<Database size={20} />} 
            label="Databáze (Cermat)" 
            active={activeTab === 'database'} 
            onClick={() => setActiveTab('database')} 
          />
          <NavItem 
            icon={<BarChart3 size={20} />} 
            label="Analýza výsledků" 
            active={activeTab === 'analysis'} 
            onClick={() => setActiveTab('analysis')} 
          />
        </nav>

        <div className="pt-6 border-t border-card-border space-y-2">
          <NavItem icon={<Settings size={20} />} label="Nastavení" />
          <NavItem 
            icon={<LogOut size={20} />} 
            label="Odhlásit" 
            onClick={() => signOut(auth)}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {isTakingTest && currentTest ? (
            <motion.div
              key="test-session"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => setIsTakingTest(false)}
                  className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                  <ArrowLeft size={18} /> Zpět
                </button>
                <div className="text-center">
                  <h2 className="text-xl font-bold">{currentTest.title}</h2>
                  <div className="flex items-center gap-4 text-sm text-text-secondary justify-center mt-1">
                    <span className="flex items-center gap-1"><Clock size={14} /> {currentTest.durationMinutes} min</span>
                    <span className="flex items-center gap-1 font-bold text-accent">{currentTest.totalPoints} bodů</span>
                  </div>
                </div>
                <button 
                  onClick={submitTest}
                  className="btn-primary"
                >
                  Odevzdat test
                </button>
              </div>

              <div className="space-y-8 pb-20">
                {currentTest.questions.map((q, idx) => (
                  <div key={q.id} className="glass-card">
                    <div className="flex items-start justify-between mb-4">
                      <span className="bg-card-border px-3 py-1 rounded-full text-xs font-bold">Úloha {idx + 1}</span>
                      <span className="text-xs text-text-secondary">{q.points} bodů</span>
                    </div>
                    <p className="text-lg mb-6 leading-relaxed">{q.text}</p>
                    
                    {q.type === 'single-choice' && q.options && (
                      <div className="grid gap-3">
                        {q.options.map((opt) => (
                          <label 
                            key={opt}
                            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                              testAnswers[q.id] === opt 
                              ? 'bg-accent/10 border-accent text-accent' 
                              : 'bg-bg/50 border-card-border hover:border-text-secondary/30'
                            }`}
                          >
                            <input 
                              type="radio" 
                              className="hidden" 
                              name={q.id}
                              value={opt}
                              checked={testAnswers[q.id] === opt}
                              onChange={() => setTestAnswers(prev => ({ ...prev, [q.id]: opt }))}
                            />
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${testAnswers[q.id] === opt ? 'border-accent' : 'border-card-border'}`}>
                              {testAnswers[q.id] === opt && <div className="w-2 h-2 rounded-full bg-accent" />}
                            </div>
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}

                    {q.type === 'open-ended' && (
                      <input 
                        type="text"
                        className="w-full bg-bg border border-card-border rounded-xl p-4 focus:outline-none focus:border-accent transition-colors"
                        placeholder="Napiš svou odpověď..."
                        value={testAnswers[q.id] || ''}
                        onChange={(e) => setTestAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Header */}
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold">Ahoj, {profile?.displayName?.split(' ')[0]}!</h1>
                  <p className="text-text-secondary">Tvůj dnešní plán je splněn z 15%. Skvělá práce.</p>
                </div>
                <div className="flex items-center gap-3 glass-card py-2 px-4 rounded-full">
                  <span className="font-semibold text-sm">{profile?.displayName}</span>
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                    <UserIcon size={16} className="text-white" />
                  </div>
                </div>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                  value={profile?.stats.testsTaken || 0} 
                  label="Dokončené testy" 
                />
                <StatCard 
                  value={`${profile?.stats.averageScore || 0}%`} 
                  label="Průměrná úspěšnost" 
                />
                <StatCard 
                  value="12 dní" 
                  label="Aktuální série" 
                />
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Results */}
                <div className="lg:col-span-2 glass-card">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <History size={20} className="text-accent" />
                      Poslední výsledky
                    </h3>
                    <button 
                      onClick={() => startTest(MOCK_TESTS[0])}
                      className="btn-primary text-sm"
                    >
                      Nový test
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-bottom border-card-border">
                          <th className="pb-4 text-xs font-bold text-text-secondary uppercase">Název Testu</th>
                          <th className="pb-4 text-xs font-bold text-text-secondary uppercase">Předmět</th>
                          <th className="pb-4 text-xs font-bold text-text-secondary uppercase">Datum</th>
                          <th className="pb-4 text-xs font-bold text-text-secondary uppercase">Skóre</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-card-border">
                        {testResults.length > 0 ? (
                          testResults.map((result) => (
                            <tr key={result.id} className="group hover:bg-white/5 transition-colors">
                              <td className="py-4 font-medium">{availableTests.find(t => t.id === result.testId)?.title || 'Test'}</td>
                              <td className="py-4">
                                <span className={`px-2 py-1 rounded text-[10px] font-black ${
                                  availableTests.find(t => t.id === result.testId)?.subject === 'MAT' 
                                  ? 'bg-blue-500/10 text-blue-500' 
                                  : 'bg-emerald-500/10 text-emerald-500'
                                }`}>
                                  {availableTests.find(t => t.id === result.testId)?.subject}
                                </span>
                              </td>
                              <td className="py-4 text-sm text-text-secondary">
                                {new Date(result.completedAt).toLocaleDateString('cs-CZ')}
                              </td>
                              <td className="py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                  (result.score / result.maxScore) > 0.8 
                                  ? 'bg-success/10 text-success' 
                                  : 'bg-amber-500/10 text-amber-500'
                                }`}>
                                  {result.score}/{result.maxScore}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-12 text-center text-text-secondary italic">
                              Zatím jsi neudělal žádné testy.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Panel: Goals & Recommendations */}
                <div className="space-y-8">
                  <div className="glass-card">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                       <Trophy size={20} className="text-accent" />
                       Týdenní cíl
                    </h3>
                    <div className="relative flex items-center justify-center py-4">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="58"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          className="text-card-border"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="58"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 58}
                          strokeDashoffset={2 * Math.PI * 58 * (1 - 0.68)}
                          strokeLinecap="round"
                          className="text-accent"
                        />
                      </svg>
                      <span className="absolute text-2xl font-black">68%</span>
                    </div>
                    <div className="text-center mt-4">
                      <p className="font-bold">Skvělá práce!</p>
                      <p className="text-xs text-text-secondary mt-1">Zbývá ti už jen 160 bodů do splnění limitu.</p>
                    </div>
                  </div>

                  <div className="glass-card">
                    <h3 className="text-sm font-bold mb-4">Doporučené k procvičení</h3>
                    <div className="space-y-2">
                      <TopicItem title="Lomené výrazy" color="bg-blue-500" />
                      <TopicItem title="Vedlejší věty podmětné" color="bg-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`nav-item ${active ? 'nav-item-active' : ''}`}
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </div>
  );
}

function StatCard({ value, label }: { value: string | number, label: string }) {
  return (
    <div className="glass-card flex flex-col items-center text-center group cursor-default">
      <div className="stat-value group-hover:scale-110 transition-transform">{value}</div>
      <div className="stat-label mt-2">{label}</div>
    </div>
  );
}

function TopicItem({ title, color }: { title: string, color: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-bg/50 border border-card-border rounded-lg hover:border-accent/30 transition-all cursor-pointer group">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs font-medium group-hover:text-text-primary transition-colors">{title}</span>
      <ChevronRight size={14} className="ml-auto text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
