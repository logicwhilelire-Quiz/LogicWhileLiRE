import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { supabase } from '../db/supabase';

export const SECTORS_TO_SEED = [
  {
    id: 'sector-quant',
    code: 'SEC-QUANT',
    sector_number: 1,
    name: 'Quantitative Aptitude & Numerical Velocity',
    short_name: 'Quantitative Aptitude',
    color: '#F59E0B',
    description: 'Master arithmetic mastery, speed mathematics, time-work relations, probability, and advanced coordinate geometry.',
    is_active: true,
  },
  {
    id: 'sector-logic',
    code: 'SEC-LOGIC',
    sector_number: 2,
    name: 'Logical Reasoning & Deductive Logic',
    short_name: 'Logical Reasoning',
    color: '#8B5CF6',
    description: 'Evaluate complex constraint satisfaction, relational topologies, syllogistic validity, and sequential pattern decoding.',
    is_active: true,
  },
  {
    id: 'sector-corecs',
    code: 'SEC-CORECS',
    sector_number: 3,
    name: 'Core Computer Science & Systems',
    short_name: 'Core Computer Science',
    color: '#10B981',
    description: 'Rigorous examination of process scheduling, virtual memory paging, relational algebra, ACID isolation levels, and TCP socket states.',
    is_active: true,
  },
  {
    id: 'sector-dsa',
    code: 'SEC-DSA',
    sector_number: 4,
    name: 'Data Structures & Algorithmic Complexity',
    short_name: 'DSA & Algorithms',
    color: '#38BDF8',
    description: 'Solve competitive algorithmic challenges covering balanced AVL trees, Dijkstra shortest paths, Dynamic Programming memoization, and amortized bounds.',
    is_active: true,
  },
  {
    id: 'sector-fullstack',
    code: 'SEC-FULLSTACK',
    sector_number: 5,
    name: 'Full-Stack Architecture & Distributed Systems',
    short_name: 'Full-Stack & Systems',
    color: '#F43F5E',
    description: 'Design distributed architectures, async non-blocking event loops, Redis tiered cache hierarchies, and WebSockets telemetry pipelines.',
    is_active: true,
  },
];

