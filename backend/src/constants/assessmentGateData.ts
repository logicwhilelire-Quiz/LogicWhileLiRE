/**
 * LogicWhileLiRE Assessment Suite — Gate Module Constants
 * Doc ID: AL-SPEC-2026-REG
 */

export interface CollegeInfo {
  id: string;
  name: string;
  isTopCampus?: boolean;
}

export interface BranchInfo {
  code: string;
  label: string;
}

export const TOP_CAMPUSES: CollegeInfo[] = [
  { id: 'COL-UNIV-042', name: 'University College of Eng.', isTopCampus: true },
  { id: 'COL-TECH-108', name: 'Tech Campus North', isTopCampus: true },
  { id: 'COL-VVEI-019', name: 'V.V. Engineering Inst.', isTopCampus: true },
  { id: 'COL-OTHR-999', name: 'Other Campus', isTopCampus: true },
];

export const ALL_COLLEGES: CollegeInfo[] = [
  { id: 'COL-UNIV-042', name: 'University College of Eng.', isTopCampus: true },
  { id: 'COL-TECH-108', name: 'Tech Campus North', isTopCampus: true },
  { id: 'COL-VVEI-019', name: 'V.V. Engineering Inst.', isTopCampus: true },
  { id: 'COL-CBIT-001', name: 'Chaitanya Bharathi Institute of Technology (CBIT)' },
  { id: 'COL-VASV-002', name: 'Vasavi College of Engineering' },
  { id: 'COL-VNRV-003', name: 'VNR Vignana Jyothi Institute of Engineering & Technology' },
  { id: 'COL-JNTU-004', name: 'JNTU College of Engineering Hyderabad' },
  { id: 'COL-OUCE-005', name: 'Osmania University College of Engineering (OUCE)' },
  { id: 'COL-GNIT-006', name: 'G. Narayanamma Institute of Technology & Science' },
  { id: 'COL-BVRT-007', name: 'BVRIT Hyderabad College of Engineering for Women' },
  { id: 'COL-SNIS-008', name: 'Sreenidhi Institute of Science and Technology' },
  { id: 'COL-VARD-009', name: 'Vardhaman College of Engineering' },
  { id: 'COL-CVRH-010', name: 'CVR College of Engineering' },
  { id: 'COL-MGIT-011', name: 'Mahatma Gandhi Institute of Technology (MGIT)' },
  { id: 'COL-KMIT-012', name: 'Keshav Memorial Institute of Technology (KMIT)' },
  { id: 'COL-MREC-013', name: 'Malla Reddy Engineering College' },
  { id: 'COL-GCET-014', name: 'Geethanjali College of Engineering and Technology' },
  { id: 'COL-CMRK-015', name: 'CMR College of Engineering & Technology' },
  { id: 'COL-SPEC-016', name: "St. Peter's Engineering College" },
  { id: 'COL-STAN-017', name: 'Stanley College of Engineering & Technology' },
  { id: 'COL-ANUR-018', name: 'Anurag University' },
  { id: 'COL-OTHR-999', name: 'Other Campus', isTopCampus: true },
];

export const VALID_YOP = [2027, 2028, 2029, 2030] as const;
export type YearOfPassing = (typeof VALID_YOP)[number];

export const VALID_SECTIONS = ['A', 'B', 'C', 'D', 'E'] as const;
export type SectionType = (typeof VALID_SECTIONS)[number];

export const BRANCH_CODES: BranchInfo[] = [
  { code: 'CSM', label: 'CSM (AI & Machine Learning)' },
  { code: 'CSE', label: 'CSE (Computer Science & Engineering)' },
  { code: 'CSD', label: 'CSD (Data Science)' },
  { code: 'CSC', label: 'CSC (Cyber Security)' },
  { code: 'INF', label: 'INF / IT (Information Technology)' },
  { code: 'AID', label: 'AID (Artificial Intelligence & Data Science)' },
  { code: 'CSBS', label: 'CSBS (Computer Science & Business Systems)' },
  { code: 'ECE', label: 'ECE (Electronics & Communication Engineering)' },
  { code: 'EEE', label: 'EEE (Electrical & Electronics Engineering)' },
  { code: 'MECH', label: 'MECH (Mechanical Engineering)' },
  { code: 'CIVIL', label: 'CIVIL (Civil Engineering)' },
  { code: 'OTHER', label: 'Other Engineering Specialization' },
];

export function resolveCollegeName(collegeId: string, fallbackName?: string): string {
  const match = ALL_COLLEGES.find((c) => c.id === collegeId);
  if (match) return match.name;
  return fallbackName?.trim() || 'Autonomous Engineering Campus';
}
