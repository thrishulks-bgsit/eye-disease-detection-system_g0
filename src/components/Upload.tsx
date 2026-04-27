import { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Camera, Upload as UploadIcon, X, Loader2, ShieldCheck, AlertCircle, Activity, ChevronRight, User, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { runEyePipeline } from '../services/aiService';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { PatientData, INITIAL_PATIENT_DATA } from '../types';

interface UploadProps {
  onResult: (result: any, patientInfo: PatientData) => void;
}

export default function Upload({ onResult }: UploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isEnteringDetails, setIsEnteringDetails] = useState(false);
  const [patientData, setPatientData] = useState<PatientData>(INITIAL_PATIENT_DATA);
  const [scanResult, setScanResult] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const steps = [
    "Detecting eye region...",
    "Segmenting iris and pupil...",
    "Analyzing tissue patterns...",
    "Generating medical explanation...",
    "Validating results..."
  ];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
    multiple: false
  } as any);

  const startCamera = async () => {
    try {
      setIsCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please check permissions.");
      setIsCapturing(false);
    }
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setPreview(dataUrl);
      
      // Stop stream
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      setIsCapturing(false);
    }
  };

  const handleProcess = async () => {
    if (!preview) return;
    setIsEnteringDetails(false);
    setLoading(true);
    setError(null);
    
    // Progress simulation for better UX
    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setLoadingStep(steps[stepIdx]);
        stepIdx++;
      }
    }, 400);

    try {
      const result = await runEyePipeline(preview);
      clearInterval(interval);
      setLoadingStep("Finalizing report...");
      setScanResult(result);
      
      // Save to Firestore
      if (auth.currentUser) {
        const scanData = {
          userId: auth.currentUser.uid,
          imageUrl: preview,
          prediction: result.classification.prediction,
          confidence: result.classification.confidence,
          allScores: result.classification.allScores,
          explanation: result.xai.explanation,
          hotspots: result.xai.hotspots || [],
          timestamp: new Date().toISOString(),
          patientInfo: patientData,
          metadata: {
            isConsistent: result.validation.isConsistent,
            warning: result.validation.warning || null
          }
        };
        
        const path = `users/${auth.currentUser.uid}/scans`;
        try {
          await addDoc(collection(db, path), scanData);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
      
      onResult(result, patientData);
    } catch (err) {
      clearInterval(interval);
      console.error("Pipeline error:", err);
      const errorMessage = err instanceof Error ? err.message : "AI processing failed. Please try a clearer image.";
      setError(errorMessage);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const resetUpload = () => {
    setPreview(null);
    setFile(null);
    setScanResult(null);
    setError(null);
    setIsEnteringDetails(false);
  };

  if (isEnteringDetails) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-8"
      >
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setIsEnteringDetails(false)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-semibold"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Image
          </button>
          <div className="text-right">
            <h3 className="text-2xl font-bold text-slate-900">Patient Intake</h3>
            <p className="text-slate-500 text-sm">Required for official medical report</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
              <input value={patientData.fullName} onChange={e => setPatientData({...patientData, fullName: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="John Doe" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Patient ID</label>
              <input value={patientData.patientId} onChange={e => setPatientData({...patientData, patientId: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="P-123456" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date of Birth</label>
              <input type="date" value={patientData.dob} onChange={e => setPatientData({...patientData, dob: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Age</label>
              <input type="number" value={patientData.age} onChange={e => setPatientData({...patientData, age: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="45" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gender</label>
              <select value={patientData.gender} onChange={e => setPatientData({...patientData, gender: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Blood Group</label>
              <input value={patientData.bloodGroup} onChange={e => setPatientData({...patientData, bloodGroup: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="O+" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Phone</label>
              <input value={patientData.phone} onChange={e => setPatientData({...patientData, phone: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="+1 (555) 000-0000" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</label>
              <input value={patientData.email} onChange={e => setPatientData({...patientData, email: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="john@example.com" />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Residential Address</label>
              <input value={patientData.address} onChange={e => setPatientData({...patientData, address: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="123 Medical Way, Health City" />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medical History</label>
              <input value={patientData.medicalConditions} onChange={e => setPatientData({...patientData, medicalConditions: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="Diabetes Type 2, Hypertension" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Allergies</label>
              <input value={patientData.allergies} onChange={e => setPatientData({...patientData, allergies: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="Penicillin, None" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Medications</label>
              <input value={patientData.medications} onChange={e => setPatientData({...patientData, medications: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="Metformin 500mg" />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleProcess}
              disabled={loading || !patientData.fullName}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-4 px-12 rounded-2xl transition-all shadow-lg shadow-blue-100 flex items-center gap-3"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{loadingStep || "Analyzing..."}</span>
                </div>
              ) : (
                <>
                  Confirm Details & Start Scan
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100 mb-4">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          )}
          {!patientData.fullName && <p className="text-right text-xs text-slate-400 font-bold">Please enter at least the Patient Full Name to proceed.</p>}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-slate-900">Upload Eye Image</h3>
        <p className="text-slate-500">Capture or upload a high-quality close-up image of the eye for analysis.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div 
          {...getRootProps()} 
          className={`relative aspect-square rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-8 cursor-pointer ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
            <UploadIcon className="w-8 h-8" />
          </div>
          <p className="text-slate-900 font-semibold">Drag & drop image</p>
          <p className="text-slate-500 text-sm mt-1">or click to browse files</p>
          <p className="text-xs text-slate-400 mt-4">JPG, PNG up to 10MB</p>
        </div>

        {/* Camera Section */}
        <div className="relative aspect-square rounded-3xl bg-slate-900 overflow-hidden flex flex-col items-center justify-center group">
          {isCapturing ? (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="absolute inset-0 w-full h-full object-cover"
              />
              <button 
                onClick={captureImage}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-slate-300 flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
              >
                <div className="w-12 h-12 bg-red-500 rounded-full" />
              </button>
            </>
          ) : (
            <div className="text-center p-8">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-slate-400 mx-auto">
                <Camera className="w-8 h-8" />
              </div>
              <p className="text-white font-semibold">Live Capture</p>
              <p className="text-slate-400 text-sm mt-1 mb-6">Use your webcam for a quick scan</p>
              <button 
                onClick={startCamera}
                className="bg-white text-slate-900 px-6 py-2 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
              >
                Start Camera
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Preview & Process */}
      <AnimatePresence>
        {preview && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Image Preview</h4>
                  <p className="text-xs text-slate-500">Ready for AI analysis</p>
                </div>
              </div>
              <button 
                onClick={resetUpload}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="w-full md:w-1/2 aspect-video rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 relative">
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
              </div>
              
              <div className="w-full md:w-1/2 space-y-6">
                <div className="space-y-4">
                  {!scanResult && (
                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <Loader2 className={`w-5 h-5 text-blue-600 mt-0.5 ${loading ? 'animate-spin' : ''}`} />
                      <div>
                        <p className="text-sm font-semibold text-blue-900">AI Pipeline Analysis</p>
                        <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                          Our multi-stage system will perform detection, segmentation, and classification in under 2 seconds.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {scanResult && (
                    <div className="space-y-4">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-6 bg-green-50 border border-green-100 rounded-2xl text-center space-y-3"
                      >
                        <div className="flex items-center justify-center gap-2 text-green-600 mb-1">
                          <ShieldCheck className="w-5 h-5" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Analysis Complete</span>
                        </div>
                        <h4 className="text-2xl font-black text-slate-900">{scanResult.classification.prediction}</h4>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-lg shadow-blue-100">
                          {(scanResult.classification.confidence * 100).toFixed(1)}% Confidence
                        </div>
                      </motion.div>

                      {scanResult.classification.confidence < 0.7 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3"
                        >
                          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-amber-900">Low Confidence Warning</p>
                            <p className="text-xs text-amber-800 leading-relaxed">
                              The AI is less certain about this result. For better accuracy, please try re-scanning with a clearer, well-lit image of the eye.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                  
                  {error && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <p className="text-sm text-red-800 font-medium">{error}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {!scanResult ? (
                    <button
                      onClick={() => setIsEnteringDetails(true)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-3"
                    >
                      Process Scan
                      <Activity className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onResult(scanResult, patientData)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-3"
                    >
                      View Full Medical Report
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                  
                  {scanResult && (
                    <button
                      onClick={() => setScanResult(null)}
                      className="w-full text-slate-500 text-xs font-bold hover:text-slate-700 transition-colors"
                    >
                      Re-run Analysis
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
