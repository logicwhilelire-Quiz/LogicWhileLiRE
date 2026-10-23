import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import GlowCard from '../components/3d/GlowCard';
import MagneticButton from '../components/3d/MagneticButton';
import FlightPathLines from '../components/3d/FlightPathLines';
import CodeEditorHolo from '../components/3d/CodeEditorHolo';
import SectorRadar3D, { type SectorScore } from '../components/3d/SectorRadar3D';
import SectorsUniverse3D from '../components/3d/SectorsUniverse3D';

interface Challenge {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  xp: number;
  topic: string;
  sectorId: string;
  sectorName: string;
  sectorBadge: string;
  sectorColor: string;
  description: string;
  starterCode: string;
  testCases: Array<{
    id: string;
    input_text: string;
    expected_output: string;
    is_hidden: boolean;
    marks?: number;
  }>;
}

const SECTOR_CATEGORIES = [
  { id: 'all', label: 'All 5 Sectors', icon: '🪐' },
  { id: 'sector-quant', label: 'Sector 1: Quant', icon: '📐', color: '#F59E0B' },
  { id: 'sector-logic', label: 'Sector 2: Logic', icon: '🧩', color: '#8B5CF6' },
  { id: 'sector-core-cs', label: 'Sector 3: Core CS', icon: '💻', color: '#10B981' },
  { id: 'sector-dsa', label: 'Sector 4: DSA', icon: '⚡', color: '#38BDF8' },
  { id: 'sector-fullstack', label: 'Sector 5: Full-Stack', icon: '🌐', color: '#F43F5E' },
];

