// 노동자의 도시 — 게임에 쓰는 표 (이름·숫자·글). 규칙은 sim.ts, 화면은 ui/·gfx/.
// 사람·회사·현장 이름은 모두 지어낸 것.

/** 현장 일의 종류 = 미니게임 */
export type Kind = 'clean' | 'sort' | 'line' | 'pipe' | 'crane';
export type LicenseId = 'safety' | 'signal' | 'forklift' | 'welding';
export type GearId = 'gloves' | 'knee' | 'belt' | 'boots' | 'thermos';
export type MealId = 'hamba' | 'ramen' | 'lunchbox' | 'skip';
export type EveningId = 'pocha' | 'konbini' | 'cook' | 'sauna' | 'call' | 'study' | 'report' | 'sleep';
export type BgId = 'youth' | 'father' | 'elder';
export type NpcId = 'kim' | 'park' | 'nguyen' | 'sujin' | 'minsu';
export type Weather = 'sun' | 'cloud' | 'rain' | 'heat' | 'cold';

export interface JobKind {
  id: Kind; name: string; short: string;
  build: boolean;          // 건설 현장: 안전교육 이수증이 있어야 하고, 비가 오면 공친다
  base: number;            // 기본 일당 (원)
  hard: number;            // 힘듦 1~3: 체력·피로가 그만큼 든다
  risk: number;            // 위험 1~3: 다칠 가능성
  need?: LicenseId;        // 이게 있어야 뽑힌다
  npc: NpcId;              // 이 일에서 자주 만나는 사람
  sites: string[];         // 현장 이름 (지어낸 것)
  howto: string;           // 조작 한 줄
  tip: string;             // 반장님 한마디
}

export const JOBS: Record<Kind, JobKind> = {
  clean: { id: 'clean', name: '현장 정리', short: '잡부', build: true, base: 140000, hard: 2, risk: 1, npc: 'minsu',
    sites: ['해돋이 아파트 신축 현장', '강변 오피스텔 공사장', '새말 초등학교 증축 현장', '시장 골목 상가 리모델링'],
    howto: '방향키로 움직여 자재 부스러기를 줍고(한 번에 3개) 마대 자루에 버려요. Z를 누르고 있으면 뛰어요. 지게차는 피하세요!',
    tip: '서두르다 다치면 아무것도 아니야. 지게차 소리 나면 일단 멈춰.' },
  sort: { id: 'sort', name: '택배 상하차', short: '상하차', build: false, base: 130000, hard: 3, risk: 1, npc: 'sujin',
    sites: ['동부 물류센터', '새벽길 택배 허브', '항만 냉장 창고', '북문 유통 센터'],
    howto: '빨간 딱지는 ↑, 파란 딱지는 ↓, 딱지가 없으면 ←로 그냥 보내요. 큰 상자는 두 번 눌러야 밀려요.',
    tip: '허리 말고 다리로 들어. 오늘 처음이면 손목 조심하고.' },
  line: { id: 'line', name: '공장 조립 라인', short: '라인', build: false, base: 120000, hard: 1, risk: 1, npc: 'nguyen',
    sites: ['한빛 부품 공장', '새날 전자 2공장', '도담 포장 공장', '산업단지 3블록 금형 공장'],
    howto: '부품이 누름틀 밑에 오면 Z로 철컥! 빨간 불량품은 누르지 말고 X로 빼내요.',
    tip: '라인은 박자야. 손이 먼저 나가면 꼭 불량이 나와.' },
  pipe: { id: 'pipe', name: '배관 조공', short: '배관', build: true, base: 165000, hard: 2, risk: 2, npc: 'kim',
    sites: ['해돋이 아파트 지하 기계실', '종합병원 증축동', '물류센터 소방 배관', '구청 신청사 설비'],
    howto: '방향키로 칸을 고르고 Z로 관을 돌려요. 물이 흐르기 시작하기 전에 왼쪽 밸브에서 오른쪽 출구까지 이어요.',
    tip: '물은 기다려 주지 않아. 끝에서부터 거꾸로 맞춰 보는 것도 방법이다.' },
  crane: { id: 'crane', name: '크레인 신호수', short: '신호수', build: true, base: 175000, hard: 1, risk: 3, need: 'signal', npc: 'park',
    sites: ['해돋이 아파트 12층 골조', '강변 오피스텔 철골', '항만 하역장', '교량 보강 공사'],
    howto: '←→로 크레인을 움직이고 ↓를 누르고 있으면 내려가요. 흔들림이 멎었을 때 깃발 위에 살며시 내려놓아요.',
    tip: '짐이 흔들리면 따라가지 말고 기다려. 신호수가 급하면 사람이 다친다.' },
};
export const KINDS: Kind[] = ['clean', 'sort', 'line', 'pipe', 'crane'];

