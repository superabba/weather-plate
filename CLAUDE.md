# CLAUDE.md – 현장 일정 날씨판 작업 규칙

## 프로젝트 개요
- 교육용 프로토타입이다. 무엇을 만들지는 PRD.md를 따른다.
- PRD.md에 없는 기능은 먼저 제안하고, 내가 승인한 뒤에만 구현한다.

## 기술 스택 (변경 금지)
- HTML + CSS + 순수 JavaScript만 사용한다. (React 등 프레임워크, 빌드 도구 사용 금지)
- index.html 을 더블클릭해서 열 수 있어야 한다.

## 폴더 구조
- index.html : 화면 구조
- style.css  : 디자인
- logic.js   : 판단 규칙만 (화면을 다루는 코드 금지)
- app.js     : 화면 동작 (목록 그리기, 일정 추가, Supabase 연동)
- api/kma.js : Vercel 서버리스 함수 (지역별 일정·날씨·판단 API)
- config.js  : Supabase 연결 설정 (URL 및 anon key)
- setup.sql  : Supabase 데이터베이스 테이블 생성 및 정책 스크립트
- data/tasks.json : 초기 일정 데이터 (가상 데이터)
- PRD.md · CLAUDE.md · README.md : 문서

## 작업 방식
1. 코드를 고치기 전에 계획(수정할 파일과 이유)을 먼저 보여 주고 승인을 받는다.
2. 한 번에 한 가지만 고친다.
3. 끝나면 바꾼 파일, 내가 확인할 방법(T-번호), 남은 문제를 보고한다.

## 보안 · 데이터 규칙
- 가상 데이터만 사용한다. 실제 이름 · 연락처 · 기관 내부 자료를 넣지 않는다.
- 사용자가 입력한 글자는 textContent 로 표시한다.
- 비밀 키는 코드 · 채팅 · GitHub 에 넣지 않는다.

## 데이터 규칙 (04 단원 - Supabase)
- 모든 일정 데이터는 Supabase의 `wx_tasks` 표에서 읽고(`select`), 추가된 일정도 해당 표에 저장(`insert`)한다.
- 외부 라이브러리는 `supabase-js` 하나만 사용한다.
- Supabase 연결 정보는 `config.js`에 주소와 공개용 키(anon key) 2줄만 작성한다. 비밀 키(service_role)는 절대 사용하지 않는다.
- 데이터베이스 차원에서 유효하지 않은 데이터가 저장되지 않도록 구분(`kind`) 및 지역(`region`)에 `CHECK` 제약조건을 설정한다.
