export interface CourseOption {
  value: string;
  label: string;
  fullName: string;
  defaultBranches: string[];
}

export interface BranchOption {
  code: string;
  label: string;
  courses: string[];
}

export const COURSE_OPTIONS: CourseOption[] = [
  {
    value: 'B.Tech',
    label: 'B.Tech',
    fullName: 'Bachelor of Technology',
    defaultBranches: ['CSE', 'CSM', 'CSD', 'CSC', 'CSBS', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AI&DS', 'AI&ML'],
  },
  {
    value: 'B.E.',
    label: 'B.E.',
    fullName: 'Bachelor of Engineering',
    defaultBranches: ['CSE', 'CSM', 'CSD', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AI&DS'],
  },
  {
    value: 'M.Tech',
    label: 'M.Tech',
    fullName: 'Master of Technology',
    defaultBranches: ['CSE', 'AI&ML', 'DS', 'VLSI', 'POWER', 'STRUCTURAL', 'ECE'],
  },
  {
    value: 'MCA',
    label: 'MCA',
    fullName: 'Master of Computer Applications',
    defaultBranches: ['MCA', 'CSE', 'AI&DS', 'CLOUD'],
  },
  {
    value: 'BCA',
    label: 'BCA',
    fullName: 'Bachelor of Computer Applications',
    defaultBranches: ['BCA', 'CS', 'AI&DS', 'CLOUD'],
  },
  {
    value: 'B.Sc',
    label: 'B.Sc',
    fullName: 'Bachelor of Science',
    defaultBranches: ['BSC-CS', 'BSC-DS', 'BSC-IT', 'BSC-MATH'],
  },
  {
    value: 'M.Sc',
    label: 'M.Sc',
    fullName: 'Master of Science',
    defaultBranches: ['MSC-CS', 'MSC-DS', 'MSC-IT'],
  },
  {
    value: 'MBA',
    label: 'MBA',
    fullName: 'Master of Business Administration',
    defaultBranches: ['MBA', 'FINANCE', 'HR', 'ANALYTICS', 'MARKETING'],
  },
  {
    value: 'BBA',
    label: 'BBA',
    fullName: 'Bachelor of Business Administration',
    defaultBranches: ['BBA', 'ANALYTICS', 'FINANCE'],
  },
  {
    value: 'B.Com',
    label: 'B.Com',
    fullName: 'Bachelor of Commerce',
    defaultBranches: ['BCOM', 'BCOM-CA'],
  },
  {
    value: 'Diploma',
    label: 'Diploma / Polytechnic',
    fullName: 'Diploma in Engineering',
    defaultBranches: ['DCSE', 'DECE', 'DEEE', 'DMECH', 'DCIVIL'],
  },
];

export const BRANCH_OPTIONS: BranchOption[] = [
  { code: 'CSE', label: 'CSE (Computer Science & Engineering)', courses: ['B.Tech', 'B.E.', 'M.Tech', 'MCA'] },
  { code: 'CSM', label: 'CSM (CSE - AI & Machine Learning)', courses: ['B.Tech', 'B.E.'] },
  { code: 'CSD', label: 'CSD (CSE - Data Science)', courses: ['B.Tech', 'B.E.'] },
  { code: 'CSC', label: 'CSC (CSE - Cyber Security)', courses: ['B.Tech', 'B.E.'] },
  { code: 'CSBS', label: 'CSBS (CS & Business Systems)', courses: ['B.Tech'] },
  { code: 'AI&DS', label: 'AI&DS (Artificial Intelligence & Data Science)', courses: ['B.Tech', 'B.E.', 'MCA', 'BCA'] },
  { code: 'AI&ML', label: 'AI&ML (Artificial Intelligence & ML)', courses: ['B.Tech', 'M.Tech'] },
  { code: 'IT', label: 'IT (Information Technology)', courses: ['B.Tech', 'B.E.'] },
  { code: 'ECE', label: 'ECE (Electronics & Communication)', courses: ['B.Tech', 'B.E.', 'M.Tech'] },
  { code: 'EEE', label: 'EEE (Electrical & Electronics)', courses: ['B.Tech', 'B.E.'] },
  { code: 'MECH', label: 'MECH (Mechanical Engineering)', courses: ['B.Tech', 'B.E.'] },
  { code: 'CIVIL', label: 'CIVIL (Civil Engineering)', courses: ['B.Tech', 'B.E.'] },
  { code: 'MCA', label: 'MCA (Computer Applications)', courses: ['MCA'] },
  { code: 'BCA', label: 'BCA (Computer Applications)', courses: ['BCA'] },
  { code: 'MBA', label: 'MBA (Business Administration)', courses: ['MBA'] },
  { code: 'BBA', label: 'BBA (Business Administration)', courses: ['BBA'] },
  { code: 'BSC-CS', label: 'B.Sc Computer Science', courses: ['B.Sc'] },
  { code: 'BSC-DS', label: 'B.Sc Data Science', courses: ['B.Sc'] },
  { code: 'MSC-CS', label: 'M.Sc Computer Science', courses: ['M.Sc'] },
  { code: 'BCOM-CA', label: 'B.Com Computer Applications', courses: ['B.Com'] },
  { code: 'DCSE', label: 'Diploma CSE', courses: ['Diploma'] },
  { code: 'DECE', label: 'Diploma ECE', courses: ['Diploma'] },
  { code: 'DEEE', label: 'Diploma EEE', courses: ['Diploma'] },
];

export const DEFAULT_SECTION_PRESETS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function getCourseOption(courseCode?: string | null): CourseOption | undefined {
  if (!courseCode) return undefined;
  const target = courseCode.trim().toLowerCase();
  return COURSE_OPTIONS.find((c) => c.value.toLowerCase() === target || c.label.toLowerCase() === target);
}

export function getBranchesForCourse(courseCode?: string | null): BranchOption[] {
  if (!courseCode || courseCode === 'ALL' || courseCode === 'CUSTOM') {
    return BRANCH_OPTIONS;
  }
  const target = courseCode.trim().toLowerCase();
  const matched = BRANCH_OPTIONS.filter((b) =>
    b.courses.some((c) => c.toLowerCase() === target)
  );
  return matched.length > 0 ? matched : BRANCH_OPTIONS;
}

export function inferCourseFromBranch(branchCode?: string | null): string {
  if (!branchCode) return 'B.Tech';
  const upper = branchCode.trim().toUpperCase();
  if (upper.startsWith('MCA')) return 'MCA';
  if (upper.startsWith('BCA')) return 'BCA';
  if (upper.startsWith('MBA') || upper === 'FINANCE' || upper === 'HR' || upper === 'MARKETING') return 'MBA';
  if (upper.startsWith('BBA')) return 'BBA';
  if (upper.startsWith('BSC')) return 'B.Sc';
  if (upper.startsWith('MSC')) return 'M.Sc';
  if (upper.startsWith('BCOM')) return 'B.Com';
  if (upper.startsWith('D') && ['DCSE', 'DECE', 'DEEE', 'DMECH', 'DCIVIL'].includes(upper)) return 'Diploma';
  return 'B.Tech';
}

export function buildSectionChoices(
  liveSections: Array<{ id?: number | string; section_name?: string; name?: string; branch?: string }>,
  branch?: string | null
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const pushUnique = (val?: string | null) => {
    const clean = (val || '').trim();
    if (!clean) return;
    const key = clean.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      ordered.push(clean);
    }
  };

  for (const sec of liveSections) {
    pushUnique(sec.section_name || sec.name);
  }

  const branchPrefix = branch && branch !== 'ALL' ? branch.trim().toUpperCase() : '';
  if (branchPrefix) {
    ['A', 'B', 'C', 'D'].forEach((letter) => pushUnique(`${branchPrefix}-${letter}`));
  }
  DEFAULT_SECTION_PRESETS.forEach((letter) => pushUnique(letter));

  return ordered;
}