export interface License { id: LicenseId; name: string; cost: number; nights: number; desc: string }
export const LICENSES: Record<LicenseId, License> = {
  safety: { id: 'safety', name: '건설업 기초안전보건교육', cost: 40000, nights: 1, desc: '건설 현장(현장 정리·배관·신호수)에 나가려면 꼭 있어야 하는 이수증. 다치면 산재 처리도 쉬워요.' },
  signal: { id: 'signal', name: '신호수 교육', cost: 80000, nights: 2, desc: '크레인 신호수 일을 받을 수 있어요. (안전교육이 먼저)' },
  forklift: { id: 'forklift', name: '지게차 운전기능사', cost: 220000, nights: 4, desc: '상하차 일당 +25%. 물류센터에서 지게차 기사를 우대해요.' },
  welding: { id: 'welding', name: '용접기능사', cost: 300000, nights: 5, desc: '배관 일당 +30%. 조공에서 기공으로 한 걸음.' },
};
export const LICENSE_IDS: LicenseId[] = ['safety', 'signal', 'forklift', 'welding'];

export interface Gear { id: GearId; name: string; cost: number; desc: string; stamina?: number; fatigue?: number; injury?: number; mood?: number }
export const GEAR: Record<GearId, Gear> = {
  gloves: { id: 'gloves', name: '코팅 장갑 한 묶음', cost: 12000, desc: '일할 때 체력이 10% 덜 들어요.', stamina: 0.9 },
  knee: { id: 'knee', name: '무릎 보호대', cost: 30000, desc: '피로가 10% 덜 쌓여요.', fatigue: 0.9 },
  belt: { id: 'belt', name: '허리 보호대', cost: 45000, desc: '피로가 15% 덜 쌓이고 덜 다쳐요.', fatigue: 0.85, injury: 0.7 },
  boots: { id: 'boots', name: '좋은 안전화', cost: 80000, desc: '덜 다치고 체력도 조금 덜 들어요.', stamina: 0.95, injury: 0.7 },
  thermos: { id: 'thermos', name: '보온병', cost: 15000, desc: '쉬는 시간마다 따뜻한 커피 한 잔. 점심 뒤 마음 +6.', mood: 6 },
};
export const GEAR_IDS: GearId[] = ['gloves', 'knee', 'belt', 'boots', 'thermos'];

export interface Meal { id: MealId; name: string; cost: number; stamina: number; mood: number; desc: string }
export const MEALS: Record<MealId, Meal> = {
  hamba: { id: 'hamba', name: '함바집 백반', cost: 9000, stamina: 35, mood: 6, desc: '제육볶음에 된장국. 밥은 마음껏.' },
  ramen: { id: 'ramen', name: '컵라면 + 삼각김밥', cost: 4000, stamina: 20, mood: 0, desc: '현장 컨테이너 옆에 쪼그려 앉아서.' },
  lunchbox: { id: 'lunchbox', name: '싸 온 도시락', cost: 0, stamina: 28, mood: 4, desc: '어젯밤에 싸 둔 밥과 김치.' },
  skip: { id: 'skip', name: '굶고 쉬기', cost: 0, stamina: 5, mood: -6, desc: '돈을 아끼려고 그늘에서 눈만 붙인다.' },
};

