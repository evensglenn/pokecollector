import { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, doc, setDoc, deleteDoc, query, orderBy, serverTimestamp, increment, getDocFromServer } from 'firebase/firestore';
import { auth, db, login, logout } from './lib/firebase';
import { identifyCard, IdentifiedCard } from './lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Search, 
  Plus, 
  Camera, 
  LogOut, 
  Trash2, 
  ChevronRight, 
  Loader2, 
  X, 
  Minus, 
  Zap,
  Filter,
  ArrowUpDown,
  Info,
  TrendingUp,
  Layers
} from 'lucide-react';
import { cn } from './lib/utils';

// --- Types ---
interface PokemonCard extends IdentifiedCard {
  id: string;
  quantity: number;
  updatedAt: any;
  imageUrl?: string;
}

// --- Components ---

const Logo = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-2 font-bold text-yellow-500", className)}>
    <div className="bg-yellow-500 p-1.5 rounded-lg text-white shadow-lg shadow-yellow-500/20">
      <Zap size={24} fill="currentColor" />
    </div>
    <span className="text-2xl tracking-tight text-slate-900 dark:text-slate-100">Poké<span className="text-yellow-500">Collector</span></span>
  </div>
);

const CardScanner = ({ onScan, onClose }: { onScan: (card: IdentifiedCard, image: string) => void, onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError("Geen toegang tot camera. Controleer de machtigingen.");
      }
    }
    startCamera();
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsScanning(true);
    setError(null);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);
    
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    
    try {
      const card = await identifyCard(base64);
      onScan(card, canvas.toDataURL('image/jpeg'));
    } catch (err) {
      setError("Identificatie mislukt. Probeer het opnieuw met betere verlichting.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4"
    >
      <button onClick={onClose} className="absolute top-6 right-6 text-white p-2 hover:bg-white/10 rounded-full transition-colors">
        <X size={32} />
      </button>

      <div className="relative w-full max-w-md aspect-[3/4] rounded-3xl overflow-hidden border-2 border-yellow-500/50 shadow-2xl shadow-yellow-500/20">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Scanning Overlay */}
        <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
          <div className="w-full h-full border-2 border-yellow-500/50 rounded-xl relative">
             <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-yellow-500 -mt-1 -ml-1 rounded-tl-lg" />
             <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-yellow-500 -mt-1 -mr-1 rounded-tr-lg" />
             <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-yellow-500 -mb-1 -ml-1 rounded-bl-lg" />
             <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-yellow-500 -mb-1 -mr-1 rounded-br-lg" />
          </div>
        </div>

        {isScanning && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white gap-4">
            <Loader2 className="animate-spin text-yellow-500" size={48} />
            <p className="font-medium animate-pulse">Kaart Analyseren...</p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-6 text-red-400 text-center bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20">{error}</p>
      )}

      <button 
        onClick={capture}
        disabled={isScanning}
        className="mt-12 w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center shadow-xl shadow-yellow-500/40 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
      >
        <Camera size={36} className="text-white" />
      </button>
      
      <p className="mt-4 text-white/60 text-sm font-medium">Plaats de kaart binnen het kader</p>
    </motion.div>
  );
};