const DAILY_CHALLENGES: Challenge[] = [
  // ── SECTOR 1: QUANTITATIVE APTITUDE & VELOCITY ──
  {
    id: 'ch-quant-1',
    title: 'Velocity Equations: Fuel Burn Vector',
    difficulty: 'Easy',
    xp: 100,
    topic: 'Quantitative Aptitude (Relative Speed & Rate)',
    sectorId: 'sector-quant',
    sectorName: 'Quantitative Aptitude & Velocity',
    sectorBadge: '📐 Sector 1 · Set A',
    sectorColor: '#F59E0B',
    description: `A spacecraft engine consumes fuel at a rate inversely proportional to thruster efficiency. Given two integers: fuel mass M (kg) and burn rate R (kg/s), calculate and print the total burn duration in integer seconds.\n\nInput format:\nLine 1: Two space-separated integers M and R\n\nExample:\nInput:\n1200 40\nOutput:\n30`,
    starterCode: `import sys

def solve():
    data = sys.stdin.read().split()
    if len(data) < 2:
        return
    mass, rate = int(data[0]), int(data[1])
    print(mass // rate)

if __name__ == '__main__':
    solve()
`,
    testCases: [
      { id: '1', input_text: '1200 40', expected_output: '30', is_hidden: false, marks: 50 },
      { id: '2', input_text: '500 25', expected_output: '20', is_hidden: false, marks: 30 },
      { id: '3', input_text: '9999 33', expected_output: '303', is_hidden: true, marks: 20 },
    ],
  },
  {
    id: 'ch-quant-2',
    title: 'Orbital Synchronizer: Clock Angle Invariant',
    difficulty: 'Medium',
    xp: 140,
    topic: 'Quantitative Aptitude (Angular Velocity & Geometry)',
    sectorId: 'sector-quant',
    sectorName: 'Quantitative Aptitude & Velocity',
    sectorBadge: '📐 Sector 1 · Set B',
    sectorColor: '#F59E0B',
    description: `Calculate the acute angle (in degrees, rounded to the nearest integer) between the hour hand and minute hand of an analog celestial chronometer for a given time H hours and M minutes (12-hour format).\n\nInput:\nH M\n\nExample:\nInput:\n3 30\nOutput:\n75`,
    starterCode: `import sys

def clock_angle():
    data = sys.stdin.read().split()
    if len(data) < 2:
        return
    h, m = int(data[0]), int(data[1])
    # Hour angle: 30*h + 0.5*m, Minute angle: 6*m
    h_angle = (h % 12) * 30 + m * 0.5
    m_angle = m * 6
    diff = abs(h_angle - m_angle)
    angle = min(diff, 360 - diff)
    print(round(angle))

if __name__ == '__main__':
    clock_angle()
`,
    testCases: [
      { id: '1', input_text: '3 30', expected_output: '75', is_hidden: false, marks: 50 },
      { id: '2', input_text: '12 0', expected_output: '0', is_hidden: false, marks: 30 },
      { id: '3', input_text: '9 0', expected_output: '90', is_hidden: true, marks: 20 },
    ],
  },
  {
    id: 'ch-quant-3',
    title: 'Probabilistic Combinatorics: Packet Loss Resilience',
    difficulty: 'Hard',
    xp: 180,
    topic: 'Quantitative Aptitude (Permutations & Probability)',
    sectorId: 'sector-quant',
    sectorName: 'Quantitative Aptitude & Velocity',
    sectorBadge: '📐 Sector 1 · Set C',
    sectorColor: '#F59E0B',
    description: `Given N redundant transmission packets where at least K packets must arrive safely for message reconstruction. If each packet arrives independently with probability 1/2, compute the number of successful combinations out of the 2^N possible transmission outcomes.\n\nInput:\nN K\n\nExample:\nInput:\n4 3\nOutput:\n5`,
    starterCode: `import sys
import math

def packet_comb():
    data = sys.stdin.read().split()
    if len(data) < 2:
        return
    n, k = int(data[0]), int(data[1])
    total = sum(math.comb(n, i) for i in range(k, n + 1))
    print(total)

if __name__ == '__main__':
    packet_comb()
`,
    testCases: [
      { id: '1', input_text: '4 3', expected_output: '5', is_hidden: false, marks: 50 },
      { id: '2', input_text: '5 5', expected_output: '1', is_hidden: false, marks: 30 },
      { id: '3', input_text: '6 4', expected_output: '22', is_hidden: true, marks: 20 },
    ],
  },

  // ── SECTOR 2: LOGICAL REASONING & DEDUCTION ──
  {
    id: 'ch-logic-1',
    title: 'LogicWhile Cipher: Deductive Invariant Decryptor',
    difficulty: 'Easy',
    xp: 110,
    topic: 'Logical Reasoning (Pattern Decoders)',
    sectorId: 'sector-logic',
    sectorName: 'Logical Reasoning & Deduction',
    sectorBadge: '🧩 Sector 2 · Set A',
    sectorColor: '#8B5CF6',
    description: `The LogicWhileLiRE platform encodes transmission packets by shifting uppercase letters by +1 then +2 alternately (A->B, B->D). Write a program that takes an encrypted uppercase string from stdin and prints the deciphered word.\n\nExample:\nInput:\nMQHKE\nOutput:\nLOGIC`,
    starterCode: `import sys

def decrypt():
    s = sys.stdin.read().strip()
    if not s:
        return
    res = []
    for i, ch in enumerate(s):
        shift = 1 if i % 2 == 0 else 2
        orig = chr((ord(ch) - 65 - shift) % 26 + 65)
        res.append(orig)
    print("".join(res))

if __name__ == '__main__':
    decrypt()
`,
    testCases: [
      { id: '1', input_text: 'MQHKE', expected_output: 'LOGIC', is_hidden: false, marks: 50 },
      { id: '2', input_text: 'XIKMG', expected_output: 'WHILE', is_hidden: false, marks: 30 },
      { id: '3', input_text: 'B', expected_output: 'A', is_hidden: true, marks: 20 },
    ],
  },
  {
    id: 'ch-logic-2',
    title: 'Circular Seating Matrix: Opposite Invariant Resolver',
    difficulty: 'Medium',
    xp: 150,
    topic: 'Logical Reasoning (Constraint Networks & Seating)',
    sectorId: 'sector-logic',
    sectorName: 'Logical Reasoning & Deduction',
    sectorBadge: '🧩 Sector 2 · Set B',
    sectorColor: '#8B5CF6',
    description: `N persons (even integer, N >= 4) sit uniformly around a circular console numbered 1 to N clockwise. Given person X, determine who sits diametrically opposite to person X.\n\nInput:\nN X\n\nExample:\nInput:\n8 3\nOutput:\n7`,
    starterCode: `import sys

def opposite_person():
    data = sys.stdin.read().split()
    if len(data) < 2:
        return
    n, x = int(data[0]), int(data[1])
    half = n // 2
    opp = ((x - 1 + half) % n) + 1
    print(opp)

if __name__ == '__main__':
    opposite_person()
`,
    testCases: [
      { id: '1', input_text: '8 3', expected_output: '7', is_hidden: false, marks: 50 },
      { id: '2', input_text: '6 1', expected_output: '4', is_hidden: false, marks: 30 },
      { id: '3', input_text: '10 8', expected_output: '3', is_hidden: true, marks: 20 },
    ],
  },
  {
    id: 'ch-logic-3',
    title: 'Syllogistic Deductive Engine: Boolean Truth Matrix',
    difficulty: 'Hard',
    xp: 190,
    topic: 'Logical Reasoning (Syllogisms & Constraint Networks)',
    sectorId: 'sector-logic',
    sectorName: 'Logical Reasoning & Deduction',
    sectorBadge: '🧩 Sector 2 · Set C',
    sectorColor: '#8B5CF6',
    description: `Given N deductive premise implications of format "A->B" and a query "X->Y", output "VALID" if X implies Y by transitive syllogism, otherwise output "INVALID".\n\nInput:\nLine 1: N\nNext N lines: Pairs of characters separated by space representing A B (A implies B)\nLine N+2: Query X Y\n\nExample:\nInput:\n2\nA B\nB C\nA C\nOutput:\nVALID`,
    starterCode: `import sys
from collections import defaultdict, deque

def syllogism_eval():
    lines = sys.stdin.read().splitlines()
    if not lines:
        return
    n = int(lines[0].strip())
    adj = defaultdict(list)
    for i in range(1, n + 1):
        u, v = lines[i].split()
        adj[u].append(v)
    q_start, q_end = lines[n + 1].split()
    
    # BFS reachability
    visited = set()
    queue = deque([q_start])
    while queue:
        curr = queue.popleft()
        if curr == q_end:
            print("VALID")
            return
        for neighbor in adj[curr]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    print("INVALID")

if __name__ == '__main__':
    syllogism_eval()
`,
    testCases: [
      { id: '1', input_text: '2\nA B\nB C\nA C', expected_output: 'VALID', is_hidden: false, marks: 50 },
      { id: '2', input_text: '2\nA B\nC D\nA D', expected_output: 'INVALID', is_hidden: false, marks: 30 },
      { id: '3', input_text: '3\nP Q\nQ R\nR S\nP S', expected_output: 'VALID', is_hidden: true, marks: 20 },
    ],
  },

  // ── SECTOR 3: CORE COMPUTER SCIENCE SYSTEMS ──
  {
    id: 'ch-corecs-1',
    title: 'Operating Systems: FIFO Page Faults',
    difficulty: 'Medium',
    xp: 140,
    topic: 'Operating Systems (Virtual Memory)',
    sectorId: 'sector-core-cs',
    sectorName: 'Core Computer Science Systems',
    sectorBadge: '💻 Sector 3 · Set A',
    sectorColor: '#10B981',
    description: `Given a page reference string and number of physical memory frames K, compute the total number of page faults using the FIFO page replacement algorithm.\n\nInput:\nLine 1: Integer K (frame capacity)\nLine 2: Space-separated page requests\n\nExample:\nInput:\n3\n7 0 1 2 0 3 0 4 2 3 0 3 2\nOutput:\n12`,
    starterCode: `import sys

def fifo_page_faults():
    lines = sys.stdin.read().splitlines()
    if len(lines) < 2:
        return
    capacity = int(lines[0].strip())
    pages = [int(x) for x in lines[1].split()]
    
    memory = []
    faults = 0
    for p in pages:
        if p not in memory:
            faults += 1
            if len(memory) == capacity:
                memory.pop(0)
            memory.append(p)
    print(faults)

if __name__ == '__main__':
    fifo_page_faults()
`,
    testCases: [
      { id: '1', input_text: '3\n7 0 1 2 0 3 0 4 2 3 0 3 2', expected_output: '12', is_hidden: false, marks: 60 },
      { id: '2', input_text: '4\n1 2 3 4 1 2 5 1 2 3 4 5', expected_output: '10', is_hidden: false, marks: 40 },
    ],
  },
  {
    id: 'ch-corecs-2',
    title: 'Concurrency & Deadlock: Banker\'s Safety Verifier',
    difficulty: 'Hard',
    xp: 180,
    topic: 'Operating Systems (Deadlock Avoidance)',
    sectorId: 'sector-core-cs',
    sectorName: 'Core Computer Science Systems',
    sectorBadge: '💻 Sector 3 · Set B',
    sectorColor: '#10B981',
    description: `Given 1 resource type with Available units A, and N processes with Current Allocation and Maximum Need, determine if the system is in a SAFE state. Output SAFE or UNSAFE.\n\nInput:\nLine 1: Available A\nLine 2: N (number of processes)\nLine 3: N space-separated allocated integers\nLine 4: N space-separated max need integers\n\nExample:\nInput:\n3\n3\n1 2 3\n3 4 5\nOutput:\nSAFE`,
    starterCode: `import sys

def bankers_safety():
    lines = sys.stdin.read().splitlines()
    if len(lines) < 4:
        return
    avail = int(lines[0].strip())
    n = int(lines[1].strip())
    alloc = [int(x) for x in lines[2].split()]
    max_need = [int(x) for x in lines[3].split()]
    need = [max_need[i] - alloc[i] for i in range(n)]
    
    finished = [False] * n
    work = avail
    
    for _ in range(n):
        found = False
        for i in range(n):
            if not finished[i] and need[i] <= work:
                work += alloc[i]
                finished[i] = True
                found = True
                break
        if not found:
            break
            
    print("SAFE" if all(finished) else "UNSAFE")

if __name__ == '__main__':
    bankers_safety()
`,
    testCases: [
      { id: '1', input_text: '3\n3\n1 2 3\n3 4 5', expected_output: 'SAFE', is_hidden: false, marks: 50 },
      { id: '2', input_text: '1\n2\n2 2\n5 5', expected_output: 'UNSAFE', is_hidden: false, marks: 30 },
      { id: '3', input_text: '5\n4\n0 1 2 1\n4 2 3 3', expected_output: 'SAFE', is_hidden: true, marks: 20 },
    ],
  },
  {
    id: 'ch-corecs-3',
    title: 'Computer Networks: TCP Sliding Window Invariant',
    difficulty: 'Medium',
    xp: 150,
    topic: 'Computer Networks (Sliding Window & Flow Control)',
    sectorId: 'sector-core-cs',
    sectorName: 'Core Computer Science Systems',
    sectorBadge: '💻 Sector 3 · Set C',
    sectorColor: '#10B981',
    description: `A TCP sender has a congestion window of W packets and base sequence number B. Given cumulative ACK packet sequence A from receiver, output the new window base and number of packets newly acknowledged.\n\nInput:\nB W A\n\nExample:\nInput:\n100 5 103\nOutput:\n103 3`,
    starterCode: `import sys

def tcp_window():
    data = sys.stdin.read().split()
    if len(data) < 3:
        return
    b, w, a = int(data[0]), int(data[1]), int(data[2])
    new_base = max(b, a)
    acked = max(0, new_base - b)
    print(f"{new_base} {acked}")

if __name__ == '__main__':
    tcp_window()
`,
    testCases: [
      { id: '1', input_text: '100 5 103', expected_output: '103 3', is_hidden: false, marks: 50 },
      { id: '2', input_text: '50 10 50', expected_output: '50 0', is_hidden: false, marks: 30 },
      { id: '3', input_text: '1 4 4', expected_output: '4 3', is_hidden: true, marks: 20 },
    ],
  },

  // ── SECTOR 4: DATA STRUCTURES & ALGORITHMS ──
  {
    id: 'ch-dsa-1',
    title: 'Flight Envelope: Maximum Peak Velocity (LIS)',
    difficulty: 'Medium',
    xp: 150,
    topic: 'Data Structures & Algorithms (LIS)',
    sectorId: 'sector-dsa',
    sectorName: 'Data Structures & Algorithms',
    sectorBadge: '⚡ Sector 4 · Set A',
    sectorColor: '#38BDF8',
    description: `A spacecraft's altitude readings are captured across consecutive sensor intervals. Write a program to read N altitude values from stdin and output the length of the longest strictly increasing sub-sequence of sensor values.\n\nInput:\n10 9 2 5 3 7 101 18\nOutput:\n4`,
    starterCode: `import sys

def length_of_lis():
    data = sys.stdin.read().split()
    if not data:
        print(0)
        return
    nums = [int(x) for x in data]
    
    tails = []
    import bisect
    for x in nums:
        idx = bisect.bisect_left(tails, x)
        if idx == len(tails):
            tails.append(x)
        else:
            tails[idx] = x
    print(len(tails))

if __name__ == '__main__':
    length_of_lis()
`,
    testCases: [
      { id: '1', input_text: '10 9 2 5 3 7 101 18', expected_output: '4', is_hidden: false, marks: 75 },
      { id: '2', input_text: '0 1 0 3 2 3', expected_output: '4', is_hidden: false, marks: 45 },
      { id: '3', input_text: '7 7 7 7 7 7 7', expected_output: '1', is_hidden: true, marks: 30 },
    ],
  },
  {
    id: 'ch-dsa-2',
    title: 'Monotonic Stack: Telemetry Sensor Next Greater Peak',
    difficulty: 'Easy',
    xp: 120,
    topic: 'Data Structures & Algorithms (Monotonic Stack)',
    sectorId: 'sector-dsa',
    sectorName: 'Data Structures & Algorithms',
    sectorBadge: '⚡ Sector 4 · Set B',
    sectorColor: '#38BDF8',
    description: `Given a sequence of sensor temperature readings, for each position, find the next strictly greater reading that appears to its right. If none exists, output -1.\n\nInput:\n4 5 2 25\nOutput:\n5 25 25 -1`,
    starterCode: `import sys

def next_greater():
    data = sys.stdin.read().split()
    if not data:
        return
    nums = [int(x) for x in data]
    n = len(nums)
    res = [-1] * n
    stack = []
    
    for i in range(n - 1, -1, -1):
        while stack and stack[-1] <= nums[i]:
            stack.pop()
        if stack:
            res[i] = stack[-1]
        stack.append(nums[i])
    print(" ".join(map(str, res)))

if __name__ == '__main__':
    next_greater()
`,
    testCases: [
      { id: '1', input_text: '4 5 2 25', expected_output: '5 25 25 -1', is_hidden: false, marks: 50 },
      { id: '2', input_text: '13 7 6 12', expected_output: '-1 12 12 -1', is_hidden: false, marks: 30 },
      { id: '3', input_text: '1 2 3 4', expected_output: '2 3 4 -1', is_hidden: true, marks: 20 },
    ],
  },
  {
    id: 'ch-dsa-3',
    title: 'Minimal Spanning Tree: Orbital Relay Network',
    difficulty: 'Hard',
    xp: 190,
    topic: 'Data Structures & Algorithms (Kruskal & Disjoint Set)',
    sectorId: 'sector-dsa',
    sectorName: 'Data Structures & Algorithms',
    sectorBadge: '⚡ Sector 4 · Set C',
    sectorColor: '#38BDF8',
    description: `Connect V space probes with minimum cost using bidirectional quantum links. Given V, E and E triplets (u v weight), compute the minimal total weight required to connect all probes.\n\nInput:\nLine 1: V E\nNext E lines: u v w\n\nExample:\nInput:\n3 3\n0 1 1\n1 2 2\n0 2 5\nOutput:\n3`,
    starterCode: `import sys

def mst_cost():
    lines = sys.stdin.read().splitlines()
    if not lines:
        return
    v, e = [int(x) for x in lines[0].split()]
    edges = []
    for i in range(1, e + 1):
        u, val, w = [int(x) for x in lines[i].split()]
        edges.append((w, u, val))
    edges.sort()
    
    parent = list(range(v))
    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]
        
    total = 0
    count = 0
    for w, u, val in edges:
        root_u = find(u)
        root_v = find(val)
        if root_u != root_v:
            parent[root_u] = root_v
            total += w
            count += 1
            if count == v - 1:
                break
    print(total)

if __name__ == '__main__':
    mst_cost()
`,
    testCases: [
      { id: '1', input_text: '3 3\n0 1 1\n1 2 2\n0 2 5', expected_output: '3', is_hidden: false, marks: 50 },
      { id: '2', input_text: '4 5\n0 1 10\n0 2 6\n0 3 5\n1 3 15\n2 3 4', expected_output: '19', is_hidden: false, marks: 30 },
      { id: '3', input_text: '2 1\n0 1 42', expected_output: '42', is_hidden: true, marks: 20 },
    ],
  },

  // ── SECTOR 5: FULL-STACK & SYSTEMS ARCHITECTURE ──
  {
    id: 'ch-fullstack-1',
    title: 'Distributed System: Token Bucket Rate Limiter',
    difficulty: 'Hard',
    xp: 180,
    topic: 'Full-Stack Architecture (Rate Limiting)',
    sectorId: 'sector-fullstack',
    sectorName: 'Full-Stack & Distributed Architecture',
    sectorBadge: '🌐 Sector 5 · Set A',
    sectorColor: '#F43F5E',
    description: `Simulate a token bucket rate limiter with burst capacity C and refill rate R (tokens per second). Given arrival timestamps of request packet arrivals, output 1 if packet is accepted, 0 if rate-limited.\n\nInput:\nLine 1: Capacity C and Refill Rate R\nLine 2: Integer N (number of arrivals)\nLine 3: N space-separated arrival seconds (strictly increasing integers)\n\nExample:\nInput:\n2 1\n3\n0 0 1\nOutput:\n1 1 1`,
    starterCode: `import sys

def rate_limiter():
    lines = sys.stdin.read().splitlines()
    if len(lines) < 3:
        return
    c, r = [int(x) for x in lines[0].split()]
    arrivals = [int(x) for x in lines[2].split()]
    
    tokens = c
    last_time = arrivals[0] if arrivals else 0
    results = []
    
    for t in arrivals:
        delta = t - last_time
        tokens = min(c, tokens + delta * r)
        last_time = t
        if tokens >= 1:
            tokens -= 1
            results.append("1")
        else:
            results.append("0")
    print(" ".join(results))

if __name__ == '__main__':
    rate_limiter()
`,
    testCases: [
      { id: '1', input_text: '2 1\n3\n0 0 1', expected_output: '1 1 1', is_hidden: false, marks: 60 },
      { id: '2', input_text: '1 1\n3\n0 0 1', expected_output: '1 0 1', is_hidden: false, marks: 40 },
    ],
  },
  {
    id: 'ch-fullstack-2',
    title: 'Event Loop Simulator: Microtask Priority Engine',
    difficulty: 'Medium',
    xp: 150,
    topic: 'Full-Stack Systems (Async Event Loop)',
    sectorId: 'sector-fullstack',
    sectorName: 'Full-Stack & Distributed Architecture',
    sectorBadge: '🌐 Sector 5 · Set B',
    sectorColor: '#F43F5E',
    description: `Given a sequence of task declarations: S (synchronous execution), M (microtask promise), and T (macrotask timer), output the execution ordering IDs according to modern JavaScript/Node.js event loop semantics.\n\nInput:\nLine 1: N\nNext N lines: TYPE ID (e.g., T 1, S 2, M 3)\n\nExample:\nInput:\n3\nT 1\nS 2\nM 3\nOutput:\n2 3 1`,
    starterCode: `import sys

def event_loop():
    lines = sys.stdin.read().splitlines()
    if not lines:
        return
    n = int(lines[0].strip())
    sync_tasks, micro_tasks, macro_tasks = [], [], []
    for i in range(1, n + 1):
        t_type, t_id = lines[i].split()
        if t_type == 'S':
            sync_tasks.append(t_id)
        elif t_type == 'M':
            micro_tasks.append(t_id)
        else:
            macro_tasks.append(t_id)
    ordered = sync_tasks + micro_tasks + macro_tasks
    print(" ".join(ordered))

if __name__ == '__main__':
    event_loop()
`,
    testCases: [
      { id: '1', input_text: '3\nT 1\nS 2\nM 3', expected_output: '2 3 1', is_hidden: false, marks: 50 },
      { id: '2', input_text: '4\nM 4\nT 1\nS 5\nT 2', expected_output: '5 4 1 2', is_hidden: false, marks: 30 },
      { id: '3', input_text: '2\nT 9\nM 8', expected_output: '8 9', is_hidden: true, marks: 20 },
    ],
  },
  {
    id: 'ch-fullstack-3',
    title: 'Cache Invalidation: LRU Buffer Eviction',
    difficulty: 'Hard',
    xp: 190,
    topic: 'Full-Stack Systems (In-Memory Key-Value Eviction)',
    sectorId: 'sector-fullstack',
    sectorName: 'Full-Stack & Distributed Architecture',
    sectorBadge: '🌐 Sector 5 · Set C',
    sectorColor: '#F43F5E',
    description: `Given cache capacity C and a sequence of key GET / PUT operations, output the value returned by each GET operation (or -1 if missing).\n\nInput:\nLine 1: Capacity C and total Ops Q\nNext Q lines: 'PUT K V' or 'GET K'\n\nExample:\nInput:\n2 4\nPUT 1 10\nPUT 2 20\nGET 1\nGET 3\nOutput:\n10 -1`,
    starterCode: `import sys
from collections import OrderedDict

def lru_cache_sim():
    lines = sys.stdin.read().splitlines()
    if not lines:
        return
    cap, q = [int(x) for x in lines[0].split()]
    cache = OrderedDict()
    outputs = []
    
    for i in range(1, q + 1):
        parts = lines[i].split()
        op = parts[0]
        k = int(parts[1])
        if op == 'GET':
            if k in cache:
                cache.move_to_end(k)
                outputs.append(str(cache[k]))
            else:
                outputs.append("-1")
        elif op == 'PUT':
            v = int(parts[2])
            if k in cache:
                cache.move_to_end(k)
            cache[k] = v
            if len(cache) > cap:
                cache.popitem(last=False)
                
    print(" ".join(outputs))

if __name__ == '__main__':
    lru_cache_sim()
`,
    testCases: [
      { id: '1', input_text: '2 4\nPUT 1 10\nPUT 2 20\nGET 1\nGET 3', expected_output: '10 -1', is_hidden: false, marks: 50 },
      { id: '2', input_text: '1 3\nPUT 1 5\nPUT 2 8\nGET 1', expected_output: '-1', is_hidden: false, marks: 30 },
      { id: '3', input_text: '2 5\nPUT 1 1\nPUT 2 2\nGET 1\nPUT 3 3\nGET 2', expected_output: '1 -1', is_hidden: true, marks: 20 },
    ],
  },
];