export interface Evening { id: EveningId; name: string; cost: number; mood: number; fatigue: number; desc: string }
export const EVENINGS: Record<EveningId, Evening> = {
  pocha: { id: 'pocha', name: '포장마차에서 한잔', cost: 16000, mood: 22, fatigue: 6, desc: '오늘 같이 일한 사람과 오뎅 국물에 소주 한 병.' },
  konbini: { id: 'konbini', name: '편의점 도시락', cost: 5500, mood: 3, fatigue: 0, desc: '전자레인지 앞에서 2분.' },
  cook: { id: 'cook', name: '고시원에서 밥 해 먹기', cost: 3000, mood: 5, fatigue: 0, desc: '공용 주방에서 계란밥. 내일 도시락도 싸 둔다.' },
  sauna: { id: 'sauna', name: '찜질방', cost: 11000, mood: 8, fatigue: -22, desc: '뜨거운 탕에 몸을 담그면 뭉친 게 풀린다.' },
  call: { id: 'call', name: '집에 전화하기', cost: 0, mood: 14, fatigue: 0, desc: '"밥은 먹고 다니니?"' },
  study: { id: 'study', name: '자격증 공부', cost: 0, mood: -4, fatigue: 5, desc: '야간 학원. 졸린 눈을 비비며.' },
  report: { id: 'report', name: '노동청에 진정 넣기', cost: 0, mood: 4, fatigue: 0, desc: '못 받은 일당. 서류를 꼼꼼히 적었다.' },
  sleep: { id: 'sleep', name: '그냥 일찍 자기', cost: 0, mood: 0, fatigue: -8, desc: '씻고 바로 눕는다.' },
};

export interface Background {
  id: BgId; name: string; age: string; story: string;
  goal: number; goalName: string; money: number; rep: number; staminaMax: number; recover: number;
  skill: Partial<Record<Kind, number>>; licenses: LicenseId[]; family: string;
}
export const BACKGROUNDS: Record<BgId, Background> = {
  youth: { id: 'youth', name: '청년', age: '27살', family: '어머니',
    story: '이력서를 서른 군데 넘게 냈다. 연락은 오지 않고 통장은 바닥났다. 일단 몸으로 벌어 보기로 했다.',
    goal: 3000000, goalName: '고시원을 나와 원룸 보증금 마련하기', money: 120000, rep: 15, staminaMax: 100, recover: 1.1,
    skill: {}, licenses: [] },
  father: { id: 'father', name: '가장', age: '43살', family: '아내와 딸',
    story: '십 년 하던 분식집을 접었다. 빚은 남았고 딸아이 학원비는 기다려 주지 않는다. 새벽 인력시장에 처음 나왔다.',
    goal: 5000000, goalName: '딸의 대학 첫 등록금 모으기', money: 200000, rep: 25, staminaMax: 92, recover: 1.0,
    skill: { line: 60, clean: 60 }, licenses: ['safety'] },
  elder: { id: 'elder', name: '어르신', age: '63살', family: '아내',
    story: '배관 일만 삼십 년. 정년이 지났어도 손은 아직 기억한다. 아내와 한 번도 못 가 본 제주도에 가 보고 싶다.',
    goal: 4000000, goalName: '아내와 제주도 여행 가기', money: 300000, rep: 55, staminaMax: 75, recover: 0.8,
    skill: { pipe: 400, crane: 180, clean: 60 }, licenses: ['safety', 'signal'] },
};
export const BG_IDS: BgId[] = ['youth', 'father', 'elder'];

/** 숙련 경험치 → 등급 (1~5) */
export const LEVEL_XP = [0, 60, 180, 400, 750];
export const LEVEL_NAMES = ['처음', '손에 익음', '능숙', '베테랑', '명인'];
/** 전체 칭호 (숙련 등급 합으로) */
export const RANKS: Array<[number, string]> = [[0, '잡부'], [8, '조공'], [12, '기공'], [17, '반장감'], [22, '현장의 전설']];

