// app.js – 화면 동작 (목록 그리기, 일정 추가, Supabase 연동)

let tasks = [];
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음

// Supabase 클라이언트 초기화 (config.js의 SUPABASE_URL, SUPABASE_ANON_KEY 사용)
const supabaseClient = (typeof window !== 'undefined' && window.supabase && typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

async function loadTasks() {
  const msgBox = document.getElementById('msgBox');
  if (msgBox) msgBox.textContent = '';

  if (!supabaseClient || SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
    if (msgBox) msgBox.textContent = '⚠️ config.js에 Supabase 접속 정보를 설정해주세요';
    try {
      const response = await fetch('data/tasks.json');
      if (response.ok) tasks = await response.json();
    } catch (e) {
      tasks = [];
    }
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('wx_tasks')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    tasks = data || [];
  } catch (err) {
    console.error('Supabase 데이터 로드 실패:', err);
    if (msgBox) msgBox.textContent = '⚠️ Supabase 일정 로드 실패: ' + err.message;
    tasks = [];
  }
}

async function fetchWeatherData() {
  const regions = ['세종', '대전', '태안', '보령'];
  for (const region of regions) {
    try {
      const url = buildWeatherUrl(region);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const weather = parseWeatherData(region, data);
      if (weather) weatherByRegion[region] = weather;
    } catch (err) {
      console.error(`날씨 조회 실패 (${region}):`, err);
    }
  }
  renderTasks();
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const tr = document.createElement('tr');
    for (const v of [t.title, t.region, t.kind, t.owner, weatherText(w)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.textContent = r.text;
    td.className = r.level;
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

async function addTask(e) {
  e.preventDefault();
  const msgBox = document.getElementById('msgBox');
  if (msgBox) msgBox.textContent = '';

  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;

  if (!supabaseClient || SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
    if (msgBox) msgBox.textContent = '⚠️ config.js에 Supabase 접속 정보를 설정해주세요';
    return;
  }

  try {
    const { error } = await supabaseClient.from('wx_tasks').insert([t]);
    if (error) throw error;
    e.target.reset();
    await loadTasks();
    renderTasks();
  } catch (err) {
    console.error('Supabase 일정 추가 실패:', err);
    if (msgBox) msgBox.textContent = '⚠️ 일정 추가 실패: ' + err.message;
  }
}

function displayTodayDate() {
  const el = document.getElementById('todayDate');
  if (!el) return;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  el.textContent = `${yyyy}-${mm}-${dd}`;
}

function getTodayString() {
  const el = document.getElementById('todayDate');
  if (el && el.textContent) return el.textContent;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function saveMarkdown() {
  const dateStr = getTodayString();
  const md = generateMarkdownReport(tasks, weatherByRegion, dateStr);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `현장일정_판단_${dateStr}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('taskForm').addEventListener('submit', addTask);
const saveMdBtn = document.getElementById('saveMdBtn');
if (saveMdBtn) saveMdBtn.addEventListener('click', saveMarkdown);
displayTodayDate();
(async () => {
  await loadTasks();
  renderTasks();
  fetchWeatherData();
})();
