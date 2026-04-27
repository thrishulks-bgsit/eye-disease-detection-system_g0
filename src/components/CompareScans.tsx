import { motion } from 'motion/react';
import { ArrowLeftRight, Calendar, Target, ShieldCheck, AlertTriangle } from 'lucide-react';

interface CompareScansProps {
  scanA: any;
  scanB: any;
}

export default function CompareScans({ scanA, scanB }: CompareScansProps) {
  if (!scanA || !scanB) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-4 py-4">
        <div className="h-px bg-slate-200 flex-1" />
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full text-slate-600 text-sm font-bold">
          <ArrowLeftRight className="w-4 h-4" />
          Side-by-Side Comparison
        </div>
        <div className="h-px bg-slate-200 flex-1" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {[scanA, scanB].map((scan, idx) => (
          <motion.div 
            key={scan.id}
            initial={{ opacity: 0, x: idx === 0 ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-600">
                  {new Date(scan.timestamp).toLocaleDateString()}
                </span>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                scan.prediction === 'Normal' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {scan.prediction}
              </span>
            </div>

            <div className="aspect-video bg-slate-100 relative group">
              <img src={scan.imageUrl} alt="Scan" className="w-full h-full object-cover" />
              
              <div className="absolute top-4 left-4 z-20">
                <div className="bg-black/40 backdrop-blur-sm text-[8px] text-white px-2 py-1 rounded-full font-bold uppercase tracking-widest border border-white/20">
                  Visual Heatmap Active
                </div>
              </div>
              
              {/* Heatmap Overlay */}
              <svg className="absolute inset-0 w-full h-full mix-blend-color-dodge opacity-80 pointer-events-none">
                <defs>
                  {scan.hotspots?.map((_: any, i: number) => (
                    <radialGradient key={`grad-${scan.id}-${i}`} id={`heat-grad-${scan.id}-${i}`}>
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                      <stop offset="30%" stopColor="#f59e0b" stopOpacity="0.6" />
                      <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                    </radialGradient>
                  ))}
                </defs>
                {scan.hotspots?.map((spot: any, i: number) => (
                  <g key={i}>
                    <motion.circle
                      initial={{ r: 0, opacity: 0 }}
                      animate={{ 
                        r: (spot.radius || 0.2) * 200, 
                        opacity: spot.intensity || 0.8 
                      }}
                      transition={{ duration: 1, delay: 0.5 + i * 0.2 }}
                      cx={`${spot.x * 100}%`}
                      cy={`${spot.y * 100}%`}
                      fill={`url(#heat-grad-${scan.id}-${i})`}
                    />
                  </g>
                ))}
              </svg>

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-white">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Primary Diagnosis</p>
                  <p className="text-xl font-black">{scan.prediction}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Confidence</p>
                  <p className="text-xl font-black">{(scan.confidence * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Target className="w-4 h-4 text-blue-600" />
                  AI Reasoning
                </div>
                <p className="text-sm text-slate-600 leading-relaxed italic">
                  "{scan.explanation}"
                </p>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  Validation Layer
                </div>
                <div className={`p-4 rounded-2xl border ${
                  scan.metadata?.isConsistent ? 'bg-green-50 border-green-100 text-green-800' : 'bg-amber-50 border-amber-100 text-amber-800'
                } text-xs leading-relaxed`}>
                  {scan.metadata?.isConsistent 
                    ? "Model consistency verified for this scan." 
                    : `Warning: ${scan.metadata?.warning || "Inconsistent data detected."}`}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Comparison Summary */}
      <div className="bg-blue-900 rounded-3xl p-8 text-white">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-6 h-6 text-blue-400" />
          <h4 className="text-xl font-bold">Progression Insight</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <p className="text-sm text-blue-200">Diagnosis Shift</p>
            <p className="text-lg font-bold">
              {scanA.prediction === scanB.prediction 
                ? `Diagnosis remains stable as "${scanA.prediction}"`
                : `Diagnosis shifted from "${scanA.prediction}" to "${scanB.prediction}"`}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-blue-200">Confidence Delta</p>
            <p className="text-lg font-bold">
              {Math.abs((scanB.confidence - scanA.confidence) * 100).toFixed(1)}% {scanB.confidence > scanA.confidence ? 'Increase' : 'Decrease'} in AI confidence
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