export const WEATHER_NAMES: Record<Weather, string> = { sun: '맑음', cloud: '흐림', rain: '비', heat: '폭염', cold: '한파' };
export const WEATHER_ICON: Record<Weather, string> = { sun: '☀️', cloud: '☁️', rain: '🌧️', heat: '🔥', cold: '❄️' };
export const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export const RENT = 95000;          // 고시원 방값 (일주일마다)
export const FEE = 0.1;             // 인력사무소 소개비 10%

// ─────────── 같이 일하는 사람들 (모두 지어낸 인물) ───────────
export interface Npc { id: NpcId; name: string; role: string; helmet: string; stories: string[][] }
export const NPCS: Record<NpcId, Npc> = {
  kim: { id: 'kim', name: '김 반장', role: '배관 반장 · 50대', helmet: 'white', stories: [
    ['"너 손 봐라. 장갑 끼라고 했지." 말은 퉁명스러운데 새 장갑을 한 켤레 던져 준다.', '"나도 처음엔 니 나이 때 용접 불똥에 눈썹 다 탔다."'],
    ['"우리 아들이 이번에 군대 갔다. 훈련소 사진 봤는데 나보다 어깨가 넓더라."', '반장님은 휴대폰 사진을 몇 번이고 넘겨 보였다.'],
    ['"이 일은 남는 게 없어. 근데 내가 놓은 관으로 지금 저 병원에 물이 돈다. 그건 남지."'],
    ['"무릎이 예전 같지 않아. 계단 올라갈 때마다 소리가 나." 반장님이 웃으며 무릎을 두드렸다.', '"그래도 내 현장에서 사람 다치는 꼴은 못 본다."'],
    ['"너, 용접 배워 봐. 니 손이면 금방 기공 된다. 학원비 모자라면 말해."', '처음으로 반장님이 내 이름을 불렀다.'],
  ] },
  park: { id: 'park', name: '박 씨 아저씨', role: '신호수 30년 · 60대', helmet: 'red', stories: [
    ['"크레인 기사랑 신호수는 부부 같은 거야. 눈빛만 봐도 알아야 해."', '아저씨는 무전기를 아기 다루듯 닦았다.'],
    ['"88년도에 처음 현장 나왔지. 그땐 안전모도 없이 일했어. 지금 애들은 그래도 복 받은 거야."'],
    ['"손주가 할아버지 뭐 하냐고 물어서, 하늘에 있는 집을 짓는다고 했다."', '"그 말이 틀린 건 아니잖아?"'],
    ['"작년에 옆 현장에서 사고가 났어. 신호 한 번 잘못 줘서." 아저씨는 한참 소주잔만 돌렸다.', '"그래서 나는 급하면 멈춰. 일보다 사람이 먼저야."'],
    ['"내년엔 진짜 그만둘 거다." 아저씨는 해마다 그렇게 말한다고 했다.', '"근데 아침에 눈 뜨면 또 나오고 싶어. 웃기지?"'],
  ] },
  nguyen: { id: 'nguyen', name: '응우옌', role: '라인 작업자 · 20대', helmet: 'blue', stories: [
    ['"한국말 아직 어려워요. 반장님 말 빨라요." 응우옌이 수첩을 보여 준다. 공장 말이 빼곡히 적혀 있다.', '"\'대충\' 무슨 뜻이에요? 반장님 맨날 대충 하지 말래요."'],
    ['"고향에 동생 둘. 학교 다녀요. 내가 보내는 돈으로."', '응우옌은 동생들 교복 입은 사진을 자랑했다.'],
    ['"처음에 겨울 몰랐어요. 손이 이렇게 아픈 거 몰랐어요." 응우옌이 웃으며 손을 비볐다.', '"지금은 괜찮아요. 핫팩 알아요!"'],
    ['"나 꿈 있어요. 고향 가서 작은 공장 하고 싶어요. 여기서 배운 거로."', '"그때 형 놀러 와요. 쌀국수 진짜 맛있어요."'],
    ['"형, 오늘 나 한국어 시험 붙었어요!" 응우옌이 합격 문자를 보여 줬다.', '포장마차 아주머니가 오뎅을 하나 더 얹어 주셨다.'],
  ] },
  sujin: { id: 'sujin', name: '수진 조장', role: '물류센터 조장 · 30대', helmet: 'orange', stories: [
    ['"여기 처음 오면 다들 사흘을 못 버텨. 넌 일주일 가 보자."', '조장님은 파스 한 장을 건넸다.'],
    ['"나 원래 미용 했어. 손님 머리 자르다가, 지금은 상자 자르네." 조장님이 커터 칼을 돌리며 웃었다.'],
    ['"야간조 3년 하면 낮이 무서워져. 햇빛이 눈부셔서."', '"그래도 우리 덕에 내일 아침 누군가는 선물을 받잖아."'],
    ['"우리 엄마가 나 이 일 하는 거 몰라. 회사 다니는 줄 알아."', '"언젠간 말해야지. 부끄러운 일은 아니니까."'],
    ['"다음 달에 정규직 시험 본대. 붙으면 한턱 쏜다." 조장님 눈이 반짝였다.', '"너도 지게차 따 봐. 여기서 기사님은 대접받아."'],
  ] },
  minsu: { id: 'minsu', name: '민수', role: '휴학생 · 20대', helmet: 'yellow', stories: [
    ['"형도 처음이에요? 저도 이번 주가 처음이에요." 민수는 새 안전화가 아직 반짝였다.'],
    ['"등록금 벌려고 휴학했어요. 한 학기만 하면 돼요." 민수가 손바닥 물집을 보여 줬다.', '"이거 터지면 굳은살 된대요. 그럼 진짜 노가다꾼이래요."'],
    ['"아빠도 젊을 때 이 일 했대요. 그땐 몰랐는데, 아빠 손이 왜 그렇게 두꺼웠는지 알겠어요."'],
    ['"오늘 반장님이 저보고 일 좀 한다고 했어요!" 민수는 하루 종일 싱글벙글했다.'],
    ['"형, 저 다음 주에 복학해요. 근데 방학 때 또 올 거예요." 민수가 안전모를 꾹 눌러썼다.', '"여기 사람들 좋아요. 학교보다 더 많이 배웠어요."'],
  ] },
};
export const NPC_IDS: NpcId[] = ['kim', 'park', 'nguyen', 'sujin', 'minsu'];

