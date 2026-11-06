const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), 'Quiz/server/.env'),
  path.resolve(process.cwd(), '.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
    break;
  }
}

const supabaseUrl = process.env.SUPABASE_URL || 'https://xhutjekdbyccscselzdy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Complete 36-Question Curriculum derived from RVIT Full Stack Development - 2 Lab Manual
const fsd2Questions = [
  // Experiment 1: Express JS - Routing, HTTP Methods, Middleware
  {
    question: "In Express.js, what is the correct syntax to read a route parameter from a URL defined as '/student/:id'?",
    option_a: "req.params.id",
    option_b: "req.query.id",
    option_c: "req.body.id",
    option_d: "req.route.id",
    correct_answer: "A",
    topic: "Express Routing & Params",
    section: "Experiment 1(a)",
    difficulty: "Easy",
  },
  {
    question: "Which Express.js method and HTTP status code should be used when a new resource is successfully created via a POST endpoint?",
    option_a: "res.send(data) with status 200",
    option_b: "res.status(201).json(data)",
    option_c: "res.status(204).send()",
    option_d: "res.status(301).json(data)",
    correct_answer: "B",
    topic: "RESTful HTTP Methods",
    section: "Experiment 1(b)",
    difficulty: "Medium",
  },
  {
    question: "In an Express middleware function with signature (req, res, next), what happens if you omit the call to next() and do not send a response?",
    option_a: "Express automatically returns a 404 Not Found error",
    option_b: "The next matching route handler executes immediately",
    option_c: "The request hangs and will eventually time out",
    option_d: "Express automatically restarts the server process",
    correct_answer: "C",
    topic: "Express Middleware",
    section: "Experiment 1(c)",
    difficulty: "Medium",
  },

  // Experiment 2: Express JS - Templating, Form Data
  {
    question: "Which template tag in EJS is used to output the unescaped or escaped evaluated value of a variable into the HTML document (e.g., displaying <%= name %>)?",
    option_a: "<% name %>",
    option_b: "<%= name %>",
    option_c: "<%# name %>",
    option_d: "<%-# name %>",
    correct_answer: "B",
    topic: "EJS Templating",
    section: "Experiment 2(a)",
    difficulty: "Easy",
  },
  {
    question: "Which built-in middleware is required in Express 4.16+ to parse incoming URL-encoded form submissions (e.g. from an HTML <form>)?",
    option_a: "express.json()",
    option_b: "express.urlencoded({ extended: true })",
    option_c: "bodyParser.raw()",
    option_d: "express.formData()",
    correct_answer: "B",
    topic: "Form Data Parsing",
    section: "Experiment 2(b)",
    difficulty: "Easy",
  },
  {
    question: "When parsing a POST form with action='/submit', where does Express store the parsed key-value pairs of the form inputs?",
    option_a: "req.query",
    option_b: "req.params",
    option_c: "req.body",
    option_d: "req.payload",
    correct_answer: "C",
    topic: "Form Data Parsing",
    section: "Experiment 2(b)",
    difficulty: "Easy",
  },

  // Experiment 3: Express JS - Cookies, Sessions, Authentication
  {
    question: "Why should the { httpOnly: true } option always be set when writing sensitive authentication cookies via res.cookie()?",
    option_a: "It compresses the cookie payload to minimize network bandwidth",
    option_b: "It prevents client-side JavaScript (e.g. XSS attacks) from accessing document.cookie",
    option_c: "It encrypts the cookie using RSA public-key cryptography",
    option_d: "It forces the cookie to expire immediately upon closing the browser tab",
    correct_answer: "B",
    topic: "Session Security & Cookies",
    section: "Experiment 3(a)",
    difficulty: "Hard",
  },
  {
    question: "In express-session, which method is called to completely terminate a logged-in user's session and clear their session store entry upon logout?",
    option_a: "req.session.clear()",
    option_b: "req.session.destroy(callback)",
    option_c: "res.clearSession()",
    option_d: "delete req.session",
    correct_answer: "B",
    topic: "User Authentication",
    section: "Experiment 3(b)",
    difficulty: "Medium",
  },
  {
    question: "Which HTTP status code is universally returned by an authentication endpoint when an unauthenticated client attempts to access a protected /profile route?",
    option_a: "400 Bad Request",
    option_b: "401 Unauthorized",
    option_c: "403 Forbidden",
    option_d: "405 Method Not Allowed",
    correct_answer: "B",
    topic: "User Authentication",
    section: "Experiment 3(b)",
    difficulty: "Easy",
  },

  // Experiment 4: Express JS - Database, RESTful APIs
  {
    question: "In Mongoose, which method finds a document by its primary key ID, applies updates from req.body, and returns the modified document when { new: true } is supplied?",
    option_a: "Student.updateOneById()",
    option_b: "Student.findByIdAndUpdate(id, update, { new: true })",
    option_c: "Student.findAndModify()",
    option_d: "Student.updateWhereId()",
    correct_answer: "B",
    topic: "Mongoose CRUD",
    section: "Experiment 4(a)",
    difficulty: "Medium",
  },
  {
    question: "In a Single Page Application (SPA), what JavaScript API is typically used by client-side code to asynchronously load student data from GET /students without a full page reload?",
    option_a: "document.write()",
    option_b: "window.location.replace()",
    option_c: "window.fetch() or axios",
    option_d: "navigator.sendBeacon()",
    correct_answer: "C",
    topic: "RESTful SPA",
    section: "Experiment 4(b)",
    difficulty: "Easy",
  },
  {
    question: "If your Single Page Application frontend runs on http://localhost:5173 and your Express API runs on http://localhost:3000, which HTTP header must the API send to allow browser requests?",
    option_a: "X-Forwarded-Host: *",
    option_b: "Access-Control-Allow-Origin: http://localhost:5173",
    option_c: "Content-Security-Policy: sandbox",
    option_d: "Strict-Transport-Security: max-age=3600",
    correct_answer: "B",
    topic: "CORS & REST",
    section: "Experiment 4(b)",
    difficulty: "Medium",
  },

  // Experiment 5: React JS - Render HTML, JSX, Components
  {
    question: "In React 18 / 19, what is the root entry file where the default export App component is typically defined in a modern Vite React application?",
    option_a: "public/index.html",
    option_b: "src/App.jsx (or src/App.tsx)",
    option_c: "package.json",
    option_d: "vite.config.js",
    correct_answer: "B",
    topic: "React Architecture",
    section: "Experiment 5(a)",
    difficulty: "Easy",
  },
  {
    question: "In JSX syntax, how are dynamic JavaScript expressions (such as mathematical addition 2 + 3 or variable interpolation) embedded inside HTML tags?",
    option_a: "Enclosed in double curly braces: {{ 2 + 3 }}",
    option_b: "Enclosed in single curly braces: { 2 + 3 }",
    option_c: "Enclosed in PHP tags: <? 2 + 3 ?>",
    option_d: "Enclosed in template syntax: <%= 2 + 3 %>",
    correct_answer: "B",
    topic: "JSX Expressions",
    section: "Experiment 5(b)",
    difficulty: "Easy",
  },
  {
    question: "Which of the following is the valid syntax to define a Class component in React that renders a footer element?",
    option_a: "class Footer { render() { return <footer>RVIT</footer>; } }",
    option_b: "class Footer extends React.Component { render() { return <footer>RVIT</footer>; } }",
    option_c: "function class Footer() { return <footer>RVIT</footer>; }",
    option_d: "React.createClassComponent('Footer', () => <footer>RVIT</footer>)",
    correct_answer: "B",
    topic: "React Components",
    section: "Experiment 5(c)",
    difficulty: "Medium",
  },

  // Experiment 6: React JS - Props, States, Styles, Events
  {
    question: "What is the primary difference between Props and State in React?",
    option_a: "Props are mutable by the receiving component, while State is read-only",
    option_b: "Props are passed from parent to child (read-only), while State is managed internally and triggers re-renders when updated",
    option_c: "Props can only store strings, while State can store objects",
    option_d: "Props can only be used in class components, while State is exclusive to hooks",
    correct_answer: "B",
    topic: "Props vs State",
    section: "Experiment 6(a)",
    difficulty: "Medium",
  },
  {
    question: "When applying external CSS classes to an HTML element in JSX (e.g. in App.jsx with App.css), which attribute name must be used instead of 'class'?",
    option_a: "classId",
    option_b: "className",
    option_c: "styleClass",
    option_d: "cssName",
    correct_answer: "B",
    topic: "React Styling",
    section: "Experiment 6(b)",
    difficulty: "Easy",
  },
  {
    question: "What is the correct syntax to attach a click event listener in React that executes showMessage() when a button is clicked?",
    option_a: "<button onclick='showMessage()'>Click</button>",
    option_b: "<button onClick={showMessage}>Click</button>",
    option_c: "<button on-click={showMessage()}>Click</button>",
    option_d: "<button bind:click={showMessage}>Click</button>",
    correct_answer: "B",
    topic: "React Events",
    section: "Experiment 6(c)",
    difficulty: "Easy",
  },

  // Experiment 7: React JS - Conditional Rendering, Lists, Forms
  {
    question: "Which JavaScript operator is most commonly used in JSX for inline conditional rendering between two mutually exclusive views (e.g. Welcome back vs Please log in)?",
    option_a: "Bitwise OR (|)",
    option_b: "Ternary operator (? :)",
    option_c: "Nullish coalescing (??)",
    option_d: "Spread operator (...)",
    correct_answer: "B",
    topic: "Conditional Rendering",
    section: "Experiment 7(a)",
    difficulty: "Easy",
  },
  {
    question: "When transforming an array of subjects using subjects.map(s => <li key={s}>{s}</li>), why does React require the unique 'key' prop on each rendered list element?",
    option_a: "It gives CSS a reference selector to style the list item",
    option_b: "It helps React identify which items have changed, been added, or removed during Reconciliation",
    option_c: "It serializes the list item for server-side transmission",
    option_d: "It forces the browser to re-download the component bundle",
    correct_answer: "B",
    topic: "React Lists & Keys",
    section: "Experiment 7(b)",
    difficulty: "Hard",
  },
  {
    question: "In a React Controlled Component form, what two attributes link a form input state to its component lifecycle?",
    option_a: "defaultText and onBlur",
    option_b: "value={state} and onChange={e => setState(e.target.value)}",
    option_c: "ref={inputRef} and onKeyDown",
    option_d: "data-bind and onInput",
    correct_answer: "B",
    topic: "Controlled Forms",
    section: "Experiment 7(c)",
    difficulty: "Medium",
  },

  // Experiment 8: React JS - React Router, Updating Screen
  {
    question: "In React Router v6, which component replaces the legacy <Switch> component to wrap all individual <Route> elements?",
    option_a: "<RouteGroup>",
    option_b: "<Routes>",
    option_c: "<RouterSwitch>",
    option_d: "<PageNavigator>",
    correct_answer: "B",
    topic: "React Router v6",
    section: "Experiment 8(a)",
    difficulty: "Medium",
  },
  {
    question: "Which component in React Router should be used for client-side navigation links instead of standard HTML <a href='...'> to prevent full page reloads?",
    option_a: "<Anchor>",
    option_b: "<Link to='/path'>",
    option_c: "<Redirect>",
    option_d: "<NavLink target='_self'>",
    correct_answer: "B",
    topic: "React Router",
    section: "Experiment 8(a)",
    difficulty: "Easy",
  },
  {
    question: "In React, when setMessage('Screen updated!') is called from a button handler, what mechanism does React invoke to update the DOM?",
    option_a: "Direct document.getElementById innerHTML replacement",
    option_b: "Scheduling a re-render of the component and updating the Virtual DOM diff",
    option_c: "Browser reload via window.location.reload()",
    option_d: "WebSocket push to the Node.js backend",
    correct_answer: "B",
    topic: "State & Re-renders",
    section: "Experiment 8(b)",
    difficulty: "Medium",
  },

  // Experiment 9: React JS - Hooks, Sharing Data Between Components
  {
    question: "Which hook is used to create and consume global or multi-component shared state across deeply nested components without manual prop-drilling?",
    option_a: "useReducer and useMemo",
    option_b: "createContext and useContext",
    option_c: "useRef and useEffect",
    option_d: "useCallback and useLayoutEffect",
    correct_answer: "B",
    topic: "Context API",
    section: "Experiment 9(b)",
    difficulty: "Medium",
  },
  {
    question: "What is the primary constraint enforced by the Rules of Hooks in React?",
    option_a: "Hooks must only be called inside asynchronous async/await functions",
    option_b: "Hooks must only be called at the top level of React function components, never inside loops, conditions, or nested functions",
    option_c: "Hooks can only be used if Redux is installed in the project",
    option_d: "Hooks must always return a JSX element",
    correct_answer: "B",
    topic: "Rules of Hooks",
    section: "Experiment 9(a)",
    difficulty: "Hard",
  },
  {
    question: "When initializing state with const [count, setCount] = useState(0), what is the purpose of the setter function setCount?",
    option_a: "It directly mutates count = newCount in synchronous memory",
    option_b: "It schedules a state update and queues a component re-render with the new count value",
    option_c: "It writes count directly into the browser's localStorage",
    option_d: "It validates that count is an integer",
    correct_answer: "B",
    topic: "useState Lifecycle",
    section: "Experiment 9(a)",
    difficulty: "Easy",
  },

  // Experiment 10: MongoDB - Installation, Configuration, CRUD
  {
    question: "In modern MongoDB (mongosh / Node.js driver), which method has superseded the legacy db.collection.remove() to delete a single matching document?",
    option_a: "db.collection.eraseOne()",
    option_b: "db.collection.deleteOne()",
    option_c: "db.collection.dropOne()",
    option_d: "db.collection.purgeOne()",
    correct_answer: "B",
    topic: "MongoDB CRUD",
    section: "Experiment 10(b)",
    difficulty: "Easy",
  },
  {
    question: "Which update operator in MongoDB is used to modify the value of a specific field (e.g. updating branch from 'CSE' to 'IT') without replacing the entire document?",
    option_a: "$replace",
    option_b: "$set",
    option_c: "$modify",
    option_d: "$alter",
    correct_answer: "B",
    topic: "MongoDB Update Operators",
    section: "Experiment 10(b)",
    difficulty: "Easy",
  },
  {
    question: "What environment variable is universally configured in Node.js applications to store the MongoDB Atlas cluster or local MongoDB connection string?",
    option_a: "DATABASE_SECRET",
    option_b: "MONGODB_URI",
    option_c: "MONGO_SOCKET",
    option_d: "DB_DRIVER_PATH",
    correct_answer: "B",
    topic: "MongoDB Configuration",
    section: "Experiment 10(a)",
    difficulty: "Easy",
  },

  // Experiment 11: MongoDB - Databases, Collections and Records
  {
    question: "In mongosh, what command is executed to list all existing collections present inside the currently selected database?",
    option_a: "list collections",
    option_b: "show collections",
    option_c: "get all tables",
    option_d: "db.collections.all()",
    correct_answer: "B",
    topic: "MongoDB Collections",
    section: "Experiment 11(a)",
    difficulty: "Easy",
  },
  {
    question: "Which MongoDB query method chain correctly sorts students in descending order of marks (-1) and limits the output to at most 5 documents?",
    option_a: "db.students.find().sort({ marks: -1 }).limit(5)",
    option_b: "db.students.find().limit(5).order({ marks: 'DESC' })",
    option_c: "db.students.select().sortDescending('marks').top(5)",
    option_d: "db.students.find({ $order: 'marks DESC', $limit: 5 })",
    correct_answer: "A",
    topic: "MongoDB Query Operations",
    section: "Experiment 11(b)",
    difficulty: "Medium",
  },
  {
    question: "In the MongoDB Aggregation Pipeline, which stage operator groups documents by an expression (_id: '$branch') to compute accumulated values like average marks?",
    option_a: "$match",
    option_b: "$group",
    option_c: "$project",
    option_d: "$unwind",
    correct_answer: "B",
    topic: "MongoDB Aggregation Pipeline",
    section: "Experiment 11(b)",
    difficulty: "Hard",
  },

  // Experiment 12: Augmented Programs
  {
    question: "In an Express.js in-memory To-do list application, what is the best-practice pattern to follow immediately after pushing a new task in app.post('/add')?",
    option_a: "Call res.send() with the raw memory array",
    option_b: "Execute Post/Redirect/Get by calling res.redirect('/') to prevent duplicate submissions on browser refresh",
    option_c: "Terminate the Express process using process.exit(0)",
    option_d: "Wait 5000ms using setTimeout before sending response",
    correct_answer: "B",
    topic: "Post/Redirect/Get Pattern",
    section: "Experiment 12(a)",
    difficulty: "Medium",
  },
  {
    question: "In a React Quiz application, how is the candidate's final score typically computed when an option button is selected?",
    option_a: "Directly writing the score to the browser cookie",
    option_b: "Checking if selectedOption === currentQuestion.correctAnswer, updating score via setScore(prev => prev + 1), and advancing the question index",
    option_c: "Sending an HTTP POST to MongoDB on every single option click",
    option_d: "Executing an alert() box on every option click",
    correct_answer: "B",
    topic: "React Quiz Application",
    section: "Experiment 12(b)",
    difficulty: "Medium",
  },
  {
    question: "What is the official learning portal hosted by MongoDB to study Developer, DBA, and Associate certification tracks?",
    option_a: "https://mongodb.edu.in",
    option_b: "https://learn.mongodb.com/",
    option_c: "https://academy.mongo.org",
    option_d: "https://nosql-certifications.com",
    correct_answer: "B",
    topic: "MongoDB University Certification",
    section: "Experiment 12(c)",
    difficulty: "Easy",
  },
];

