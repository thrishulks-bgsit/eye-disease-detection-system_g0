
export interface PatientData {
  fullName: string;
  patientId: string;
  dob: string;
  age: string;
  gender: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  referredBy: string;
  occupation: string;
  medicalConditions: string;
  medications: string;
  allergies: string;
  familyHistory: string;
  lifestyle: string;
  previousSurgeries: string;
  lastExamDate: string;
  correctiveLenses: string;
}

export const INITIAL_PATIENT_DATA: PatientData = {
  fullName: '',
  patientId: '',
  dob: '',
  age: '',
  gender: '',
  bloodGroup: '',
  phone: '',
  email: '',
  address: '',
  emergencyContactName: '',
  emergencyContactRelation: '',
  emergencyContactPhone: '',
  referredBy: '',
  occupation: '',
  medicalConditions: '',
  medications: '',
  allergies: '',
  familyHistory: '',
  lifestyle: '',
  previousSurgeries: '',
  lastExamDate: '',
  correctiveLenses: '',
};
