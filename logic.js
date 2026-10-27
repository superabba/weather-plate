// logic.js – 판단 규칙만 (화면을 다루는 코드 금지)

// 교육용 가상 기준 (실제 작업 중지 · 행사 취소 기준은 각 기관 규정을 따름)
const RULES = { wind: 10, rain: 60, heat: 33 };

// 지역별 좌표 (위도, 경도)
const REGION_COORDS = {
  '세종': { lat: 36.4800, lon: 127.2890 },
  '대전': { lat: 36.3215, lon: 127.4263 },
  '태안': { lat: 36.5618, lon: 126.6015 },
  '보령': { lat: 36.3321, lon: 126.6247 },
};

// Open-Meteo API 주소 생성
function buildWeatherUrl(region) {
  const coord = REGION_COORDS[region];
  if (!coord) return null;
  const testWind = (typeof window !== 'undefined' && window.location) ? new URLSearchParams(window.location.search).get('test') : null;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.append('latitude', coord.lat);
  url.searchParams.append('longitude', coord.lon);
  url.searchParams.append('daily', 'temperature_2m_max,wind_speed_10m_max,precipitation_probability_max');
  url.searchParams.append('timezone', 'Asia/Seoul');
  return url.toString();
}

// API 응답 해석
function parseWeatherData(region, data) {
  if (!data.daily || !data.daily.time || data.daily.time.length === 0) return null;
  const testWind = (typeof window !== 'undefined' && window.location) ? new URLSearchParams(window.location.search).get('test') : null;
  let windMax = data.daily.wind_speed_10m_max[0];
  if (testWind === 'wind') windMax = 12;
  return {
    region: region,
    tempMax: Math.round(data.daily.temperature_2m_max[0]),
    windMax: windMax,
    rainProb: data.daily.precipitation_probability_max[0],
  };
}

// 일정 구분과 날씨로 판단 (w가 없으면 '날씨 확인 전')
function judge(kind, w) {
  if (!w) return { level: 'none', text: '날씨 확인 전' };
  if (kind === '실내') return { level: 'ok', text: '영향 없음' };
  if (kind === '고소' && w.windMax >= RULES.wind) return { level: 'stop', text: '중지 검토 (강풍)' };
  if (w.tempMax >= RULES.heat) return { level: 'warn', text: '폭염 휴식' };
  if (w.rainProb >= RULES.rain) return { level: 'warn', text: '우천 주의' };
  return { level: 'ok', text: '진행' };
}

// 날씨 정보 문자열 변환
function formatWeatherText(w) {
  return w ? `${w.tempMax}℃ · ${w.windMax}m/s · ${w.rainProb}%` : '-';
}

// 오늘 일정과 날씨 판단 마크다운 표 생성
function generateMarkdownReport(tasks, weatherByRegion = {}, dateStr = '') {
  const header = dateStr ? `# 현장 일정 판단 (${dateStr})\n\n` : '';
  const rows = [
    '| 일정 | 지역 | 구분 | 담당 | 날씨 | 판단 |',
    '|---|---|---|---|---|---|',
  ];

  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const weather = formatWeatherText(w);
    rows.push(`| ${t.title} | ${t.region} | ${t.kind} | ${t.owner} | ${weather} | ${r.text} |`);
  }

  const criteria = `판단 기준: 실내(영향 없음) · 고소(풍속 ${RULES.wind}m/s 이상 중지 검토) · 폭염(최고기온 ${RULES.heat}℃ 이상 휴식) · 우천(강수확률 ${RULES.rain}% 이상 주의)`;
  return header + rows.join('\n') + '\n\n' + criteria;
}

if (typeof module !== 'undefined') module.exports = { RULES, judge, buildWeatherUrl, parseWeatherData, formatWeatherText, generateMarkdownReport };