// ─────────── 소장님·반장님 말 ───────────
export const BOSS_LINES = {
  hired: ['"{name}씨, 오늘 {site} 가요. 봉고차 타요."', '"어이 {name}씨! 일 있어. 빨리 와."', '"{name}씨 오늘 운 좋네. 마지막 자리야."'],
  rejected: ['"오늘은 자리가 찼어요. 내일 일찍 와요."', '"미안해요, 거긴 경험 있는 사람 찾아서."', '"오늘은 안 되겠네. 다른 데 봐 봐요."'],
  tired: '"{name}씨 얼굴이 너무 안 좋아. 오늘은 들어가 쉬어요. 그러다 큰일 나."',
  noSafety: '"건설 현장은 안전교육 이수증 있어야 돼요. 저녁에 받고 와요."',
  noLicense: '"거긴 자격 있는 사람만 받아요."',
  rain: '"비 와서 건설 현장은 다 공쳤어요. 공장이나 물류만 있어."',
  named: '"{site} 반장님이 {name}씨 콕 집어서 불렀어요. 어제 잘했다고."',
  grade: {
    S: ['"오늘 니 덕에 일찍 끝났다. 내일도 나와."', '"이야, 일 할 줄 아네. 내일 또 보자."'],
    A: ['"수고했다. 손이 빠르네."', '"괜찮았어. 내일도 이렇게만 해."'],
    B: ['"고생했다. 처음엔 다 그래."', '"그럭저럭. 내일은 좀 더 빨리."'],
    C: ['"좀 더 집중해라. 다칠라."', '"힘들지? 그래도 끝까지 했네."'],
    F: ['"…내일은 다른 데 알아봐."', '"오늘은 영 아니다. 몸부터 챙겨."'],
  } as Record<string, string[]>,
};

