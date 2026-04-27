import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Eye, LogIn, LogOut, History, Upload as UploadIcon, MessageSquare, Activity, ShieldAlert, FileText, ChevronRight, User as UserIcon, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Upload from './components/Upload';
import Results from './components/Results';
import HistoryList from './components/History';
import Chat from './components/Chat';
import Login from './components/Login';
import { PatientData } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'chat'>('upload');
  const [currentScan, setCurrentScan] = useState<{ result: any, patientInfo: PatientData } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure user document exists
        const userRef = doc(db, 'users', user.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || user.email?.split('@')[0] || 'User',
              photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`,
              role: 'patient',
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error("Error checking user doc:", error);
        }
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentScan(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Eye className="w-12 h-12 text-blue-600" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-white border-b md:border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Eye className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-900">Eye Disease Detector</span>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-2">
          <NavItem 
            icon={<UploadIcon />} 
            label="New Scan" 
            active={activeTab === 'upload'} 
            onClick={() => { setActiveTab('upload'); setCurrentScan(null); }} 
          />
          <NavItem 
            icon={<History />} 
            label="Scan History" 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')} 
          />
          <NavItem 
            icon={<MessageSquare />} 
            label="Health Assistant" 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')} 
          />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl mb-4">
            <img 
              src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
              alt="Profile" 
              className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-red-600 hover:bg-red-50 py-2 px-4 rounded-xl transition-all text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800 capitalize">
            {activeTab === 'upload' ? (currentScan ? 'Scan Results' : 'New Eye Scan') : activeTab.replace('-', ' ')}
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
              <Activity className="w-3 h-3" />
              System Online
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto"
              >
                {!currentScan ? (
                  <Upload onResult={(result, patientInfo) => setCurrentScan({ result, patientInfo })} />
                ) : (
                  <Results 
                    result={currentScan.result} 
                    patientInfo={currentScan.patientInfo} 
                    onReset={() => setCurrentScan(null)} 
                  />
                )}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-5xl mx-auto"
              >
                <HistoryList onSelectScan={(scan) => { 
                  setCurrentScan({ 
                    result: scan, 
                    patientInfo: scan.patientInfo || {} as PatientData 
                  }); 
                  setActiveTab('upload'); 
                }} />
              </motion.div>
            )}

            {activeTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-3xl mx-auto h-full"
              >
                <Chat />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-medium text-sm ${
        active 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <span className={active ? 'text-white' : 'text-slate-400'}>{icon}</span>
      {label}
    </button>
  );
}