export default function PracticeArenaPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // If navigated from 3D galaxy or student dashboard with state
  const initialSectorId = (location.state as { selectedSectorId?: string } | null)?.selectedSectorId || 'all';

  const [sectorFilter, setSectorFilter] = useState<string>(initialSectorId);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge>(() => {
    if (initialSectorId && initialSectorId !== 'all') {
      const match = DAILY_CHALLENGES.find((ch) => ch.sectorId === initialSectorId);
      if (match) return match;
    }
    return DAILY_CHALLENGES[0];
  });
  const [streakDays, setStreakDays] = useState(7);
  const [xp, setXp] = useState(1450);
  const [solvedCount, setSolvedCount] = useState(2);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'coding' | 'blitz' | 'sectors'>('coding');
  const [xpBanner, setXpBanner] = useState<string | null>(null);

  const [studentUser, setStudentUser] = useState<any>(null);

  // Sync sector filter & challenge selection when initialSectorId changes from route navigation
  useEffect(() => {
    if (initialSectorId && initialSectorId !== 'all') {
      setSectorFilter(initialSectorId);
      const match = DAILY_CHALLENGES.find((ch) => ch.sectorId === initialSectorId);
      if (match) setSelectedChallenge(match);
    }
  }, [initialSectorId]);

  // Resilient Student Authentication Gate
  useEffect(() => {
    const token = localStorage.getItem('student_token');
    const userStr = localStorage.getItem('student_user');
    const attemptStr = localStorage.getItem('logicwhilelire_attempt') || localStorage.getItem('lw_attempt');

    if (!token && !userStr && !attemptStr) {
      navigate('/login?redirect=/practice&notice=student_login_required');
      return;
    }

    if (userStr) {
      try {
        setStudentUser(JSON.parse(userStr));
      } catch {
        setStudentUser(null);
      }
    } else if (attemptStr) {
      try {
        const att = JSON.parse(attemptStr);
        const synthUser = {
          id: 'stu-current',
          name: att.studentName || 'Student Candidate',
          first_name: (att.studentName || 'Student').split(' ')[0],
          last_name: (att.studentName || '').split(' ')[1] || '',
          roll_number: att.hallTicket || '24VR1A0501',
          hall_ticket: att.hallTicket || '24VR1A0501',
          branch_code: 'CSE',
          section: 'A',
          section_id: 'sec-cse-a',
          college_id: 1,
          college_name: att.collegeName || '',
        };
        localStorage.setItem('student_user', JSON.stringify(synthUser));
        if (!token) localStorage.setItem('student_token', `token-roster-${att.hallTicket || '24VR1A0501'}`);
        setStudentUser(synthUser);
      } catch {
        setStudentUser({ name: 'Student Candidate', roll_number: '24VR1A0501', section: 'A' });
      }
    } else if (token) {
      setStudentUser({ name: 'Student Candidate', roll_number: '24VR1A0501', section: 'A' });
    }
  }, [navigate]);

  // Filtered challenges based on sector
  const filteredChallenges = DAILY_CHALLENGES.filter((ch) =>
    sectorFilter === 'all' ? true : ch.sectorId === sectorFilter
  );

  // Quick Blitz Mode State
  const [blitzScore, setBlitzScore] = useState(0);
  const [blitzTimer, setBlitzTimer] = useState(60);
  const [blitzActive, setBlitzActive] = useState(false);
  const [blitzIndex, setBlitzIndex] = useState(0);

  const BLITZ_QUESTIONS = [
    { q: 'Which data structure enforces LIFO behavior?', opts: ['Queue', 'Stack', 'Heap', 'Tree'], ans: 1, sector: 'Sector 4: DSA' },
    { q: 'Time complexity of Binary Search on sorted array?', opts: ['O(N)', 'O(1)', 'O(log N)', 'O(N²)'], ans: 2, sector: 'Sector 4: DSA' },
    { q: 'Which protocol is connectionless and header-light?', opts: ['TCP', 'UDP', 'HTTP', 'FTP'], ans: 1, sector: 'Sector 3: Core CS' },
    { q: 'What does ACID stand for in Database Systems?', opts: ['Atomicity, Consistency, Isolation, Durability', 'Active, Concurrent, Indexed, Distributed', 'Asynchronous, Clustered, Integrated, Durable', 'Autonomous, Centralized, Immutable, Deterministic'], ans: 0, sector: 'Sector 3: Core CS' },
    { q: 'In Node.js event loop, where does setImmediate() run?', opts: ['Timers Phase', 'Poll Phase', 'Check Phase', 'Close Phase'], ans: 2, sector: 'Sector 5: Full-Stack' },
    { q: 'If two trains move towards each other at 40 km/h and 60 km/h, relative speed is:', opts: ['20 km/h', '100 km/h', '50 km/h', '2400 km/h'], ans: 1, sector: 'Sector 1: Quant' },
    { q: 'All Bloops are Razzies. All Razzies are Lizzies. Are all Bloops Lizzies?', opts: ['Definitely True', 'Definitely False', 'Cannot be determined', 'True only if Razzies are Bloops'], ans: 0, sector: 'Sector 2: Logic' },
    { q: 'Which HTTP status code indicates "Rate Limited / Too Many Requests"?', opts: ['400', '403', '429', '503'], ans: 2, sector: 'Sector 5: Full-Stack' },
    { q: 'What is the worst-case time complexity of QuickSort?', opts: ['O(N log N)', 'O(N²)', 'O(N)', 'O(log N)'], ans: 1, sector: 'Sector 4: DSA' },
    { q: 'Two unbiased dice are rolled. What is the probability of rolling a sum of 7?', opts: ['1/6', '7/36', '1/12', '5/36'], ans: 0, sector: 'Sector 1: Quant' },
  ];

  // Dynamic 3D Radar scores reflecting sector engagement
  const liveRadarScores: SectorScore[] = [
    { sector: 'Quantitative Aptitude', short: 'Quant', score: 86 + (solvedCount > 0 ? 4 : 0), benchmark: 72, color: '#F59E0B' },
    { sector: 'Logical Reasoning', short: 'Logic', score: 92, benchmark: 76, color: '#8B5CF6' },
    { sector: 'Core Computer Science', short: 'Core CS', score: 79 + (solvedCount > 1 ? 6 : 0), benchmark: 68, color: '#10B981' },
    { sector: 'Data Structures & Algorithms', short: 'DSA', score: 84 + (solvedCount > 2 ? 5 : 0), benchmark: 64, color: '#38BDF8' },
    { sector: 'Full-Stack & System Design', short: 'Full-Stack', score: 88, benchmark: 71, color: '#F43F5E' },
  ];

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Blitz countdown
  useEffect(() => {
    let t: any;
    if (blitzActive && blitzTimer > 0) {
      t = setInterval(() => setBlitzTimer((prev) => prev - 1), 1000);
    } else if (blitzTimer === 0 && blitzActive) {
      setBlitzActive(false);
    }
    return () => clearInterval(t);
  }, [blitzActive, blitzTimer]);

  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    } else {
      alert('To install LogicWhileLiRE: Click browser menu (⋮ or share) -> "Install App" or "Add to Home Screen"');
    }
  };

  const handleTestPass = (earnedScore: number, maxScore: number) => {
    if (earnedScore === maxScore) {
      setXp((prev) => prev + selectedChallenge.xp);
      setSolvedCount((prev) => prev + 1);
      setXpBanner(`🎉 Sector Challenge Solved! +${selectedChallenge.xp} XP credited to your ${selectedChallenge.sectorName} mastery profile!`);
      setTimeout(() => setXpBanner(null), 5000);
    }
  };

  const handleBlitzAnswer = (idx: number) => {
    const isCorrect = idx === BLITZ_QUESTIONS[blitzIndex].ans;
    if (isCorrect) setBlitzScore((p) => p + 20);

    if (blitzIndex < BLITZ_QUESTIONS.length - 1) {
      setBlitzIndex((p) => p + 1);
    } else {
      setBlitzActive(false);
      setXp((p) => p + blitzScore + 50);
      setXpBanner(`⚡ Blitz Completed! Final Score: ${blitzScore + (idx === BLITZ_QUESTIONS[blitzIndex].ans ? 20 : 0)}/100 (+50 Bonus XP)`);
      setTimeout(() => setXpBanner(null), 5000);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse 90% 60% at 50% -10%, #0d1b3e 0%, #050814 100%)',
        fontFamily: "'Inter', sans-serif",
        color: '#F0F4FF',
        position: 'relative',
      }}
    >
      {/* Background Flight Paths */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.45 }}>
        <FlightPathLines />
      </div>

      <SiteHeader />

      <main style={{ maxWidth: 1260, margin: '0 auto', padding: '32px 20px 80px', position: 'relative', zIndex: 1 }}>
        {/* XP Toast Notification */}
        <AnimatePresence>
          {xpBanner && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              style={{
                background: 'linear-gradient(90deg, #10B981, #2B7FFF)',
                color: '#fff',
                padding: '14px 24px',
                borderRadius: 12,
                fontWeight: 700,
                textAlign: 'center',
                marginBottom: 24,
                boxShadow: '0 10px 30px rgba(16, 185, 129, 0.4)',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {xpBanner}
            </motion.div>
          )}
        </AnimatePresence>

        {/* STUDENT AUTHENTICATED BADGE */}
        {studentUser && (
          <div
            style={{
              background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.12), rgba(56, 189, 248, 0.12))',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 14,
              padding: '12px 20px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.4rem' }}>🎓</span>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#34D399', letterSpacing: '0.04em' }}>
                  STUDENT PORTAL CLEARANCE VERIFIED: 5 SECTORS ACTIVE
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                  Candidate: <strong style={{ color: '#F1F5F9' }}>{studentUser.name || 'Student'}</strong> &bull; Hall Ticket: <code style={{ color: '#38BDF8' }}>{studentUser.roll_number || studentUser.hall_ticket || 'HT-2026'}</code> &bull; Section {studentUser.section || 'A'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => navigate('/student/dashboard')}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#CBD5E1',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>📊</span> My Dashboard
              </button>
            </div>
          </div>
        )}

        {/* HERO / GAMIFICATION DASHBOARD BAR */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(43, 127, 255, 0.25)',
            borderRadius: 20,
            padding: '24px 28px',
            marginBottom: 32,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
            alignItems: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          }}
        >
          {/* Daily Streak */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(249, 115, 22, 0.2))',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)',
              }}
            >
              🔥
            </div>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#F87171', fontFamily: "'Space Grotesk', sans-serif" }}>
                {streakDays} Days Streak
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                Streak Shield Active • Daily Goal: 3 Problems
              </div>
            </div>
          </div>

          {/* XP & Level */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(43, 127, 255, 0.2), rgba(168, 85, 247, 0.2))',
                border: '1px solid rgba(43, 127, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                boxShadow: '0 0 20px rgba(43, 127, 255, 0.3)',
              }}
            >
              ⚡
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#60A5FA', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {xp.toLocaleString()} XP
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A78BFA' }}>
                  Lvl 8 Architect
                </span>
              </div>
              <div style={{ width: '100%', height: 6, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 999, marginTop: 4, overflow: 'hidden' }}>
                <div style={{ width: '74%', height: '100%', background: 'linear-gradient(90deg, #2B7FFF, #A78BFA)', borderRadius: 999 }} />
              </div>
            </div>
          </div>

          {/* Daily Retention Progress & PWA Button */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34D399' }}>
                {solvedCount}/3 Daily Sprints
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                +150 XP on completion
              </div>
            </div>

            <button
              onClick={handleInstallClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 10,
                background: 'rgba(43, 127, 255, 0.15)',
                border: '1px solid rgba(43, 127, 255, 0.35)',
                color: '#60A5FA',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span>📱</span> Install PWA App
            </button>
          </div>
        </div>

        {/* ARENA MODE SWITCHER TABS */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('coding')}
            style={{
              background: activeTab === 'coding' ? 'rgba(43, 127, 255, 0.2)' : 'transparent',
              border: activeTab === 'coding' ? '1px solid #2B7FFF' : '1px solid transparent',
              color: activeTab === 'coding' ? '#60A5FA' : '#94A3B8',
              borderRadius: 8,
              padding: '8px 20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <span>💻</span> Sector Code Sprints
          </button>

          <button
            onClick={() => setActiveTab('sectors')}
            style={{
              background: activeTab === 'sectors' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              border: activeTab === 'sectors' ? '1px solid #38BDF8' : '1px solid transparent',
              color: activeTab === 'sectors' ? '#38BDF8' : '#94A3B8',
              borderRadius: 8,
              padding: '8px 20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <span>🪐</span> 3D Technical Sectors Hub
          </button>

          <button
            onClick={() => setActiveTab('blitz')}
            style={{
              background: activeTab === 'blitz' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              border: activeTab === 'blitz' ? '1px solid #EF4444' : '1px solid transparent',
              color: activeTab === 'blitz' ? '#F87171' : '#94A3B8',
              borderRadius: 8,
              padding: '8px 20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <span>⚡</span> 60-Sec Quiz Blitz
          </button>
        </div>

        {/* ── TAB 1: CODING ARENA WITH SECTOR FILTER & 3D RADAR ── */}
        {activeTab === 'coding' && (
          <div>
            {/* Sector Quick Filter Toolbar */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 20 }}>
              {SECTOR_CATEGORIES.map((sec) => {
                const isActive = sectorFilter === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      setSectorFilter(sec.id);
                      const matching = DAILY_CHALLENGES.find((c) => sec.id === 'all' || c.sectorId === sec.id);
                      if (matching) setSelectedChallenge(matching);
                    }}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 999,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: isActive ? `1.5px solid ${sec.color || '#38BDF8'}` : '1px solid rgba(255, 255, 255, 0.1)',
                      background: isActive ? `${sec.color || '#38BDF8'}25` : 'rgba(15, 23, 42, 0.6)',
                      color: isActive ? (sec.color || '#38BDF8') : '#94A3B8',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? `0 0 16px ${sec.color || '#38BDF8'}33` : 'none',
                    }}
                  >
                    <span>{sec.icon}</span>
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="arena-main-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 390px) 1fr', gap: 24 }}>
              {/* Left Column: Challenge Selector & 3D Radar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Daily Challenge List */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(43, 127, 255, 0.2)',
                    borderRadius: 16,
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#60A5FA', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Sector Practice Sprints
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                      {filteredChallenges.length} Available
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredChallenges.map((ch) => {
                      const isSelected = selectedChallenge.id === ch.id;
                      return (
                        <div
                          key={ch.id}
                          onClick={() => setSelectedChallenge(ch)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: isSelected ? 'rgba(43, 127, 255, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${isSelected ? ch.sectorColor : 'rgba(255, 255, 255, 0.06)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: ch.sectorColor }}>
                              {ch.sectorBadge}
                            </span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: ch.difficulty === 'Easy' ? 'rgba(16, 185, 129, 0.2)' : ch.difficulty === 'Medium' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: ch.difficulty === 'Easy' ? '#34D399' : ch.difficulty === 'Medium' ? '#FBBF24' : '#F87171',
                              }}
                            >
                              {ch.difficulty}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: isSelected ? '#FFFFFF' : '#E2E8F0', marginBottom: 4 }}>
                            {ch.title}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#64748B' }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{ch.topic}</span>
                            <span style={{ color: '#A78BFA', fontWeight: 700 }}>+{ch.xp} XP</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3D Technical Competency Radar */}
                <SectorRadar3D scores={liveRadarScores} width={340} height={280} />
              </div>

              {/* Right Column: Interactive Code Editor Hologram */}
              <div>
                <CodeEditorHolo
                  challengeTitle={`${selectedChallenge.sectorBadge}: ${selectedChallenge.title}`}
                  starterCode={selectedChallenge.starterCode}
                  language="python"
                  testCases={selectedChallenge.testCases}
                  onTestPass={handleTestPass}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: FULL 3D SECTORS UNIVERSE ── */}
        {activeTab === 'sectors' && (
          <div style={{ marginTop: 12 }}>
            <SectorsUniverse3D
              onSelectSector={(sector) => {
                const match = DAILY_CHALLENGES.find((c) => c.sectorId === sector.id);
                if (match) {
                  setSelectedChallenge(match);
                  setSectorFilter(sector.id);
                  setActiveTab('coding');
                }
              }}
            />
          </div>
        )}

        {/* ── TAB 3: 60-SEC QUIZ BLITZ ── */}
        {activeTab === 'blitz' && (
          <div style={{ maxWidth: 640, margin: '0 auto', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 20, padding: '36px 32px', textAlign: 'center' }}>
            {!blitzActive && blitzScore === 0 ? (
              <div>
                <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>⚡</div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', margin: '0 0 10px', fontFamily: "'Space Grotesk', sans-serif" }}>
                  60-Second Sector Rapid Sprint
                </h2>
                <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 28 }}>
                  Rapid-fire questions sampled across all 5 technical sectors. Test speed, analytical reflexes, and earn bonus XP!
                </p>
                <button
                  onClick={() => {
                    setBlitzActive(true);
                    setBlitzTimer(45);
                    setBlitzScore(0);
                    setBlitzIndex(0);
                  }}
                  style={{
                    padding: '14px 32px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #EF4444, #F59E0B)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
                  }}
                >
                  🚀 Start 45-Sec Sprint
                </button>
              </div>
            ) : blitzActive ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 700 }}>
                      Question {blitzIndex + 1}/{BLITZ_QUESTIONS.length}
                    </span>
                    {BLITZ_QUESTIONS[blitzIndex]?.sector && (
                      <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38BDF8', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                        {BLITZ_QUESTIONS[blitzIndex].sector}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '1.2rem', fontWeight: 900, color: blitzTimer <= 10 ? '#EF4444' : '#F59E0B', fontFamily: 'monospace' }}>
                    ⏱ {blitzTimer}s
                  </span>
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC', marginBottom: 28, lineHeight: 1.5 }}>
                  {BLITZ_QUESTIONS[blitzIndex].q}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {BLITZ_QUESTIONS[blitzIndex].opts.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleBlitzAnswer(i)}
                      style={{
                        padding: '14px 18px',
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#E2E8F0',
                        fontSize: '0.92rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏆</div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', margin: '0 0 8px', fontFamily: "'Space Grotesk', sans-serif" }}>
                  Sector Sprint Complete!
                </h2>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#34D399', margin: '16px 0', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {blitzScore}/100 Points
                </div>
                <p style={{ color: '#94A3B8', fontSize: '0.92rem', marginBottom: 28 }}>
                  +50 XP Bonus credited! Your multi-sector analytical reflexes have been recorded.
                </p>
                <button
                  onClick={() => {
                    setBlitzIndex(0);
                    setBlitzTimer(45);
                    setBlitzScore(0);
                    setBlitzActive(false);
                  }}
                  style={{
                    padding: '12px 28px',
                    borderRadius: 10,
                    background: '#2B7FFF',
                    border: 'none',
                    color: '#fff',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Play Again
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
