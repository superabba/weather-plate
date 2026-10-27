// api/kma.js – Vercel Serverless Function (/api/kma?region=...)
const fs = require('fs');
const path = require('path');
const { RULES, judge, buildWeatherUrl, parseWeatherData } = require('../logic.js');

// 기상청 격자 좌표
const KMA_COORDS = {
  '세종': { nx: 66, ny: 103 },
  '대전': { nx: 67, ny: 100 },
  '태안': { nx: 51, ny: 110 },
  '보령': { nx: 54, ny: 100 },
};

// Supabase 연결 정보 가져오기 (환경변수 우선, 없으면 config.js 파싱)
function getSupabaseConfig() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  }
  try {
    const configPath = path.join(__dirname, '..', 'config.js');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const urlMatch = content.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
      const keyMatch = content.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
      if (urlMatch && keyMatch) {
        return { url: urlMatch[1], key: keyMatch[1] };
      }
    }
  } catch (err) {
    console.error('config.js 파싱 에러:', err);
  }
  return null;
}

// 기상청 발표 기준 시각 계산 (02, 05, 08, 11, 14, 17, 20, 23시)
function getKmaBaseDateTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const kst = new Date(utc + (9 * 60 * 60 * 1000));

  const yyyy = kst.getFullYear();
  const mm = String(kst.getMonth() + 1).padStart(2, '0');
  const dd = String(kst.getDate()).padStart(2, '0');
  const baseDate = `${yyyy}${mm}${dd}`;

  const hours = kst.getHours();
  const minutes = kst.getMinutes();
  const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];
  let selected = 2;
  for (const b of baseTimes) {
    if (hours > b || (hours === b && minutes >= 15)) {
      selected = b;
    }
  }
  const baseTime = String(selected).padStart(2, '0') + '00';
  return { baseDate, baseTime, yyyyMmDd: `${yyyy}-${mm}-${dd}` };
}

// 기상청 API로 날씨 조회
async function fetchKmaWeather(region, serviceKey) {
  const coord = KMA_COORDS[region];
  if (!coord) return null;

  const { baseDate, baseTime } = getKmaBaseDateTime();
  const apiUrl = new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst');
  apiUrl.searchParams.append('serviceKey', serviceKey);
  apiUrl.searchParams.append('pageNo', '1');
  apiUrl.searchParams.append('numOfRows', '500');
  apiUrl.searchParams.append('dataType', 'JSON');
  apiUrl.searchParams.append('base_date', baseDate);
  apiUrl.searchParams.append('base_time', baseTime);
  apiUrl.searchParams.append('nx', coord.nx);
  apiUrl.searchParams.append('ny', coord.ny);

  const res = await fetch(apiUrl.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`KMA API HTTP ${res.status}`);
  const json = await res.json();

  const items = json?.response?.body?.items?.item;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('KMA API 응답 데이터 없음');
  }

  // 오늘 날짜의 예보 항목 추출 (TMX, WSD, POP)
  let maxTemp = null;
  let maxWind = 0;
  let maxRainProb = 0;

  for (const item of items) {
    if (item.category === 'TMX') {
      const val = parseFloat(item.fcstValue);
      if (!isNaN(val) && (maxTemp === null || val > maxTemp)) maxTemp = Math.round(val);
    } else if (item.category === 'TMP') {
      const val = parseFloat(item.fcstValue);
      if (!isNaN(val) && (maxTemp === null || val > maxTemp)) maxTemp = Math.round(val);
    } else if (item.category === 'WSD') {
      const val = parseFloat(item.fcstValue);
      if (!isNaN(val) && val > maxWind) maxWind = Math.round(val * 10) / 10;
    } else if (item.category === 'POP') {
      const val = parseInt(item.fcstValue, 10);
      if (!isNaN(val) && val > maxRainProb) maxRainProb = val;
    }
  }

  return {
    region,
    tempMax: maxTemp !== null ? maxTemp : 20,
    windMax: maxWind,
    rainProb: maxRainProb,
  };
}

// Open-Meteo API 백업 조회
async function fetchOpenMeteoWeather(region) {
  const url = buildWeatherUrl(region);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const data = await res.json();
  return parseWeatherData(region, data);
}

module.exports = async (req, res) => {
  // CORS 및 응답 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. 요청 지역 확인
  const region = (req.query?.region || '').trim();
  const validRegions = ['세종', '대전', '태안', '보령'];
  if (!region || !validRegions.includes(region)) {
    return res.status(400).json({
      error: `지역 파라미터(region)가 올바르지 않습니다. 허용 지역: ${validRegions.join(', ')} (예: /api/kma?region=대전)`,
    });
  }

  // 2. 날씨 정보 조회 (기상청 KMA_KEY 우선, 실패 시 Open-Meteo 폴백)
  let weather = null;
  let weatherSource = 'kma';
  const kmaKey = process.env.KMA_KEY;

  if (kmaKey) {
    try {
      weather = await fetchKmaWeather(region, kmaKey);
    } catch (err) {
      console.warn('기상청 API 조회 실패, Open-Meteo로 전환:', err.message);
    }
  }

  if (!weather) {
    try {
      weather = await fetchOpenMeteoWeather(region);
      weatherSource = 'open-meteo';
    } catch (err) {
      console.error('Open-Meteo 날씨 조회 실패:', err.message);
      weather = null;
      weatherSource = 'none';
    }
  }

  // 3. Supabase DB에서 해당 지역 일정 조회
  let tasks = [];
  const sbConfig = getSupabaseConfig();
  if (sbConfig && sbConfig.url && sbConfig.key) {
    try {
      const endpoint = `${sbConfig.url}/rest/v1/wx_tasks?region=eq.${encodeURIComponent(region)}&select=*&order=id.asc`;
      const sbRes = await fetch(endpoint, {
        headers: {
          'apikey': sbConfig.key,
          'Authorization': `Bearer ${sbConfig.key}`,
        },
      });
      if (sbRes.ok) {
        tasks = await sbRes.json();
      } else {
        console.error('Supabase REST API 응답 오류:', sbRes.status);
      }
    } catch (err) {
      console.error('Supabase DB 조회 실패:', err.message);
    }
  }

  // 4. 일정별 판단 적용
  const taskResults = tasks.map((t) => {
    const judgement = judge(t.kind, weather);
    return {
      id: t.id,
      title: t.title,
      region: t.region,
      kind: t.kind,
      owner: t.owner,
      judgement: {
        level: judgement.level,
        text: judgement.text,
      },
    };
  });

  // 5. 결과 반환
  const { yyyyMmDd } = getKmaBaseDateTime();
  return res.status(200).json({
    region,
    date: yyyyMmDd,
    weather,
    weatherSource,
    tasks: taskResults,
    rules: RULES,
  });
};
