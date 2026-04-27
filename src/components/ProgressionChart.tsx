import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Activity, AlertCircle } from 'lucide-react';

interface ProgressionChartProps {
  scans: any[];
}

export default function ProgressionChart({ scans }: ProgressionChartProps) {
  // Sort scans by date ascending for the chart
  const sortedScans = [...scans].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Prepare data for the chart
  const data = sortedScans.map(scan => ({
    date: new Date(scan.timestamp).toLocaleDateString(),
    confidence: (scan.confidence * 100).toFixed(1),
    prediction: scan.prediction,
    // We can also track specific disease scores if available
    ...Object.fromEntries(
      Object.entries(scan.allScores || {}).map(([key, val]) => [key, (val as number) * 100])
    )
  }));

  const latestScan = sortedScans[sortedScans.length - 1];
  const firstScan = sortedScans[0];
  const trend = latestScan && firstScan ? latestScan.confidence - firstScan.confidence : 0;

  if (scans.length < 2) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
          <TrendingUp className="w-8 h-8" />
        </div>
        <h4 className="text-xl font-bold text-slate-900">Need More Data</h4>
        <p className="text-slate-500 max-w-sm mx-auto">
          Upload at least two scans to visualize disease progression and health trends over time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <Activity className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-500">Current Status</p>
          </div>
          <h4 className="text-2xl font-black text-slate-900">{latestScan.prediction}</h4>
          <p className="text-xs text-slate-500 mt-1">Latest scan: {new Date(latestScan.timestamp).toLocaleDateString()}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-500">Confidence Trend</p>
          </div>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-black text-slate-900">{(latestScan.confidence * 100).toFixed(1)}%</h4>
            <span className={`text-xs font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Change since first scan</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-500">Risk Assessment</p>
          </div>
          <h4 className="text-2xl font-black text-slate-900">
            {latestScan.prediction === 'Normal' ? 'Low Risk' : 'Monitoring Required'}
          </h4>
          <p className="text-xs text-slate-500 mt-1">Based on longitudinal data</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div className="mb-8">
          <h4 className="text-lg font-bold text-slate-900">Health Progression Timeline</h4>
          <p className="text-sm text-slate-500">Tracking confidence scores and disease indicators</p>
        </div>
        
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  borderRadius: '16px', 
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Line 
                type="monotone" 
                dataKey="confidence" 
                name="Primary Confidence"
                stroke="#3b82f6" 
                strokeWidth={4}
                dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 8, strokeWidth: 0 }}
              />
              {/* Optional: Add lines for other diseases if they have significant scores */}
              {Object.keys(latestScan.allScores || {}).map((disease, idx) => (
                <Line 
                  key={disease}
                  type="monotone" 
                  dataKey={disease} 
                  stroke={['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][idx % 5]} 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  opacity={0.3}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
