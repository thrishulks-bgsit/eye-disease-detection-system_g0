import { useState, useEffect } from 'react';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Calendar, ChevronRight, Eye, Search, Filter, Clock, TrendingUp, ArrowLeftRight, List, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProgressionChart from './ProgressionChart';
import CompareScans from './CompareScans';

interface HistoryProps {
  onSelectScan: (scan: any) => void;
}

type ViewMode = 'list' | 'progression' | 'compare';

export default function HistoryList({ onSelectScan }: HistoryProps) {
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minConfidence, setMinConfidence] = useState(0);
  const [selectedDisease, setSelectedDisease] = useState('All');

  const diseases = ['All', 'Normal', 'Cataract', 'Conjunctivitis', 'Glaucoma', 'Corneal Ulcer', 'Pterygium', 'Blindness/Severe Impairment', 'Myopia', 'Hyperopia', 'Astigmatism', 'Presbyopia'];

  useEffect(() => {
    if (!auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}/scans`;
    const q = query(
      collection(db, path),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scanData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setScans(scanData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, []);

  const filteredScans = scans.filter(scan => {
    const matchesSearch = scan.prediction.toLowerCase().includes(searchTerm.toLowerCase());
    const scanDate = new Date(scan.timestamp);
    const matchesStartDate = !startDate || scanDate >= new Date(startDate);
    const matchesEndDate = !endDate || scanDate <= new Date(endDate + 'T23:59:59');
    const matchesConfidence = (scan.confidence * 100) >= minConfidence;
    const matchesDisease = selectedDisease === 'All' || scan.prediction === selectedDisease;

    return matchesSearch && matchesStartDate && matchesEndDate && matchesConfidence && matchesDisease;
  });

  const toggleCompare = (id: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const compareA = scans.find(s => s.id === selectedForCompare[0]);
  const compareB = scans.find(s => s.id === selectedForCompare[1]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Clock className="w-12 h-12 text-slate-200 animate-pulse" />
        <p className="text-slate-400 font-medium">Loading your scan history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & View Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Health Timeline</h3>
          <p className="text-slate-500 text-sm">Track progression and compare scan results</p>
        </div>
        
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
          <button 
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <List className="w-4 h-4" />
            List
          </button>
          <button 
            onClick={() => setViewMode('progression')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              viewMode === 'progression' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Progression
          </button>
          <button 
            onClick={() => setViewMode('compare')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              viewMode === 'compare' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Compare
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'list' && (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search diagnosis..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-3 rounded-2xl border transition-all flex items-center gap-2 text-sm font-bold ${
                  showFilters || startDate || endDate || minConfidence > 0 || selectedDisease !== 'All'
                    ? 'bg-blue-50 border-blue-200 text-blue-600' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date From</label>
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date To</label>
                      <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Min Confidence ({minConfidence}%)</label>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={minConfidence}
                        onChange={(e) => setMinConfidence(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disease Indicator</label>
                      <select 
                        value={selectedDisease}
                        onChange={(e) => setSelectedDisease(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {diseases.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="lg:col-span-4 flex justify-end">
                      <button 
                        onClick={() => {
                          setStartDate('');
                          setEndDate('');
                          setMinConfidence(0);
                          setSelectedDisease('All');
                          setSearchTerm('');
                        }}
                        className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {filteredScans.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-300">
                  <Eye className="w-8 h-8" />
                </div>
                <p className="text-slate-500 font-medium">No scans found. Start by creating a new scan!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredScans.map((scan, index) => (
                  <motion.div
                    key={scan.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-6 hover:border-blue-300 hover:shadow-md transition-all relative"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                      <img src={scan.imageUrl} alt="Scan" className="w-full h-full object-cover" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider truncate max-w-[120px] ${
                          scan.prediction === 'Normal' ? 'bg-green-100 text-green-700' : 
                          scan.prediction === 'Blindness/Severe Impairment' ? 'bg-slate-900 text-white' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {scan.prediction}
                        </span>
                        <span className="text-slate-400 text-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(scan.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 truncate">
                        Confidence: {(scan.confidence * 100).toFixed(1)}%
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectScan({
                          classification: { prediction: scan.prediction, confidence: scan.confidence, allScores: scan.allScores },
                          xai: { explanation: scan.explanation, heatmap: scan.imageUrl, hotspots: scan.hotspots || [] },
                          detection: { croppedImage: scan.imageUrl },
                          segmentation: { maskOverlay: scan.imageUrl, regions: { iris: 0.8, pupil: 0.2, sclera: 0.6, eyelids: 0.4 } },
                          validation: { isConsistent: scan.metadata?.isConsistent ?? true, warning: scan.metadata?.warning },
                          patientInfo: scan.patientInfo
                        })}
                        className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {viewMode === 'progression' && (
          <motion.div
            key="progression"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ProgressionChart scans={scans} />
          </motion.div>
        )}

        {viewMode === 'compare' && (
          <motion.div
            key="compare"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl">
              <h4 className="font-bold text-blue-900 mb-2">Select Two Scans to Compare</h4>
              <p className="text-sm text-blue-700">Choose any two scans from your history to see side-by-side analysis and progression insights.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
                {scans.map(scan => (
                  <button
                    key={scan.id}
                    onClick={() => toggleCompare(scan.id)}
                    className={`relative aspect-square rounded-2xl overflow-hidden border-4 transition-all ${
                      selectedForCompare.includes(scan.id) ? 'border-blue-500 scale-95' : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <img src={scan.imageUrl} alt="Scan" className="w-full h-full object-cover" />
                    {selectedForCompare.includes(scan.id) && (
                      <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-white drop-shadow-md" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[8px] text-white font-bold text-center">
                      {new Date(scan.timestamp).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedForCompare.length === 2 ? (
              <CompareScans scanA={compareA} scanB={compareB} />
            ) : (
              <div className="py-20 text-center space-y-4">
                <ArrowLeftRight className="w-12 h-12 text-slate-200 mx-auto" />
                <p className="text-slate-400 font-medium">Please select {2 - selectedForCompare.length} more scan{selectedForCompare.length === 0 ? 's' : ''}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

