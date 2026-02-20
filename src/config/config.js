/**
 * 앱 구성 상수/정적 데이터 (FTP 전용)
 * - GAME_CONFIG: 로그 타이핑/딜레이 관련 런타임 설정
 * - OPENING_SEQUENCE: 시스템 부트 오버레이에서 순차 출력할 텍스트
 */
export const GAME_CONFIG = {
  typingEnabled: false,
  typingCharDelayMs: 18,
  typingLineDelayMs: 120,
};

/**
 * 부팅 시퀀스 라인.
 * app.js의 scheduleNextOpeningLine()에서 delay를 간격으로 사용한다.
 */
export const OPENING_SEQUENCE = [
  { text: "[BOOT] HYRESIS ARCHIVE GATEWAY", tone: "log-muted", delay: 260 },
  { text: "[BOOT] runtime-shell init", tone: "log-muted", delay: 220 },
  { text: "[BOOT] secure transport init", tone: "log-muted", delay: 220 },
  { text: "[BOOT] mounting ftp://hyresis.local", tone: "log-muted", delay: 260 },
  { text: "[CHECK] archive integrity: degraded", tone: "log-warn", delay: 280 },
  { text: "[READY] operator authentication required", tone: "log-emphasis", delay: 300 },
];