async function seedFSD2Exam() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('🚀 SEEDING FULL STACK DEVELOPMENT - 2 EXAM & QUESTION BANK');
  console.log('════════════════════════════════════════════════════════════════\n');

  const now = new Date();
  const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year ahead
  const collegeId = 80;

  // 1. Ensure College & Department exist
  console.log('[1/4] Ensuring institution and cohort structure exist...');
  await supabase.from('colleges').upsert({
    id: collegeId,
    college_name: 'RV Institute of Technology (UGC – Autonomous)',
    college_code: 'RVIT',
    city: 'Chebrolu, Guntur',
    state: 'Andhra Pradesh',
    contact_email: 'fsd2.rvit@logicwhilelire.com',
    contact_phone: '+918106063555',
    is_active: true,
    registration_enabled: true,
    updated_at: now.toISOString(),
  }, { onConflict: 'id' });

  // 2. Target Exam Codes
  const targetExams = [
    {
      exam_code: 'FSD2026',
      exam_name: 'Full Stack Development – 2 Qualifier Assessment',
      subject: 'Full Stack Development',
      duration_minutes: 45,
      total_marks: 100,
    },
    {
      exam_code: 'RVIT-FSD2-2026',
      exam_name: 'RVIT Full Stack Development – 2 Lab Examination',
      subject: 'Full Stack Development',
      duration_minutes: 60,
      total_marks: 100,
    },
  ];

  console.log('[2/4] Registering and activating Full Stack Development exam codes...');
  for (const ex of targetExams) {
    const payload = {
      exam_code: ex.exam_code,
      exam_name: ex.exam_name,
      subject: ex.subject,
      total_questions: fsd2Questions.length,
      duration_minutes: ex.duration_minutes,
      passing_percentage: 40,
      start_time: now.toISOString(),
      end_time: future.toISOString(),
      is_launched: true,
      is_active: true,
      results_published: true,
      proctoring_enabled: true,
      negative_marking: 0,
      total_marks: ex.total_marks,
      max_participants: 2500,
      max_violations: 5,
      auto_terminate: true,
      grace_period_seconds: 120,
      allowed_languages: ['javascript', 'python', 'cpp', 'java'],
      is_locked: false,
      paper_status: 'allocated',
      college_id: collegeId,
      branch: 'CSE',
      passout_year: 2026,
    };

    const { error: ecErr } = await supabase.from('exam_codes').upsert(payload, { onConflict: 'exam_code' });
    if (ecErr) {
      console.error(`  ❌ Error updating ${ex.exam_code}:`, ecErr.message);
    } else {
      console.log(`  ✓ Exam Code [${ex.exam_code}] active and launched.`);
    }

    // 3. Clear and Insert questions into questions_ec
    await supabase.from('questions_ec').delete().eq('exam_code', ex.exam_code);

    const questionsToInsert = fsd2Questions.map((q, idx) => ({
      exam_code: ex.exam_code,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      marks: Math.round(ex.total_marks / fsd2Questions.length) || 1,
      penalty: 0,
      topic: q.topic,
      section: q.section,
      difficulty: q.difficulty,
      display_order: idx + 1,
    }));

    const { error: insErr } = await supabase.from('questions_ec').insert(questionsToInsert);
    if (insErr) {
      console.error(`  ❌ Error inserting questions for ${ex.exam_code}:`, insErr.message);
    } else {
      console.log(`  ✓ Inserted ${questionsToInsert.length} questions for [${ex.exam_code}].`);
    }
  }

  // 4. Generate Excel Template file
  console.log('[3/4] Generating Excel Question Bank workbook...');
  const excelRows = fsd2Questions.map((q, i) => ({
    'Question Number': i + 1,
    'Question': q.question,
    'Option A': q.option_a,
    'Option B': q.option_b,
    'Option C': q.option_c,
    'Option D': q.option_d,
    'Correct Answer': q.correct_answer,
    'Marks': 2,
    'Penalty': 0,
    'Section': q.section,
    'Topic': q.topic,
    'Difficulty': q.difficulty,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');

  const excelOutPath = path.resolve(process.cwd(), 'LogicWhileLiRE_Questions_FSD2.xlsx');
  XLSX.writeFile(wb, excelOutPath);
  console.log(`  ✓ Saved Excel question bank to: ${excelOutPath}`);

  // 5. Ensure core student test accounts are verified and eligible
  console.log('[4/4] Ensuring student eligibility across all test cohorts...');
  const studentRolls = ['24HU1A05F9', 'RVACJ31411', '2201A0501'];
  for (const r of studentRolls) {
    const { data: existing } = await supabase.from('students').select('*').eq('roll_number', r);
    if (!existing || existing.length === 0) {
      await supabase.from('students').insert({
        name: 'R. Charan Sai Krishna',
        roll_number: r,
        hall_ticket: r,
        email: `${r.toLowerCase()}@logicwhilelire.com`,
        college_id: collegeId,
        branch: 'CSE',
        branch_code: 'CSE',
        section: 'A',
        year_of_passing: 2026,
        is_verified: true,
        is_active: true,
      });
      console.log(`  ✓ Created verified student profile for: ${r}`);
    } else {
      await supabase.from('students').update({
        is_verified: true,
        is_active: true,
        college_id: collegeId,
        branch: 'CSE',
        branch_code: 'CSE',
        section: 'A',
        year_of_passing: 2026,
      }).eq('roll_number', r);
      console.log(`  ✓ Updated & verified student eligibility for: ${r}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('🎉 FULL STACK DEVELOPMENT – 2 EXAM SETUP COMPLETE & LIVE!');
  console.log('════════════════════════════════════════════════════════════════');
  console.log('Exam Codes Ready for Testing:');
  console.log('  1. FSD2026        → Full Stack Development – 2 Qualifier (45 min, 100 marks)');
  console.log('  2. RVIT-FSD2-2026 → RVIT FSD – 2 Lab Examination (60 min, 100 marks)');
  console.log('Student Access:');
  console.log('  Portal URL:  http://localhost:5173/enter-exam');
  console.log('  Roll Number: 2201A0501, RVACJ31411, or 24HU1A05F9');
  console.log('════════════════════════════════════════════════════════════════\n');
}

seedFSD2Exam().catch((err) => {
  console.error('Fatal error seeding FSD2 exam:', err);
  process.exit(1);
});