const CardDetail = ({ card, onUpdate, onDelete, onClose }: { card: PokemonCard, onUpdate: (id: string, qty: number) => void, onDelete: (id: string) => void, onClose: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative h-56 bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center overflow-hidden">
          {card.imageUrl ? (
            <img src={card.imageUrl} className="w-full h-full object-cover opacity-40 blur-sm" referrerPolicy="no-referrer" />
          ) : (
             <Zap size={120} className="text-white/20 absolute -right-10 -bottom-10 rotate-12" />
          )}
          <div className="absolute inset-0 flex items-center justify-center p-6">
             <div className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-xl rotate-[-2deg]">
                <div className="w-36 aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center overflow-hidden">
                  {card.imageUrl ? (
                    <img src={card.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Zap size={40} className="text-slate-300" />
                  )}
                </div>
             </div>
             <div className="ml-6 text-white">
                <div className="flex items-center gap-2">
                  <h2 className="text-3xl font-bold leading-tight">{card.name}</h2>
                  {card.hp && <span className="text-xl font-black text-white/90">{card.hp} HP</span>}
                </div>
                <p className="text-white/80 font-medium">{card.setName} • {card.cardNumber}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold uppercase tracking-wider">{card.rarity}</span>
                  <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold uppercase tracking-wider">{card.type}</span>
                  {card.stage && <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold uppercase tracking-wider">{card.stage}</span>}
                </div>
             </div>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 p-1.5 rounded-full backdrop-blur-md">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Market Value Section */}
          <section>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp size={14} />
              Marktwaarde & Trend
            </h3>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Geschatte Waarde</div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">€{card.estimatedValue.toFixed(2)}</div>
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase text-right">Laatste 6 maanden</div>
              </div>
              
              <div className="h-40 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={card.priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                    />
                    <YAxis 
                      hide 
                      domain={['auto', 'auto']}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                      formatter={(value: number) => [`€${value.toFixed(2)}`, 'Prijs']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#eab308" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#eab308', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Pokemon Info Section */}
          <section>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
              <Info size={14} />
              Pokémon Details
            </h3>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-sm text-slate-500">Evolutie</span>
                <span className="text-sm font-semibold dark:text-slate-100">{card.evolutionInfo || 'Geen data'}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-1">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Zwakte</div>
                  <div className="text-sm font-bold dark:text-slate-100">{card.weakness || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Weerstand</div>
                  <div className="text-sm font-bold dark:text-slate-100">{card.resistance || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Retreat</div>
                  <div className="text-sm font-bold dark:text-slate-100">{card.retreatCost || '-'}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Inventory Management */}
          <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-500/10 rounded-2xl border border-yellow-100 dark:border-yellow-500/20">
            <div className="font-bold text-slate-900 dark:text-slate-100">Aantal in bezit</div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => onUpdate(card.id, Math.max(0, card.quantity - 1))}
                className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors border border-slate-200 dark:border-slate-700"
              >
                <Minus size={20} />
              </button>
              <span className="text-xl font-bold w-8 text-center dark:text-slate-100">{card.quantity}</span>
              <button 
                onClick={() => onUpdate(card.id, card.quantity + 1)}
                className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors border border-slate-200 dark:border-slate-700"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          <button 
            onClick={() => onDelete(card.id)}
            className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 dark:bg-red-500/10 text-red-600 font-bold rounded-2xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
          >
            <Trash2 size={20} />
            Verwijderen uit verzameling
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const [user, loadingAuth] = useAuthState(auth);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PokemonCard | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'newest'>('newest');
  const [filterType, setFilterType] = useState<string>('Alle');

  const collectionRef = user ? collection(db, 'users', user.uid, 'cards') : null;
  const [collectionSnap, loadingCollection] = useCollection(
    collectionRef ? query(collectionRef, orderBy('updatedAt', 'desc')) : null
  );

  const cards = (collectionSnap?.docs.map(doc => ({ id: doc.id, ...doc.data() } as PokemonCard)) || [])
    .filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.setName.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'Alle' || c.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'value') return b.estimatedValue - a.estimatedValue;
      return 0; // Default is newest from Firestore query
    });

  const types = ['Alle', ...new Set(collectionSnap?.docs.map(doc => doc.data().type).filter(Boolean))];

  const handleScan = async (identified: IdentifiedCard, image: string) => {
    if (!user) return;
    const cardId = `${identified.setName}-${identified.cardNumber}`.replace(/\//g, '-');
    const cardRef = doc(db, 'users', user.uid, 'cards', cardId);
    
    const existing = await getDocFromServer(cardRef);
    if (existing.exists()) {
      await setDoc(cardRef, { 
        quantity: increment(1),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } else {
      await setDoc(cardRef, {
        ...identified,
        id: cardId,
        imageUrl: image,
        quantity: 1,
        updatedAt: serverTimestamp()
      });
    }
    setShowScanner(false);
  };

  const updateQuantity = async (id: string, qty: number) => {
    if (!user) return;
    const cardRef = doc(db, 'users', user.uid, 'cards', id);
    if (qty === 0) {
      if (confirm("Deze kaart uit je verzameling verwijderen?")) {
        await deleteDoc(cardRef);
        setSelectedCard(null);
      }
    } else {
      await setDoc(cardRef, { quantity: qty, updatedAt: serverTimestamp() }, { merge: true });
      if (selectedCard?.id === id) {
        setSelectedCard(prev => prev ? { ...prev, quantity: qty } : null);
      }
    }
  };

  const deleteCard = async (id: string) => {
    if (!user) return;
    if (confirm("Weet je zeker dat je deze kaart wilt verwijderen?")) {
      await deleteDoc(doc(db, 'users', user.uid, 'cards', id));
      setSelectedCard(null);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-yellow-500" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full space-y-8"
        >
          <Logo className="justify-center mb-8" />
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Verzamel ze allemaal!</h1>
            <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium">
              Scan je Pokémon-kaarten, volg hun waarde en bouw je ultieme digitale collectie op.
            </p>
            <button 
              onClick={login}
              className="mt-8 w-full py-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-2xl shadow-lg shadow-yellow-500/30 transition-all flex items-center justify-center gap-3"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5 bg-white rounded-full p-0.5" />
              Inloggen met Google
            </button>
          </div>
          <p className="text-slate-400 text-sm">Veilig opgeslagen in je persoonlijke cloud-collectie.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
              <img src={user.photoURL || ''} className="w-6 h-6 rounded-full" />
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{user.displayName}</span>
            </div>
            <button onClick={logout} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
              <LogOut size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Zoeken op naam of set..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-yellow-500 outline-none transition-all font-medium dark:text-slate-100"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select 
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="pl-10 pr-8 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-yellow-500 outline-none appearance-none font-bold text-sm dark:text-slate-100"
              >
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select 
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="pl-10 pr-8 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-yellow-500 outline-none appearance-none font-bold text-sm dark:text-slate-100"
              >
                <option value="newest">Nieuwste</option>
                <option value="name">Naam</option>
                <option value="value">Waarde</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        {!loadingCollection && cards.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Totaal Kaarten</div>
              <div className="text-2xl font-bold dark:text-slate-100">{cards.reduce((acc, c) => acc + c.quantity, 0)}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Unieke Soorten</div>
              <div className="text-2xl font-bold dark:text-slate-100">{cards.length}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Totale Waarde</div>
              <div className="text-2xl font-bold text-yellow-500">€{cards.reduce((acc, c) => acc + (c.estimatedValue * c.quantity), 0).toFixed(2)}</div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Zeldzaamste</div>
              <div className="text-sm font-bold truncate dark:text-slate-100">{cards.sort((a, b) => b.estimatedValue - a.estimatedValue)[0]?.name || '-'}</div>
            </div>
          </div>
        )}

        {/* Grid */}
        {loadingCollection ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-yellow-500" size={48} />
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Plus className="text-slate-300" size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Je verzameling is leeg</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto">
              Begin met het scannen van je eerste Pokémon-kaart om je digitale bibliotheek op te bouwen.
            </p>
            <button 
              onClick={() => setShowScanner(true)}
              className="mt-8 px-8 py-3.5 bg-yellow-500 text-white font-bold rounded-2xl hover:bg-yellow-600 transition-all shadow-lg shadow-yellow-500/20"
            >
              Scan Eerste Kaart
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            <AnimatePresence mode="popLayout">
              {cards.map((card) => (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setSelectedCard(card)}
                  className="group relative bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer border border-slate-100 dark:border-slate-800"
                >
                  <div className="aspect-[3/4] bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                    {card.imageUrl ? (
                      <img src={card.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Zap className="text-slate-300" size={48} />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-bold shadow-sm">
                      x{card.quantity}
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-10">
                      <div className="text-white text-sm font-bold truncate">{card.name}</div>
                      <div className="text-white/70 text-[10px] font-bold uppercase tracking-wider">{card.setName}</div>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div className="text-yellow-500 font-bold">€{card.estimatedValue.toFixed(2)}</div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-yellow-500 transition-colors" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
        <button 
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-3 px-8 py-4 bg-yellow-500 text-white font-bold rounded-full shadow-2xl shadow-yellow-500/40 hover:scale-105 active:scale-95 transition-all"
        >
          <Camera size={24} />
          Scan Nieuwe Kaart
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showScanner && (
          <CardScanner 
            onScan={handleScan} 
            onClose={() => setShowScanner(false)} 
          />
        )}
        {selectedCard && (
          <CardDetail 
            card={selectedCard} 
            onUpdate={updateQuantity} 
            onDelete={deleteCard}
            onClose={() => setSelectedCard(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
