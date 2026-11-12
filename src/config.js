// 사이트 설정 — 회사 이름과 Supabase 연결 정보를 여기서 바꿉니다.
export const CONFIG = {
  companyName: 'WORK',
  companyTagline: '강이 내려다보이는 우리 회사 사옥',

  // Supabase 프로젝트 주소와 공개(anon) 키. 비워 두면 "로컬 데모 모드"로 동작합니다.
  // (로컬 데모 모드: 같은 브라우저의 여러 탭끼리만 서로 보입니다.)
  // ⚠️ 이 소스를 복사(Fork)해서 쓰는 분은 아래 세 줄을 꼭 내 것으로 바꾸세요. (README 3단계)
  //    siteHost: 내 사이트 주소의 앞부분 (예: 'myid.github.io'). 이 주소에서 열 때만 아래 Supabase에 연결합니다.
  //    → 남의 소스를 그대로 올려도 원래 주인의 Supabase에 섞여 들어가지 않습니다.
  siteHost: 'roronee91-star.github.io',
  supabaseUrl: 'https://gayvbnowiuxzfwadoqtg.supabase.co',
  supabaseAnonKey: 'sb_publishable_J1alIW63mRsTQ_MBR_7JkA_PWL8ijPG', // 공개용(Publishable) 키 — 비밀 키는 절대 넣지 않음

  // Supabase가 없을 때 공지판에 보여 줄 기본 공지
  defaultNotices: [
    { title: '메타버스 사옥 오픈', body: '새 메타버스 사무실에 오신 것을 환영합니다. 옥상 테라스에서 야경을 즐겨 보세요.', author: '운영팀' },
    { title: '주간 회의', body: '매주 월요일 오전 10시, 3층 회의실 A에서 모입니다.', author: '경영지원' },
    { title: '라운지 이용 안내', body: '1층 카페와 4층 라운지는 누구나 자유롭게 이용할 수 있습니다.', author: '운영팀' },
  ],
};

export const AVATAR_COLORS = ['#4f8cff', '#ff6b6b', '#ffb547', '#3ecf8e', '#b47cff', '#ff7ac6', '#2ec4d6', '#e8e8e8'];
