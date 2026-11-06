import 'dotenv/config';
import { supabase } from '../src/db/supabase';

async function seedCompleteHierarchy() {
  const collegeId = '75';
  const code = 'rvit';

  // 1. Academic Year 2026-27
  const ayId = `ay-${code}-2026`;
  const { error: ayErr } = await supabase.from('academic_years').upsert({
    id: ayId,
    college_id: collegeId,
    year: '2026-27',
    start_date: '2025-06-01',
    end_date: '2026-05-31',
    is_active: true,
  });
  console.log('academic_years (2026-27):', ayErr ? ayErr.message : 'OK');

  // 2. Cohorts
  const cohorts = [
    { id: `coh-${code}-2026-cse`, name: 'Class of 2026 (CSE)', branch: 'CSE', yop: 2026 },
    { id: `coh-${code}-2026-csm`, name: 'Class of 2026 (CSM)', branch: 'CSM', yop: 2026 },
    { id: `coh-${code}-2026-ece`, name: 'Class of 2026 (ECE)', branch: 'ECE', yop: 2026 },
  ];

  for (const c of cohorts) {
    const { error: cohErr } = await supabase.from('cohorts').upsert({
      id: c.id,
      college_id: collegeId,
      academic_year_id: ayId,
      name: c.name,
      year_of_passing: c.yop,
      degree: 'B.Tech',
      branch: c.branch,
      is_active: true,
    });
    console.log(`cohort (${c.name}):`, cohErr ? cohErr.message : 'OK');
  }

  // 3. Sections
  const sections = [
    { id: `sec-${code}-cse-a`, cohort_id: `coh-${code}-2026-cse`, name: 'Section A', room: 'Lab 101', cap: 66 },
    { id: `sec-${code}-cse-b`, cohort_id: `coh-${code}-2026-cse`, name: 'Section B', room: 'Lab 102', cap: 66 },
    { id: `sec-${code}-cse-c`, cohort_id: `coh-${code}-2026-cse`, name: 'Section C', room: 'Lab 103', cap: 66 },
    { id: `sec-${code}-csm-a`, cohort_id: `coh-${code}-2026-csm`, name: 'Section A', room: 'Lab 201', cap: 66 },
    { id: `sec-${code}-csm-b`, cohort_id: `coh-${code}-2026-csm`, name: 'Section B', room: 'Lab 202', cap: 66 },
    { id: `sec-${code}-ece-a`, cohort_id: `coh-${code}-2026-ece`, name: 'Section A', room: 'Lab 301', cap: 66 },
    { id: `sec-${code}-ece-b`, cohort_id: `coh-${code}-2026-ece`, name: 'Section B', room: 'Lab 302', cap: 66 },
  ];

  for (const s of sections) {
    const { error: secErr } = await supabase.from('sections').upsert({
      id: s.id,
      college_id: collegeId,
      cohort_id: s.cohort_id,
      name: s.name,
      room_number: s.room,
      capacity: s.cap,
      is_active: true,
    });
    console.log(`section (${s.id} - ${s.name}):`, secErr ? secErr.message : 'OK');

    // Batches
    await supabase.from('batches').upsert([
      {
        id: `bat-${s.id}-1`,
        college_id: collegeId,
        section_id: s.id,
        name: `${s.name} - Batch 1`,
        batch_code: 'B1',
        max_capacity: 33,
        is_active: true,
      },
      {
        id: `bat-${s.id}-2`,
        college_id: collegeId,
        section_id: s.id,
        name: `${s.name} - Batch 2`,
        batch_code: 'B2',
        max_capacity: 33,
        is_active: true,
      },
    ]);
  }

  const { count: sCount } = await supabase.from('sections').select('*', { count: 'exact', head: true });
  const { count: bCount } = await supabase.from('batches').select('*', { count: 'exact', head: true });
  console.log(`\n🎉 Success! Total active sections: ${sCount}, Total active batches: ${bCount}`);
}

seedCompleteHierarchy().catch(console.error);