// ─────────── 도장 (해냈다!) ───────────
export interface Stamp { id: string; name: string; desc: string }
export const STAMPS: Stamp[] = [
  { id: 'first', name: '첫 일당', desc: '처음으로 일당을 받았다' },
  { id: 'firstS', name: '내일도 나와', desc: '처음으로 S를 받았다' },
  { id: 'week', name: '일주일 버티기', desc: '7일을 버텼다' },
  { id: 'streak5', name: '개근', desc: '5일 연속 출근' },
  { id: 'named3', name: '지명 단골', desc: '3번 연속 지명받았다' },
  { id: 'allJobs', name: '안 해 본 일 없음', desc: '다섯 가지 일을 다 해 봤다' },
  { id: 'license', name: '자격증', desc: '자격증·이수증을 하나 땄다' },
  { id: 'allLicense', name: '자격증 부자', desc: '자격증·이수증을 다 땄다' },
  { id: 'story', name: '말동무', desc: '한 사람의 이야기를 끝까지 들었다' },
  { id: 'allStory', name: '도시의 사람들', desc: '모두의 이야기를 끝까지 들었다' },
  { id: 'rainDay', name: '비 오는 날', desc: '비 때문에 공쳤다' },
  { id: 'unpaid', name: '받을 건 받는다', desc: '못 받은 일당을 노동청 진정으로 받아 냈다' },
  { id: 'master', name: '명인', desc: '한 가지 일에서 명인이 됐다' },
  { id: 'million', name: '백만 원', desc: '모은 돈이 백만 원을 넘었다' },
  { id: 'goal', name: '꿈을 이뤘다', desc: '목표 금액을 모았다' },
];

// ─────────── 일기 ───────────
export const DIARY = {
  weather: { sun: '맑았다.', cloud: '하늘이 잿빛이었다.', rain: '비가 왔다.', heat: '숨이 턱턱 막히게 더웠다.', cold: '손이 얼어붙을 만큼 추웠다.' } as Record<Weather, string>,
  grade: {
    S: ['반장님한테 칭찬을 들었다. 별것 아닌데 하루 종일 기분이 좋았다.', '오늘은 몸이 알아서 움직였다.'],
    A: ['일이 손에 붙기 시작했다.', '실수 없이 하루를 마쳤다.'],
    B: ['그럭저럭 하루를 버텼다.', '어깨가 뻐근하다. 그래도 일당은 받았다.'],
    C: ['실수가 많았다. 내일은 더 잘하고 싶다.', '몸이 내 마음대로 안 움직였다.'],
    F: ['오늘은 정말 엉망이었다. 그래도 내일은 또 온다.', '반장님 얼굴을 볼 수가 없었다.'],
  } as Record<string, string[]>,
  rest: ['오늘은 쉬었다. 하루 종일 천장만 봤다.', '쉬는 날인데도 새벽 네 시 반에 눈이 떠졌다.'],
  noJob: ['새벽에 나갔는데 일을 못 받았다. 봉고차가 떠나는 걸 보고 돌아왔다.', '오늘은 허탕이었다. 컵라면 하나로 하루를 버텼다.'],
  rain: ['비 때문에 공쳤다. 빗소리를 들으며 누워 있었다.'],
  hurt: '일하다 다쳤다. 며칠은 쉬어야 한단다.',
  unpaid: '일당을 못 받았다. 다음 주에 준다는데, 믿어도 될까.',
  repaid: '못 받았던 일당이 들어왔다. 진정 넣길 잘했다.',
  rent: '방값을 냈다. 통장이 또 가벼워졌다.',
  noRent: '방값을 못 냈다. 총무님 눈치가 보인다.',
};