async function seedEverything() {
  console.log('🚀 [1/3] Seeding 5 Technical Sectors into curriculum...');

  for (const s of SECTORS_TO_SEED) {
    const { error } = await supabase.from('curriculum').upsert(s);
    if (error) console.warn(`Note on curriculum ${s.code}:`, error.message);
  }
  console.log('✅ 5 Technical Sectors seeded into curriculum successfully.');

  console.log('🚀 [2/3] Seeding collegiate academic hierarchy for all colleges & sections...');

  const { data: colleges, error: cErr } = await supabase.from('colleges').select('id, college_code, college_name');
  if (cErr || !colleges || colleges.length === 0) {
    console.error('❌ Could not fetch colleges:', cErr);
    return;
  }

  console.log(`Found ${colleges.length} colleges:`, colleges.map(c => `${c.college_code} (id: ${c.id})`).join(', '));

  const defaultStudentPassword = process.env.INITIAL_STUDENT_PASSWORD || process.env.STUDENT_DEFAULT_PASSWORD || ('Stud#' + crypto.randomBytes(6).toString('hex') + '!');
  const passwordHash = await bcrypt.hash(defaultStudentPassword, 12);
  const studentsToInsert: any[] = [];

  for (const college of colleges) {
    const cid = String(college.id);
    const code = college.college_code.toUpperCase();

    // A. Academic Year 2025-2026
    const ayId = `ay-${code.toLowerCase()}-2025-26`;
    await supabase.from('academic_years').upsert({
      id: ayId,
      college_id: cid,
      year: '2025-2026',
      yop: 2026,
      start_date: '2025-06-01',
      end_date: '2026-05-31',
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    // B. Cohorts (Class of 2026 CSM, Class of 2026 CSE, Class of 2027 CSE)
    const cohortsToSeed = [
      { id: `coh-${code.toLowerCase()}-2026-csm`, name: 'Class of 2026 (CSM)', yop: 2026, degree: 'B.Tech', branch: 'CSM' },
      { id: `coh-${code.toLowerCase()}-2026-cse`, name: 'Class of 2026 (CSE)', yop: 2026, degree: 'B.Tech', branch: 'CSE' },
      { id: `coh-${code.toLowerCase()}-2027-cse`, name: 'Class of 2027 (CSE)', yop: 2027, degree: 'B.Tech', branch: 'CSE' },
    ];

    for (const coh of cohortsToSeed) {
      await supabase.from('cohorts').upsert({
        id: coh.id,
        college_id: cid,
        academic_year_id: ayId,
        name: coh.name,
        year_of_passing: coh.yop,
        yop: coh.yop,
        degree: coh.degree,
        branch: coh.branch,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    }

    // C. Sections
    const sectionsToSeed = [
      { id: `sec-${code.toLowerCase()}-csm-a`, cohort_id: `coh-${code.toLowerCase()}-2026-csm`, name: 'CSM-A', section_name: 'CSM Section A', room: 'Lab 301', cap: 66, branch: 'CSM' },
      { id: `sec-${code.toLowerCase()}-csm-b`, cohort_id: `coh-${code.toLowerCase()}-2026-csm`, name: 'CSM-B', section_name: 'CSM Section B', room: 'Lab 302', cap: 66, branch: 'CSM' },
      { id: `sec-${code.toLowerCase()}-cse-a`, cohort_id: `coh-${code.toLowerCase()}-2026-cse`, name: 'CSE-A', section_name: 'CSE Section A', room: 'Lab 201', cap: 72, branch: 'CSE' },
      { id: `sec-${code.toLowerCase()}-cse-b`, cohort_id: `coh-${code.toLowerCase()}-2026-cse`, name: 'CSE-B', section_name: 'CSE Section B', room: 'Lab 202', cap: 72, branch: 'CSE' },
      { id: `sec-${code.toLowerCase()}-cse-c`, cohort_id: `coh-${code.toLowerCase()}-2026-cse`, name: 'CSE-C', section_name: 'CSE Section C', room: 'Lab 203', cap: 72, branch: 'CSE' },
    ];

    for (const sec of sectionsToSeed) {
      await supabase.from('sections').upsert({
        id: sec.id,
        college_id: cid,
        cohort_id: sec.cohort_id,
        academic_year_id: ayId,
        name: sec.name,
        section_name: sec.section_name,
        room_number: sec.room,
        capacity: sec.cap,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

      // D. Batches
      const b1Id = `bat-${sec.id}-1`;
      const b2Id = `bat-${sec.id}-2`;

      await supabase.from('batches').upsert([
        {
          id: b1Id,
          college_id: cid,
          cohort_id: sec.cohort_id,
          section_id: sec.id,
          name: `${sec.name}-Batch 1`,
          batch_name: `${sec.name} Lab Batch 1`,
          batch_code: 'B1',
          max_capacity: Math.floor(sec.cap / 2),
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          id: b2Id,
          college_id: cid,
          cohort_id: sec.cohort_id,
          section_id: sec.id,
          name: `${sec.name}-Batch 2`,
          batch_name: `${sec.name} Lab Batch 2`,
          batch_code: 'B2',
          max_capacity: Math.floor(sec.cap / 2),
          is_active: true,
          updated_at: new Date().toISOString(),
        }
      ]);

      // E. Prepare Students for this section
      const sampleNames = [
        ['Charan Sai', 'Ravuri'],
        ['Aravind', 'Swamy'],
        ['Bhavana', 'Reddy'],
        ['Karthik', 'Varma'],
        ['Divya', 'Sri'],
      ];

      sampleNames.forEach(([first, last], idx) => {
        const rollNum = `22${code}${sec.name.replace('-', '')}${String(idx + 1).padStart(3, '0')}`;
        studentsToInsert.push({
          first_name: first,
          last_name: last,
          name: `${first} ${last}`,
          email: `${first.toLowerCase()}.${last.toLowerCase()}.${rollNum.toLowerCase()}@${code.toLowerCase()}.ac.in`,
          college_id: cid,
          college_name: college.college_name,
          roll_number: rollNum,
          hall_ticket: rollNum,
          branch_code: sec.branch,
          section: sec.name,
          section_id: sec.id,
          cohort_id: sec.cohort_id,
          academic_year_id: ayId,
          year_of_passing: 2026,
          password_hash: passwordHash,
          is_active: true,
          is_verified: true,
        });
      });
    }

    console.log(`✅ Seeded academic structure (AY, 3 Cohorts, 5 Sections, 10 Batches) for ${code}`);
  }

  console.log(`🚀 [3/3] Upserting ${studentsToInsert.length} students across all sections...`);
  for (const st of studentsToInsert) {
    const { error: sErr } = await supabase.from('students').upsert(st, { onConflict: 'college_id,roll_number' });
    if (sErr) {
      console.warn(`Student upsert note (${st.roll_number}):`, sErr.message);
    }
  }

  const { count: secCount } = await supabase.from('sections').select('*', { count: 'exact', head: true });
  const { count: stCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
  console.log(`🎉 Complete! Active Sections: ${secCount}, Active Students: ${stCount}`);
}

seedEverything().catch(err => {
  console.error('Fatal error during hierarchy and sector seeding:', err);
  process.exit(1);
});
