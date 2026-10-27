// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음

async function loadTasks() {
  try {
    const response = await fetch('data/tasks.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const baseTasks = await response.json();
    const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
    tasks = baseTasks.concat(saved);
  } catch (err) {
    console.error('JSON 파일 로드 실패:', err);
    const msgBox = document.getElementById('msgBox');
    if (msgBox) msgBox.textContent = '⚠️ 배포주소로 열어주세요';
    tasks = JSON.parse(localStorage.getItem('wx_added') || '[]');
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

function addTask(e) {
  e.preventDefault();
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  saved.push(t);
  localStorage.setItem('wx_added', JSON.stringify(saved));
  e.target.reset();
  loadTasks();
  renderTasks();
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

document.getElementById('taskForm').addEventListener('submit', addTask);
displayTodayDate();
(async () => {
  await loadTasks();
  renderTasks();
  fetchWeatherData();
})();
