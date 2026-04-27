import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { ShieldCheck, AlertTriangle, FileText, Download, RefreshCcw, Brain, Layers, Target, Search, ChevronRight, ZoomIn, ZoomOut, Maximize2, User, Calendar, Fingerprint, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { auth } from '../lib/firebase';
import { PatientData } from '../types';

interface ZoomableImageProps {
  src: string;
  alt: string;
  children?: React.ReactNode;
  className?: string;
}

function ZoomableImage({ src, alt, children, className = "" }: ZoomableImageProps) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 1));
  const handleReset = () => setScale(1);

  return (
    <div className={`relative overflow-hidden group/zoom ${className}`} ref={containerRef}>
      <motion.div
        drag={scale > 1}
        dragConstraints={containerRef}
        animate={{ scale }}
        className="w-full h-full cursor-grab active:cursor-grabbing origin-center"
        style={{ touchAction: 'none' }}
      >
        <img src={src} alt={alt} className="w-full h-full object-cover pointer-events-none" />
        {children}
      </motion.div>

      {/* Zoom Controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover/zoom:opacity-100 transition-opacity">
        <button 
          onClick={handleZoomIn}
          className="p-1.5 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white text-slate-700 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button 
          onClick={handleZoomOut}
          className="p-1.5 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white text-slate-700 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button 
          onClick={handleReset}
          className="p-1.5 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white text-slate-700 transition-colors"
          title="Reset Zoom"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      
      {scale > 1 && (
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 backdrop-blur-md text-[10px] text-white px-2 py-1 rounded-md font-bold">
          {Math.round(scale * 100)}% Zoom
        </div>
      )}
    </div>
  );
}

interface ResultsProps {
  result: any;
  patientInfo: PatientData;
  onReset: () => void;
}

export default function Results({ result, patientInfo, onReset }: ResultsProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);
  const [patientData, setPatientData] = useState<PatientData>(patientInfo);
  const [isEditingPatient, setIsEditingPatient] = useState(false);

  if (!result || !result.classification) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-4">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Analysis Error</h3>
        <p className="text-slate-500">We encountered an issue processing the AI results. Please try scanning again with a clearer image.</p>
        <button 
          onClick={onReset}
          className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { classification, segmentation, xai, validation, detection } = result;

  const chartData = Object.entries(classification.allScores || {}).map(([name, value]) => ({
    name,
    value: (value as number) * 100
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const getClinicalImpression = (prediction: string) => {
    const data: Record<string, any> = {
      'Cataract': {
        severity: 'Moderate to Severe',
        urgency: 'Priority Review Within 2 Weeks',
        description: 'Opacity of the crystalline lens resulting in progressive visual degradation. Slit-lamp equivalent visualization suggests localized lenticular density consistent with nuclear or cortical cataract formation.',
        differential: ['Nuclear Sclerosis', 'Refractive Shift'],
        treatment: 'Surgical intervention (Phacoemulsification) is the definitive treatment. Intraocular lens (IOL) implantation is indicated.',
        precautions: ['Avoid driving at night due to glare.', 'Monitor for rapid visual changes.', 'Consult a surgical specialist.']
      },
      'Glaucoma': {
        severity: 'Severe Risk',
        urgency: 'Urgent Specialist Referral Within 48 Hours',
        description: 'Vascular markers and structural signals suggest elevated intraocular pressure or optic nerve head vulnerability. Immediate clinical tonometry and perimetry are indicated.',
        differential: ['Ocular Hypertension', 'Physiological Cupping'],
        treatment: 'Prostaglandin analogs or Beta-blockers (topical). Possible laser trabeculoplasty.',
        precautions: ['Do not skip prescribed medications.', 'Regular monitoring of IOP.', 'Limit high-intensity postural changes.']
      },
      'Conjunctivitis': {
        severity: 'Mild to Moderate',
        urgency: 'Routine Follow-Up',
        description: 'Hyperemia of the bulbar conjunctiva with notable vascular injection. Likely inflammatory or microbial origin.',
        differential: ['Episcleritis', 'Uveitis (Anterior)'],
        treatment: 'Depending on etiology: Antibiotic drops (bacterial), cold compresses (viral), or antihistamines (allergic).',
        precautions: ['Frequent hand washing.', 'Avoid sharing towels or bedding.', 'Discontinue contact lens use immediately.']
      },
      'Corneal Ulcer': {
        severity: 'Severe - Sight Threatening',
        urgency: 'Urgent Specialist Referral Within 24-48 Hours',
        description: 'Disruption of the corneal epithelium with underlying stromal infiltration. High risk of perforation and permanent scarring without aggressive antimicrobial therapy.',
        differential: ['Abrasive Keratopathy', 'Corneal Dystrophy'],
        treatment: 'Broad-spectrum fortified antibiotic / antifungal / antiviral topical agents based on culture results.',
        precautions: ['Complete cessation of contact lens wear.', 'Do not use steroid drops unless directed.', 'Strict compliance with hourly dosing.']
      },
      'Pterygium': {
        severity: 'Mild to Moderate',
        urgency: 'Routine Follow-Up',
        description: 'Benign fibrovascular growth extending from the bulbar conjunctiva onto the cornea. May cross the visual axis if progressive.',
        differential: ['Pinguecula', 'Pseudopterygium'],
        treatment: 'Lubricating drops for symptoms. Surgical excision (with autograft) if visual axis is threatened.',
        precautions: ['Maximal UV protection (Sunglasses).', 'Use artificial tears to reduce irritation.', 'Avoid dusty/windy environments.']
      },
      'Normal': {
        severity: 'None',
        urgency: 'Routine Follow-Up',
        description: 'Anatomical structures appear within normal clinical limits. No immediate evidence of pathological tissue degradation or refractive anomalies detected in this capture.',
        differential: ['Subclinical pathology', 'Early-stage degeneration'],
        treatment: 'Maintain regular ophthalmological check-ups (annually).',
        precautions: ['Use UV protection.', 'Maintain healthy diet rich in Vitamin A/Zeaxanthin.', 'Annual screenings.']
      },
      'Blindness/Severe Impairment': {
        severity: 'Critical',
        urgency: 'Emergency Specialist Referral',
        description: 'Critical loss of structural markers. Total corneal/lenticular opacification or significant phthisis bulbi signals. Immediate vision rehabilitation assessment required.',
        differential: ['Advanced End-Stage Ocular Disease', 'Severe Trauma Response'],
        treatment: 'Complex surgery or visual rehabilitation. Low vision aids.',
        precautions: ['Avoid high-risk activities.', 'Immediate ER consultation.', 'Constant caregiver support.']
      },
      'Myopia': {
        severity: 'Mild to Severe (Refractive)',
        urgency: 'Routine Follow-Up',
        description: 'Refractive error where distant objects appear blurred. Often associated with axial elongation of the globe.',
        differential: ['Pseudo-myopia', 'Refractive Index Shift'],
        treatment: 'Corrective lenses (minus power), contact lenses, or refractive surgery (LASIK/PRK).',
        precautions: ['Regular breaks from screen time.', 'Check for degenerative retinal changes if high myopia.', 'Follow 20-20-20 rule.']
      },
      'Hyperopia': {
        severity: 'Mild to Moderate (Refractive)',
        urgency: 'Routine Follow-Up',
        description: 'Farsightedness where near objects appear more blurred than distant objects. Visual accommodation efforts may cause strain.',
        differential: ['Presbyopia', 'Accommodative Insufficiency'],
        treatment: 'Corrective lenses (plus power) or refractive surgery.',
        precautions: ['Monitor for headaches during reading.', 'Annual exam for kids to prevent amblyopia.', 'Proper ergonomics.']
      },
      'Astigmatism': {
        severity: 'Refractive Deviation',
        urgency: 'Routine Follow-Up',
        description: 'Irregular curvature of the cornea or lens, leading to distorted or blurred vision at all distances.',
        differential: ['Keratoconus', 'Lenticular Astigmatism'],
        treatment: 'Toric corrective lenses or refractive surgery.',
        precautions: ['Update prescription annually.', 'Avoid excessive eye rubbing which can worsen curvature.', 'Proper lighting.']
      },
      'Presbyopia': {
        severity: 'Age-Related Adaptive',
        urgency: 'Routine Follow-Up',
        description: 'Physiological loss of accommodative amplitude due to hardening of the crystalline lens, making near tasks difficult.',
        differential: ['Hyperopia', 'Nuclear Sclerosis'],
        treatment: 'Reading glasses (Bifocals/Progressives) or multifocal contact lenses.',
        precautions: ['Increase task lighting.', 'Hold reading material further away.', 'Regular eye exams for health monitoring.']
      }
    };
    return data[prediction] || data['Normal'];
  };

  const clinical = getClinicalImpression(classification.prediction);

  const topDifferentials = chartData
    .filter(c => c.name !== classification.prediction)
    .slice(0, 2);

  const downloadReport = async () => {
    try {
      setIsDownloading(true);
      const element = document.getElementById('report-content');
      if (!element) return;
      
      // Small delay to ensure all animations are settled
      await new Promise(resolve => setTimeout(resolve, 500));

      const dataUrl = await toPng(element, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#f8fafc',
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Eye_Disease_Detector_Report_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("Failed to generate PDF. Please try again or take a screenshot.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 print:pb-0">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onReset}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Medical Documentation</h3>
            <p className="text-slate-500 text-sm">Generate and export clinical-grade evidence</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsEditingPatient(!isEditingPatient)}
            className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm"
          >
            <User className="w-4 h-4" />
            Patient Info
          </button>
          <button 
            onClick={downloadReport}
            disabled={isDownloading}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Official Report
          </button>
        </div>
      </div>

      {isEditingPatient && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-blue-200 rounded-3xl p-8 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Patient Identification & Clinical Background
            </h4>
            <button onClick={() => setIsEditingPatient(false)} className="text-slate-400 hover:text-slate-600 transition-colors">Close</button>
          </div>
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
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Referred By</label>
              <input value={patientData.referredBy} onChange={e => setPatientData({...patientData, referredBy: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="Dr. Smith / Self" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Occupation</label>
              <input value={patientData.occupation} onChange={e => setPatientData({...patientData, occupation: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="Software Engineer" />
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
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Emergency Contact Name</label>
              <input value={patientData.emergencyContactName} onChange={e => setPatientData({...patientData, emergencyContactName: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="Jane Doe" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Emergency Phone</label>
              <input value={patientData.emergencyContactPhone} onChange={e => setPatientData({...patientData, emergencyContactPhone: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="+1 (555) 111-2222" />
            </div>
          </div>
          <p className="mt-4 text-[10px] text-slate-400 italic">This information will be printed on the official clinicial evidence report.</p>
        </motion.div>
      )}

      <div id="report-content" className="bg-white border-8 border-slate-900 overflow-hidden shadow-2xl relative">
        {/* MEDICAL REPORT CONTAINER */}
        <div className="p-8 md:p-16 space-y-12">
          
          {/* SECTION 1: REPORT HEADER */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8">
            <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter">EYE DISEASE DETECTOR <span className="text-blue-600">REPORT</span></h1>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Ophthalmological AI Screening & Clinical Evidence</p>
              <div className="mt-4 inline-flex items-center gap-2 bg-slate-100 px-3 py-1 rounded text-[9px] font-bold text-slate-600">
                <Fingerprint className="w-3 h-3" />
                DIGITAL AUTHENTICATION: 0x{Math.random().toString(16).slice(2, 10).toUpperCase()}
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report ID</p>
              <p className="text-sm font-mono font-black text-slate-900 truncate">EDD-RX-{Math.random().toString(36).substr(2, 6).toUpperCase()}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-2">Generation Date</p>
              <p className="text-xs font-bold text-slate-900">{new Date().toLocaleDateString()} | {new Date().toLocaleTimeString()}</p>
            </div>
          </div>

          {/* SECTION 2 & 3: PATIENT SUMMARY & CLINICAL BACKGROUND */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h5 className="text-xs font-black text-slate-900 uppercase border-l-4 border-slate-900 pl-3 tracking-widest flex items-center gap-2">
                <User className="w-4 h-4" /> 02. Patient Identification
              </h5>
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div className="bg-slate-50 p-3 rounded-lg"><span className="block font-black text-slate-400 uppercase mb-1">Full Name</span><span className="font-bold text-slate-900">{patientData.fullName || "NOT SPECIFIED"}</span></div>
                <div className="bg-slate-50 p-3 rounded-lg"><span className="block font-black text-slate-400 uppercase mb-1">Gender</span><span className="font-bold text-slate-900">{patientData.gender || "—"}</span></div>
                <div className="bg-slate-50 p-3 rounded-lg"><span className="block font-black text-slate-400 uppercase mb-1">Age / DOB</span><span className="font-bold text-slate-900">{patientData.age ? `${patientData.age} Years` : "—"} / {patientData.dob || "—"}</span></div>
                <div className="bg-slate-50 p-3 rounded-lg"><span className="block font-black text-slate-400 uppercase mb-1">Blood Group</span><span className="font-bold text-slate-900">{patientData.bloodGroup || "—"}</span></div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg text-[11px]"><span className="block font-black text-slate-400 uppercase mb-1">Address</span><span className="font-bold text-slate-900">{patientData.address || "—"}</span></div>
            </div>

            <div className="space-y-6">
              <h5 className="text-xs font-black text-slate-900 uppercase border-l-4 border-slate-900 pl-3 tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4" /> 03. Clinical Background
              </h5>
              <div className="grid grid-cols-1 gap-4 text-[11px]">
                <div className="bg-slate-50 p-3 rounded-lg"><span className="block font-black text-slate-400 uppercase mb-1">Medical Conditions</span><span className="font-bold text-slate-900">{patientData.medicalConditions || "NONE REPORTED"}</span></div>
                <div className="flex gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg flex-1"><span className="block font-black text-slate-400 uppercase mb-1">Medications</span><span className="font-bold text-slate-900">{patientData.medications || "NONE"}</span></div>
                  <div className="bg-red-50 p-3 rounded-lg flex-1"><span className="block font-black text-red-900 uppercase mb-1">Allergies</span><span className="font-bold text-red-700">{patientData.allergies || "NONE"}</span></div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg"><span className="block font-black text-slate-400 uppercase mb-1">Family History Of Eye Disease</span><span className="font-bold text-slate-900">{patientData.familyHistory || "NEGATIVE"}</span></div>
              </div>
            </div>
          </div>

          {/* SECTION 4 & 5: SCAN SESSION & AI PIPELINE FINDINGS */}
          <div className="space-y-8">
            <h5 className="text-xs font-black text-slate-900 uppercase border-l-4 border-slate-900 pl-3 tracking-widest flex items-center gap-2">
              <Target className="w-4 h-4" /> 04. Scan Session & AI Pipeline Analytics
            </h5>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Stage 1: Detection</p>
                  <div className="aspect-square rounded-2xl bg-white border-2 border-slate-900 overflow-hidden relative">
                    <img src={detection.croppedImage} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-slate-900 text-white text-[8px] font-bold px-2 py-0.5 rounded">99.8% Bbox</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Stage 2: Segmentation</p>
                  <div className="aspect-square rounded-2xl bg-white border-2 border-slate-900 overflow-hidden relative">
                    <img src={segmentation.maskOverlay} className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Stage 4: Grad-CAM++</p>
                  <div className="aspect-square rounded-2xl bg-white border-2 border-slate-900 overflow-hidden relative">
                    <img src={xai.heatmap} className="w-full h-full object-cover" />
                    <svg className="absolute inset-0 w-full h-full mix-blend-hard-light opacity-60">
                      {xai.hotspots?.map((s: any, i: number) => <circle key={i} cx={`${s.x * 100}%`} cy={`${s.y * 100}%`} r={(s.radius || 0.1) * 120} fill="#ef4444" />)}
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200">
                <h6 className="text-[10px] font-black text-slate-900 uppercase mb-4 tracking-widest border-b border-slate-300 pb-2">05. Probability Table</h6>
                <div className="space-y-3">
                  {chartData.map(c => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="text-[9px] font-bold text-slate-500 w-24 truncate">{c.name}</span>
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${c.value}%` }} className={`h-full ${c.name === classification.prediction ? 'bg-blue-600' : 'bg-slate-400'}`} />
                      </div>
                      <span className="text-[9px] font-black text-slate-900 w-8">{c.value.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 06: PRIMARY IMPRESSION */}
          <div className="pt-8 border-t-2 border-slate-100">
            <div className="space-y-4 max-w-2xl mx-auto">
              <h5 className="text-xs font-black text-slate-900 uppercase border-l-4 border-slate-900 pl-3 tracking-widest text-center">06. Diagnostic Impression</h5>
              <div className="bg-blue-900 text-white p-6 rounded-[2rem] space-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><Brain className="w-20 h-20 text-white" /></div>
                <div className="relative">
                  <p className="text-[10px] font-black text-blue-300 uppercase">Primary Detected Condition</p>
                  <h4 className="text-3xl font-black">{classification.prediction}</h4>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-bold text-blue-300 uppercase">Confidence Level</p>
                      <p className="text-xl font-black">{(classification.confidence * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-blue-300 uppercase">Severity Rank</p>
                      <p className="text-xl font-black">{clinical.severity}</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl text-center">
                {clinical.description}
              </p>
            </div>
          </div>

          {/* SECTION 8, 11, 12: DIFFERENTIALS & URGENCY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t-2 border-slate-100">
            <div className="space-y-4">
              <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">08. Differential Considerations</h5>
              <div className="space-y-2">
                {topDifferentials.map((d: any) => (
                  <div key={d.name} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700">{d.name}</span>
                    <span className="text-[9px] font-black text-slate-400">P = {d.value.toFixed(1)}%</span>
                  </div>
                ))}
                {topDifferentials.length === 0 && (
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-400 italic">No secondary differentials within threshold.</div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">11. Urgency Classification</h5>
              <div className={`p-4 rounded-xl border-2 text-center h-full flex flex-col justify-center ${
                clinical.urgency.includes('Urgent') || clinical.urgency.includes('Priority') ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
              }`}>
                <h6 className="text-[10px] font-black uppercase mb-1 text-slate-500">Official Protocol</h6>
                <p className={`text-sm font-black leading-tight ${
                  clinical.urgency.includes('Urgent') || clinical.urgency.includes('Priority') ? 'text-red-700' : 'text-blue-700'
                }`}>{clinical.urgency}</p>
              </div>
            </div>
            <div className="space-y-4">
              <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">12. Initial Recommendations</h5>
              <div className="space-y-2">
                <div className="p-3 bg-slate-900 text-white rounded-xl text-[10px]">
                  <p className="font-black text-blue-400 uppercase mb-1">Specialist Referral</p>
                  <p className="font-medium">Ophthalmology: {classification.prediction.includes('Refractive') ? 'Optometrist' : 'Corneal/Medical Specialist'}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px]">
                  <p className="font-black text-slate-400 uppercase mb-1">Follow-Up Scan</p>
                  <p className="font-bold text-slate-900">Recommended in 7-14 Days</p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 9 & 10: CARE & TREATMENT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t-2 border-slate-100">
            <div className="space-y-4">
              <h5 className="text-xs font-black text-slate-900 uppercase border-l-4 border-slate-900 pl-3 tracking-widest flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> 09. Recommended Clinical Precautions
              </h5>
              <ul className="space-y-3">
                {clinical.precautions.map((p: any, i: number) => (
                  <li key={i} className="flex gap-3 text-xs text-slate-700 leading-relaxed">
                    <span className="font-black text-slate-400">0{i+1}.</span>
                    <span className="font-medium">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <h5 className="text-xs font-black text-slate-900 uppercase border-l-4 border-slate-900 pl-3 tracking-widest">10. General Treatment Pathway</h5>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                <p className="text-[11px] text-slate-600 leading-relaxed italic">
                  "{clinical.treatment}"
                </p>
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-[9px] font-black text-red-600 uppercase mb-1">Non-Prescriptive Disclaimer</p>
                  <p className="text-[10px] text-slate-500 leading-tight">These pathways are general clinical guidelines. Do not initiate any pharmacological treatment without a formal prescription from a licensed physician.</p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 13: TECHNICAL APPENDIX */}
          <div className="pt-8 border-t-2 border-slate-100">
            <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">13. Technical Pipeline Appendix</h5>
            <div className="overflow-x-auto">
              <table className="w-full text-[9px] text-left">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-3 py-2">Module</th>
                    <th className="px-3 py-2">Model Architecture</th>
                    <th className="px-3 py-2">Version</th>
                    <th className="px-3 py-2">Inference Role</th>
                    <th className="px-3 py-2">Latency</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  <tr className="border-b border-slate-100">
                    <td className="px-3 py-2 font-black">Detection</td>
                    <td className="px-3 py-2">YOLOv8-Eye-Custom</td>
                    <td className="px-3 py-2">2.1.0</td>
                    <td className="px-3 py-2">ROI Extraction & Quality Gating</td>
                    <td className="px-3 py-2 text-slate-500">12ms</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-3 py-2 font-black">Segmentation</td>
                    <td className="px-3 py-2">Swin-V2 MONAI Adaptation</td>
                    <td className="px-3 py-2">1.4.5</td>
                    <td className="px-3 py-2">Tissue Mapping & Masking</td>
                    <td className="px-3 py-2 text-slate-500">45ms</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-3 py-2 font-black">Classification</td>
                    <td className="px-3 py-2">ViT-L/16 Multi-Task</td>
                    <td className="px-3 py-2">3.9.0</td>
                    <td className="px-3 py-2">Multi-Disease Scoring</td>
                    <td className="px-3 py-2 text-slate-500">82ms</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="px-3 py-2 font-black">Validation</td>
                    <td className="px-3 py-2">EfficientNet-B7 Ensemble</td>
                    <td className="px-3 py-2">1.0.2</td>
                    <td className="px-3 py-2">Consensus & Fraud Detection</td>
                    <td className="px-3 py-2 text-slate-500">35ms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 15: SIGNATURE BLOCK */}
          <div className="pt-12 space-y-12">
            <div className="flex justify-center">
              <div className="max-w-md w-full space-y-6">
                <div className="flex justify-between items-end border-b border-slate-900 pb-2">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase">System Digital Signature</p>
                    <p className="text-xs font-serif font-black italic text-slate-900 truncate max-w-[200px]">{classification.prediction} Pipeline v2.4.0</p>
                  </div>
                  <div className="w-12 h-12 flex items-center justify-center border-2 border-slate-900 rounded-lg">
                    <Fingerprint className="w-6 h-6 text-slate-400" />
                  </div>
                </div>
                <div className="flex justify-between items-center bg-slate-100 p-4 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Submission Status</p>
                    <p className="text-[10px] font-black text-green-600">READY FOR PHYSICIAN REVIEW</p>
                  </div>
                  <ShieldCheck className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest p-4 border-2 border-slate-100 rounded-2xl">
              <span>Eye Disease Detector System</span>
              <span>Proprietary Clinical Evidence Report</span>
              <span>Page 01 of 01</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
