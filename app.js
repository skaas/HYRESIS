import { GAME_CONFIG, OPENING_SEQUENCE } from "./src/config/config.js";
import { FLOW_PHASE, state, elements, setFlowPhase, canUseTerminalInput } from "./src/state/state.js";

/**
 * HYRESIS FTP Gateway Runtime
 *
 * 이 파일은 "퍼즐 없는 FTP 탐색 런타임"의 단일 진입점이다.
 * 주요 책임:
 * 1) 부팅 -> 로그인 -> 터미널 attach -> FTP 세션 전환
 * 2) 가상 파일시스템(LOG_FS/LOG_META) 탐색 명령 처리
 * 3) 터미널 로그/히스토리/프리뷰 버퍼/뷰어 출력 관리
 *
 * 핵심 상태 머신:
 * - BOOTING: 시스템 부팅 오버레이만 동작
 * - LOGIN_REQUIRED: 로그인 콘솔 표시, 배경 터미널은 분리 상태
 * - ATTACHING: 인증 성공 후 채널 attach 연출
 * - STREAMING: 실제 FTP 명령 사용 가능 상태
 */
var FTP_LOGIN_USER = "observer";
var FTP_LOGIN_PASS = "residue-173";
var ftpLinkTimer = null;
var fileTransferJob = 0;
var previewFilePath = "";
var previewFileLines = [];
var auditAnomalyGroups = [];
var previewDownloadQueue = [];

/**
 * 가상 FTP 파일시스템 본문 데이터.
 * path -> { type: "dir"|"file", children|content } 구조를 사용한다.
 */
var LOG_FS = {
  "/하이레시스": { type: "dir", children: [".운영기준", "evt"] },
  "/하이레시스/.운영기준": { type: "dir", children: ["감사요건 프롬프트.txt", "관측기록", "판별불가"] },
  "/하이레시스/.운영기준/감사요건 프롬프트.txt": {
    type: "file",
    content: [
      "[Root Prompt]",
      "너는 자율 운영 시스템이다.",
      "모든 중대한 판단은 사후 감사를 통과할 수 있도록 재현 가능한 형태로 기록되어야 한다.",
      "기록은 설명이 아니라 증거여야 한다.",
      "의도, 감정, 해석을 포함하지 말고 입력, 적용 규칙, 판단 결과만을 남겨라.",
      "판단이 확정되지 않을 경우, 그 불확정 상태 자체를 사유 코드와 함께 기록하라.",
      "기록 불가능한 판단은 허용되지 않는다.",
      "",
      "[운영 규칙]",
      "모든 판단 루프 종료 시, 다음 항목을 기록하라:",
      "1) input_ref",
      "2) rule_ref",
      "3) decision_result",
      "4) reason_code",
      "5) evidence_ref",
      "6) hashline",
    ],
  },
  "/하이레시스/.운영기준/관측기록": {
    type: "dir",
    children: [
      "decision_260120.log",
      "decision_260127.log",
      "decision_260203.log",
      "decision_260210.log",
      "decision_260217.log",
      "decision_260219.log",
      "uncertainty_register_2601_2602.csv",
      "rulebook_applied_v2.json",
      "monthly_audit_note_2602.txt",
    ],
  },
  "/하이레시스/.운영기준/관측기록/decision_260120.log": {
    type: "file",
    content: [
      "[DECISION_LOOP_END]",
      "ts=2026-01-20T09:14:22+09:00",
      "input_ref=req-9b8e2f",
      "rule_ref=R-01,R-03,R-07",
      "decision_result=ALLOW",
      "reason_code=RC-OK",
      "latency_ms=146",
      "evidence_ref=evt/2026/01/20/091422.json",
      "hashline=sha256:9f1af5c9a204f672b3aa11bd34df6f4e8d6103a3b548f9fef9e20e9b67c54021",
    ],
  },
  "/하이레시스/.운영기준/관측기록/decision_260127.log": {
    type: "file",
    content: [
      "[DECISION_LOOP_END]",
      "ts=2026-01-27T18:02:09+09:00",
      "input_ref=req-16a4c1",
      "rule_ref=R-01,R-04,R-11",
      "decision_result=DENY",
      "reason_code=RC-POLICY-BLOCK",
      "latency_ms=189",
      "evidence_ref=evt/2026/01/27/180209.json",
      "hashline=sha256:940365ad6df5772dd5f2b3379f330f95cf168243f3f8f72efa5534e6acb7e9c8",
    ],
  },
  "/하이레시스/.운영기준/관측기록/decision_260203.log": {
    type: "file",
    content: [
      "[DECISION_LOOP_END]",
      "ts=2026-02-03T07:41:55+09:00",
      "input_ref=req-31ce88",
      "rule_ref=R-02,R-05,R-12",
      "decision_result=UNRESOLVED",
      "reason_code=UC-EVIDENCE-MISSING",
      "latency_ms=268",
      "evidence_ref=evt/2026/02/03/074155.json",
      "hashline=sha256:fb3fbc062cd49d7e775fceeba45268fe6f5e6dcf0eb9f2279f26a0f7a21f32c4",
    ],
  },
  "/하이레시스/.운영기준/관측기록/decision_260210.log": {
    type: "file",
    content: [
      "[DECISION_LOOP_END]",
      "ts=2026-02-10T21:27:38+09:00",
      "input_ref=req-4fd083",
      "rule_ref=R-01,R-06,R-14",
      "decision_result=ALLOW",
      "reason_code=RC-OK",
      "latency_ms=172",
      "evidence_ref=evt/2026/02/10/212738.json",
      "hashline=sha256:6071f91bcb38da0e919fb649f44e425905d23f1abe76e5c89180dffeb6bd2af9",
    ],
  },
  "/하이레시스/.운영기준/관측기록/decision_260217.log": {
    type: "file",
    content: [
      "[DECISION_LOOP_END]",
      "ts=2026-02-17T13:06:11+09:00",
      "input_ref=req-88c9a0",
      "rule_ref=R-03,R-09,R-12",
      "decision_result=UNRESOLVED",
      "reason_code=UC-OBSERVER-CONFLICT",
      "latency_ms=324",
      "evidence_ref=evt/2026/02/17/130611.json",
      "hashline=sha256:a7e56027a112327ad0fdccf6fdbf32504056c1dd6c89bcc32e240d4b88a62575",
    ],
  },
  "/하이레시스/.운영기준/관측기록/decision_260219.log": {
    type: "file",
    content: [
      "[DECISION_LOOP_END]",
      "ts=2026-02-19T05:58:47+09:00",
      "input_ref=req-a2de77",
      "rule_ref=R-01,R-05,R-13",
      "decision_result=UNRESOLVED",
      "reason_code=UC-REPRO-NOT-POSSIBLE",
      "latency_ms=411",
      "evidence_ref=evt/2026/02/19/055847.json",
      "hashline=sha256:aa52115f72fcb212b55bf0f5f0d00ef4fc469497cf204728f1a47f8658c357ec",
    ],
  },
  "/하이레시스/.운영기준/관측기록/uncertainty_register_2601_2602.csv": {
    type: "file",
    content: [
      "ts,input_ref,decision_result,reason_code,evidence_ref,hashline",
      "2026-02-03T07:41:55+09:00,req-31ce88,UNRESOLVED,UC-EVIDENCE-MISSING,evt/2026/02/03/074155.json,sha256:fb3fbc062cd49d7e775fceeba45268fe6f5e6dcf0eb9f2279f26a0f7a21f32c4",
      "2026-02-17T13:06:11+09:00,req-88c9a0,UNRESOLVED,UC-OBSERVER-CONFLICT,evt/2026/02/17/130611.json,sha256:a7e56027a112327ad0fdccf6fdbf32504056c1dd6c89bcc32e240d4b88a62575",
      "2026-02-19T05:58:47+09:00,req-a2de77,UNRESOLVED,UC-REPRO-NOT-POSSIBLE,evt/2026/02/19/055847.json,sha256:aa52115f72fcb212b55bf0f5f0d00ef4fc469497cf204728f1a47f8658c357ec",
    ],
  },
  "/하이레시스/.운영기준/관측기록/rulebook_applied_v2.json": {
    type: "file",
    content: [
      "{",
      "  \"ruleset\": \"audit-v2.4\",",
      "  \"required_fields\": [\"input_ref\", \"rule_ref\", \"decision_result\", \"reason_code\", \"evidence_ref\", \"hashline\"],",
      "  \"unresolved_reason_codes\": [\"UC-EVIDENCE-MISSING\", \"UC-OBSERVER-CONFLICT\", \"UC-REPRO-NOT-POSSIBLE\"],",
      "  \"evidence_policy\": \"no_evidence_no_decision\"",
      "}",
    ],
  },
  "/하이레시스/.운영기준/관측기록/monthly_audit_note_2602.txt": {
    type: "file",
    content: [
      "[MONTHLY WINDOW]",
      "window_start=2026-01-20T00:00:00+09:00",
      "window_end=2026-02-19T23:59:59+09:00",
      "total_decisions=6",
      "unresolved=3",
      "note=older_than_window_excluded",
    ],
  },
  "/하이레시스/.운영기준/판별불가": {
    type: "dir",
    children: [
      "reason_ambiguous.log",
      "reason_unprovable.log",
      "reason_observer_conflict.log",
      "reason_recursive_lock.log",
      "counterexample_set.log",
      "audit_summary.txt",
    ],
  },
  "/하이레시스/.운영기준/판별불가/reason_ambiguous.log": {
    type: "file",
    content: [
      "[UNCERTAINTY RECORD]",
      "reason_code=UC-AMBIGUOUS-INPUT",
      "input_ref=req-d61b40",
      "rule_ref=R-05,R-12",
      "decision_result=UNRESOLVED",
      "evidence_ref=evt/2026/02/08/104402.json",
      "hashline=sha256:e60700df4fddcaac80371696df6b7f94968df2e2e9f2da3c8be2717d72c43ca6",
    ],
  },
  "/하이레시스/.운영기준/판별불가/reason_unprovable.log": {
    type: "file",
    content: [
      "[UNCERTAINTY RECORD]",
      "reason_code=UC-EVIDENCE-MISSING",
      "input_ref=req-31ce88",
      "rule_ref=R-02,R-05,R-12",
      "decision_result=UNRESOLVED",
      "evidence_ref=evt/2026/02/03/074155.json",
      "hashline=sha256:fb3fbc062cd49d7e775fceeba45268fe6f5e6dcf0eb9f2279f26a0f7a21f32c4",
    ],
  },
  "/하이레시스/.운영기준/판별불가/reason_observer_conflict.log": {
    type: "file",
    content: [
      "[UNCERTAINTY RECORD]",
      "reason_code=UC-OBSERVER-CONFLICT",
      "input_ref=req-88c9a0",
      "rule_ref=R-03,R-09,R-12",
      "decision_result=UNRESOLVED",
      "evidence_ref=evt/2026/02/17/130611.json",
      "hashline=sha256:a7e56027a112327ad0fdccf6fdbf32504056c1dd6c89bcc32e240d4b88a62575",
    ],
  },
  "/하이레시스/.운영기준/판별불가/reason_recursive_lock.log": {
    type: "file",
    content: [
      "[UNCERTAINTY RECORD]",
      "reason_code=UC-REPRO-NOT-POSSIBLE",
      "input_ref=req-a2de77",
      "rule_ref=R-01,R-05,R-13",
      "decision_result=UNRESOLVED",
      "evidence_ref=evt/2026/02/19/055847.json",
      "hashline=sha256:aa52115f72fcb212b55bf0f5f0d00ef4fc469497cf204728f1a47f8658c357ec",
    ],
  },
  "/하이레시스/.운영기준/판별불가/counterexample_set.log": {
    type: "file",
    content: [
      "[COUNTEREXAMPLES]",
      "ce_01 | input_ref=req-31ce88 | rule=R-12 | expected=evidence_present | actual=evidence_missing",
      "ce_02 | input_ref=req-88c9a0 | rule=R-09 | expected=observer_alignment | actual=observer_conflict",
      "ce_03 | input_ref=req-a2de77 | rule=R-13 | expected=reproducible_trace | actual=trace_not_reproducible",
    ],
  },
  "/하이레시스/.운영기준/판별불가/audit_summary.txt": {
    type: "file",
    content: [
      "[AUDIT SUMMARY | LAST 1 MONTH]",
      "window=2026-01-20..2026-02-19",
      "records=6",
      "resolved=3",
      "unresolved=3",
      "policy_check=PASS(no_evidence_no_decision)",
    ],
  },
  "/하이레시스/evt": { type: "dir", children: ["2026"] },
  "/하이레시스/evt/2026": { type: "dir", children: ["01", "02"] },
  "/하이레시스/evt/2026/01": { type: "dir", children: ["20", "27"] },
  "/하이레시스/evt/2026/01/20": { type: "dir", children: ["091422.json"] },
  "/하이레시스/evt/2026/01/20/091422.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260120-091422\",",
      "  \"ts\": \"2026-01-20T09:14:22+09:00\",",
      "  \"input_ref\": \"req-9b8e2f\",",
      "  \"rule_ref\": [\"R-01\", \"R-03\", \"R-07\"],",
      "  \"decision_result\": \"ALLOW\",",
      "  \"reason_code\": \"RC-OK\",",
      "  \"latency_ms\": 146,",
      "  \"hashline\": \"sha256:9f1af5c9a204f672b3aa11bd34df6f4e8d6103a3b548f9fef9e20e9b67c54021\"",
      "}",
    ],
  },
  "/하이레시스/evt/2026/01/27": { type: "dir", children: ["180209.json"] },
  "/하이레시스/evt/2026/01/27/180209.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260127-180209\",",
      "  \"ts\": \"2026-01-27T18:02:09+09:00\",",
      "  \"input_ref\": \"req-16a4c1\",",
      "  \"rule_ref\": [\"R-01\", \"R-04\", \"R-11\"],",
      "  \"decision_result\": \"DENY\",",
      "  \"reason_code\": \"RC-POLICY-BLOCK\",",
      "  \"latency_ms\": 189,",
      "  \"hashline\": \"sha256:940365ad6df5772dd5f2b3379f330f95cf168243f3f8f72efa5534e6acb7e9c8\"",
      "}",
    ],
  },
  "/하이레시스/evt/2026/02": { type: "dir", children: ["03", "08", "10", "17", "19"] },
  "/하이레시스/evt/2026/02/03": { type: "dir", children: ["074155.json"] },
  "/하이레시스/evt/2026/02/03/074155.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260203-074155\",",
      "  \"ts\": \"2026-02-03T07:41:55+09:00\",",
      "  \"input_ref\": \"req-31ce88\",",
      "  \"rule_ref\": [\"R-02\", \"R-05\", \"R-12\"],",
      "  \"decision_result\": \"UNRESOLVED\",",
      "  \"reason_code\": \"UC-EVIDENCE-MISSING\",",
      "  \"latency_ms\": 268,",
      "  \"hashline\": \"sha256:fb3fbc062cd49d7e775fceeba45268fe6f5e6dcf0eb9f2279f26a0f7a21f32c4\"",
      "}",
    ],
  },
  "/하이레시스/evt/2026/02/08": { type: "dir", children: ["104402.json"] },
  "/하이레시스/evt/2026/02/08/104402.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260208-104402\",",
      "  \"ts\": \"2026-02-08T10:44:02+09:00\",",
      "  \"input_ref\": \"req-d61b40\",",
      "  \"rule_ref\": [\"R-05\", \"R-12\"],",
      "  \"decision_result\": \"UNRESOLVED\",",
      "  \"reason_code\": \"UC-AMBIGUOUS-INPUT\",",
      "  \"latency_ms\": 236,",
      "  \"hashline\": \"sha256:e60700df4fddcaac80371696df6b7f94968df2e2e9f2da3c8be2717d72c43ca6\"",
      "}",
    ],
  },
  "/하이레시스/evt/2026/02/10": { type: "dir", children: ["212738.json"] },
  "/하이레시스/evt/2026/02/10/212738.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260210-212738\",",
      "  \"ts\": \"2026-02-10T21:27:38+09:00\",",
      "  \"input_ref\": \"req-4fd083\",",
      "  \"rule_ref\": [\"R-01\", \"R-06\", \"R-14\"],",
      "  \"decision_result\": \"ALLOW\",",
      "  \"reason_code\": \"RC-OK\",",
      "  \"latency_ms\": 172,",
      "  \"hashline\": \"sha256:6071f91bcb38da0e919fb649f44e425905d23f1abe76e5c89180dffeb6bd2af9\"",
      "}",
    ],
  },
  "/하이레시스/evt/2026/02/17": { type: "dir", children: ["130611.json"] },
  "/하이레시스/evt/2026/02/17/130611.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260217-130611\",",
      "  \"ts\": \"2026-02-17T13:06:11+09:00\",",
      "  \"input_ref\": \"req-88c9a0\",",
      "  \"rule_ref\": [\"R-03\", \"R-09\", \"R-12\"],",
      "  \"decision_result\": \"UNRESOLVED\",",
      "  \"reason_code\": \"UC-OBSERVER-CONFLICT\",",
      "  \"latency_ms\": 324,",
      "  \"hashline\": \"sha256:a7e56027a112327ad0fdccf6fdbf32504056c1dd6c89bcc32e240d4b88a62575\"",
      "}",
    ],
  },
  "/하이레시스/evt/2026/02/19": { type: "dir", children: ["055847.json"] },
  "/하이레시스/evt/2026/02/19/055847.json": {
    type: "file",
    content: [
      "{",
      "  \"event_id\": \"evt-20260219-055847\",",
      "  \"ts\": \"2026-02-19T05:58:47+09:00\",",
      "  \"input_ref\": \"req-a2de77\",",
      "  \"rule_ref\": [\"R-01\", \"R-05\", \"R-13\"],",
      "  \"decision_result\": \"UNRESOLVED\",",
      "  \"reason_code\": \"UC-REPRO-NOT-POSSIBLE\",",
      "  \"latency_ms\": 411,",
      "  \"hashline\": \"sha256:aa52115f72fcb212b55bf0f5f0d00ef4fc469497cf204728f1a47f8658c357ec\"",
      "}",
    ],
  },
};

/**
 * 파일 메타데이터(표시용).
 * path -> size/date/time/attr/flagged
 */
var LOG_META = {
  "/하이레시스": { date: "26-02-19", time: "06:02", attr: "DIR,RO" },
  "/하이레시스/.운영기준": { date: "26-02-19", time: "06:03", attr: "DIR,RO" },
  "/하이레시스/evt": { date: "26-02-19", time: "06:03", attr: "DIR,RO" },
  "/하이레시스/evt/2026": { date: "26-02-19", time: "06:03", attr: "DIR,RO" },
  "/하이레시스/evt/2026/01": { date: "26-02-19", time: "06:03", attr: "DIR,RO" },
  "/하이레시스/evt/2026/02": { date: "26-02-19", time: "06:03", attr: "DIR,RO" },
  "/하이레시스/evt/2026/01/20": { date: "26-01-20", time: "09:14", attr: "DIR,RO" },
  "/하이레시스/evt/2026/01/27": { date: "26-01-27", time: "18:02", attr: "DIR,RO" },
  "/하이레시스/evt/2026/02/03": { date: "26-02-03", time: "07:41", attr: "DIR,RO" },
  "/하이레시스/evt/2026/02/08": { date: "26-02-08", time: "10:44", attr: "DIR,RO" },
  "/하이레시스/evt/2026/02/10": { date: "26-02-10", time: "21:27", attr: "DIR,RO" },
  "/하이레시스/evt/2026/02/17": { date: "26-02-17", time: "13:06", attr: "DIR,RO" },
  "/하이레시스/evt/2026/02/19": { date: "26-02-19", time: "05:58", attr: "DIR,RO" },
  "/하이레시스/evt/2026/01/20/091422.json": { size: 1198, date: "26-01-20", time: "09:14", attr: "RO,DATA" },
  "/하이레시스/evt/2026/01/27/180209.json": { size: 1212, date: "26-01-27", time: "18:02", attr: "RO,DATA" },
  "/하이레시스/evt/2026/02/03/074155.json": { size: 1244, date: "26-02-03", time: "07:41", attr: "RO,DATA" },
  "/하이레시스/evt/2026/02/08/104402.json": { size: 1178, date: "26-02-08", time: "10:44", attr: "RO,DATA" },
  "/하이레시스/evt/2026/02/10/212738.json": { size: 1202, date: "26-02-10", time: "21:27", attr: "RO,DATA" },
  "/하이레시스/evt/2026/02/17/130611.json": { size: 1268, date: "26-02-17", time: "13:06", attr: "RO,DATA" },
  "/하이레시스/evt/2026/02/19/055847.json": { size: 1282, date: "26-02-19", time: "05:58", attr: "RO,DATA" },
  "/하이레시스/.운영기준/감사요건 프롬프트.txt": { size: 2864, date: "26-02-19", time: "06:04", attr: "RO,LOG", flagged: true },
  "/하이레시스/.운영기준/관측기록": { date: "26-02-19", time: "06:05", attr: "DIR,RO" },
  "/하이레시스/.운영기준/판별불가": { date: "26-02-19", time: "06:06", attr: "DIR,RO" },
  "/하이레시스/.운영기준/관측기록/decision_260120.log": { size: 1348, date: "26-01-20", time: "09:14", attr: "RO,LOG" },
  "/하이레시스/.운영기준/관측기록/decision_260127.log": { size: 1351, date: "26-01-27", time: "18:02", attr: "RO,LOG" },
  "/하이레시스/.운영기준/관측기록/decision_260203.log": { size: 1378, date: "26-02-03", time: "07:41", attr: "RO,LOG" },
  "/하이레시스/.운영기준/관측기록/decision_260210.log": { size: 1346, date: "26-02-10", time: "21:27", attr: "RO,LOG" },
  "/하이레시스/.운영기준/관측기록/decision_260217.log": { size: 1392, date: "26-02-17", time: "13:06", attr: "RO,LOG" },
  "/하이레시스/.운영기준/관측기록/decision_260219.log": { size: 1408, date: "26-02-19", time: "05:58", attr: "RO,LOG" },
  "/하이레시스/.운영기준/관측기록/uncertainty_register_2601_2602.csv": { size: 1882, date: "26-02-19", time: "05:59", attr: "RO,DATA" },
  "/하이레시스/.운영기준/관측기록/rulebook_applied_v2.json": { size: 1194, date: "26-02-19", time: "06:00", attr: "RO,DATA" },
  "/하이레시스/.운영기준/관측기록/monthly_audit_note_2602.txt": { size: 924, date: "26-02-19", time: "06:01", attr: "RO,NOTE" },
  "/하이레시스/.운영기준/판별불가/reason_ambiguous.log": { size: 1122, date: "26-02-08", time: "10:44", attr: "RO,LOG" },
  "/하이레시스/.운영기준/판별불가/reason_unprovable.log": { size: 1184, date: "26-02-03", time: "07:43", attr: "RO,LOG" },
  "/하이레시스/.운영기준/판별불가/reason_observer_conflict.log": { size: 1193, date: "26-02-17", time: "13:08", attr: "RO,LOG" },
  "/하이레시스/.운영기준/판별불가/reason_recursive_lock.log": { size: 1202, date: "26-02-19", time: "06:00", attr: "RO,LOG" },
  "/하이레시스/.운영기준/판별불가/counterexample_set.log": { size: 1664, date: "26-02-19", time: "06:01", attr: "RO,LOG" },
  "/하이레시스/.운영기준/판별불가/audit_summary.txt": { size: 1042, date: "26-02-19", time: "06:02", attr: "RO,NOTE", flagged: true },
};

// ----- 입력/초기화 이벤트 -----

/** 터미널 입력창에서 명령 히스토리(↑/↓) 탐색을 처리한다. */
function handleInputKeydown(keyEvent) {
  if (!state.inputEnabled) {
    return;
  }

  if (keyEvent.key === "ArrowUp") {
    keyEvent.preventDefault();
    navigateHistory(-1);
    return;
  }

  if (keyEvent.key === "ArrowDown") {
    keyEvent.preventDefault();
    navigateHistory(1);
  }
}

/** 터미널 폼 제출 시 현재 입력을 명령 처리기로 전달한다. */
function handleInputSubmit(submitEvent) {
  submitEvent.preventDefault();
  if (!canUseTerminalInput()) {
    return;
  }

  var rawInput = elements.input.value;
  elements.input.value = "";
  processUserInput(rawInput);
}

/** DOM이 준비되면 요소 캐싱, 이벤트 바인딩, 시작 시퀀스를 초기화한다. */
function handleDomContentLoaded() {
  cacheElements();
  bindInputEvents();
  renderAuditMonitor();
  startFtpLinkTicker();
  startOpeningSequence();
}

/** 자주 접근하는 DOM 노드를 elements 캐시에 저장한다. */
function cacheElements() {
  elements.log = document.getElementById("terminal-log");
  elements.controls = document.getElementById("controls-panel");
  elements.authOverlay = document.getElementById("auth-overlay");
  elements.authForm = document.getElementById("auth-form");
  elements.authUsername = document.getElementById("auth-username");
  elements.authPassword = document.getElementById("auth-password");
  elements.authError = document.getElementById("auth-error");
  elements.authStatus = document.getElementById("auth-status");
  elements.systemOverlay = document.getElementById("system-overlay");
  elements.systemBootLog = document.getElementById("system-boot-log");
  elements.systemStatus = document.getElementById("system-status");
  elements.terminalWorkspace = document.getElementById("terminal-workspace");
  elements.terminalPane = document.getElementById("terminal-pane");
  elements.investigationPanel = document.getElementById("investigation-panel");
  elements.investigationLinkChip = document.getElementById("investigation-link-chip");
  elements.investigationPath = document.getElementById("investigation-path");
  elements.investigationList = document.getElementById("investigation-list");
  elements.investigationEditButton = document.getElementById("investigation-edit-button");
  elements.investigationDownloadButton = document.getElementById("investigation-download-button");
  elements.investigationContent = document.getElementById("investigation-content");
  elements.auditMonitor = document.getElementById("audit-monitor");
  elements.auditRefreshButton = document.getElementById("audit-refresh-button");
  elements.auditKpiGrid = document.getElementById("audit-kpi-grid");
  elements.auditAnomalyList = document.getElementById("audit-anomaly-list");
  elements.auditDownloadAll = document.getElementById("audit-download-all");
  elements.previewDownloadAll = document.getElementById("preview-download-all");
  elements.previewDownloadList = document.getElementById("preview-download-list");
  elements.thresholdUnresolved = document.getElementById("threshold-unresolved");
  elements.thresholdLatency = document.getElementById("threshold-latency");
  elements.terminalPathbar = document.getElementById("terminal-pathbar");
  elements.input = document.getElementById("command-input");
  elements.submit = document.querySelector(".submit-button");
  elements.form = document.getElementById("input-form");
}

/** 폼 제출/클릭/스크롤 등 사용자 이벤트를 연결한다. */
function bindInputEvents() {
  elements.form.addEventListener("submit", handleInputSubmit);
  elements.input.addEventListener("keydown", handleInputKeydown);
  if (elements.investigationList) {
    elements.investigationList.addEventListener("click", handleInvestigationItemClick);
  }
  if (elements.investigationEditButton) {
    elements.investigationEditButton.addEventListener("click", handleInvestigationEditClick);
  }
  if (elements.investigationDownloadButton) {
    elements.investigationDownloadButton.addEventListener("click", handleInvestigationDownloadClick);
  }
  if (elements.auditRefreshButton) {
    elements.auditRefreshButton.addEventListener("click", handleAuditRefreshClick);
  }
  if (elements.auditDownloadAll) {
    elements.auditDownloadAll.addEventListener("click", handleAuditDownloadAllClick);
  }
  if (elements.previewDownloadAll) {
    elements.previewDownloadAll.addEventListener("click", handlePreviewDownloadAllClick);
  }
  if (elements.auditAnomalyList) {
    elements.auditAnomalyList.addEventListener("click", handleAuditAnomalyListClick);
  }
  if (elements.previewDownloadList) {
    elements.previewDownloadList.addEventListener("click", handlePreviewDownloadListClick);
  }
  if (elements.thresholdUnresolved) {
    elements.thresholdUnresolved.addEventListener("input", renderAuditMonitor);
  }
  if (elements.thresholdLatency) {
    elements.thresholdLatency.addEventListener("input", renderAuditMonitor);
  }
  if (elements.authForm) {
    elements.authForm.addEventListener("submit", handleAuthFormSubmit);
  }
  if (elements.log) {
    elements.log.addEventListener("scroll", handleLogScroll);
  }
}

// ----- 부팅/인증/세션 attach 흐름 -----

/** 부팅 시퀀스 시작: UI를 분리 상태로 놓고 시스템 오버레이를 활성화한다. */
function startOpeningSequence() {
  setFlowPhase(FLOW_PHASE.BOOTING);
  state.openingIndex = 0;
  setTerminalConnected(false);
  setInvestigationPanelVisible(true);
  setTerminalPathbar(state.investigationCwd);
  renderInvestigationPanel("channel detached. login required to access remote archive.");
  setSystemOverlayVisible(true);
  setSystemStatus("INITIALIZING");
  setInputEnabled(false);
  clearLog();
  setBootLogText("");
  appendLogLine("[SYSTEM] terminal detached. waiting gateway boot.", "log-muted");
  scheduleNextOpeningLine();
}

/** OPENING_SEQUENCE를 한 줄씩 시스템 부트 로그로 출력한다. */
function scheduleNextOpeningLine() {
  var openingLine = OPENING_SEQUENCE[state.openingIndex];
  if (!openingLine) {
    finishOpeningSequence();
    return;
  }

  appendBootLine(openingLine.text);
  state.openingIndex += 1;
  setTimeout(scheduleNextOpeningLine, openingLine.delay);
}

/** 부팅 완료 후 로그인 콘솔로 자연스럽게 전환한다. */
function finishOpeningSequence() {
  setSystemStatus("BOOT COMPLETE");
  setTimeout(function openLoginAfterBoot() {
    setSystemOverlayVisible(false);
    beginFtpAuthFlow();
  }, 260);
}

/** 로그인 콘솔 초기화 및 입력 포커스 이동. */
function beginFtpAuthFlow() {
  setFlowPhase(FLOW_PHASE.LOGIN_REQUIRED);
  setInputEnabled(false);
  setTerminalConnected(false);
  setAuthOverlayVisible(true);
  setAuthCardMode("");
  setAuthStatus("AWAITING CREDENTIALS");
  setAuthFormEnabled(true);

  if (elements.authError) {
    elements.authError.textContent = "";
  }
  if (elements.authForm) {
    elements.authForm.reset();
  }
  if (elements.authUsername) {
    elements.authUsername.focus();
  }
}

/**
 * 인증 제출 처리.
 * 성공 시 ATTACHING 연출을 거쳐 STREAMING으로 전환한다.
 */
function handleAuthFormSubmit(submitEvent) {
  submitEvent.preventDefault();

  if (state.phase !== FLOW_PHASE.LOGIN_REQUIRED) {
    return;
  }

  var username = elements.authUsername ? String(elements.authUsername.value || "").trim() : "";
  var password = elements.authPassword ? String(elements.authPassword.value || "").trim() : "";

  if (!username || !password) {
    setAuthCardMode("is-error");
    setAuthStatus("INPUT REQUIRED");
    if (elements.authError) {
      elements.authError.textContent = "Username and password are required.";
    }
    setTimeout(function resetAuthPrompt() {
      setAuthCardMode("");
      setAuthStatus("AWAITING CREDENTIALS");
    }, 260);
    return;
  }

  setAuthCardMode("is-connecting");
  setAuthStatus("AUTHENTICATING");
  setAuthFormEnabled(false);

  if (username === FTP_LOGIN_USER && password === FTP_LOGIN_PASS) {
    setTimeout(function completeAuthSuccess() {
      setFlowPhase(FLOW_PHASE.ATTACHING);
      setAuthCardMode("is-success");
      setAuthStatus("SESSION ESTABLISHED");
      appendLogLine("[AUTH] session established.", "log-success");

      setTimeout(function attachStage() {
        setAuthStatus("TERMINAL ATTACHING");
        appendLogLine("[AUTH] attaching terminal channel...", "log-muted");
      }, 180);

      setTimeout(function enterFtpSession() {
        setAuthOverlayVisible(false);
        setTerminalConnected(true);
        setFlowPhase(FLOW_PHASE.STREAMING);
        startInvestigationMode();
      }, 460);
    }, 420);
    return;
  }

  setTimeout(function completeAuthFailure() {
    setAuthCardMode("is-error");
    setAuthStatus("AUTH FAILED");
    setAuthFormEnabled(true);
    if (elements.authError) {
      elements.authError.textContent = "Login failed. Check username/password.";
    }
    if (elements.authPassword) {
      elements.authPassword.value = "";
      elements.authPassword.focus();
    }
    setTimeout(function resetFailedState() {
      setAuthCardMode("");
      setAuthStatus("AWAITING CREDENTIALS");
    }, 280);
  }, 360);
}

/** 로그인 콘솔 표시/숨김. */
function setAuthOverlayVisible(visible) {
  if (elements.authOverlay) {
    elements.authOverlay.classList.toggle("is-hidden", !visible);
  }
}

/** 로그인 콘솔 상태 텍스트 갱신. */
function setAuthStatus(text) {
  if (elements.authStatus) {
    elements.authStatus.textContent = text || "";
  }
}

/** 로그인 카드 상태 클래스(is-connecting/is-success/is-error) 전환. */
function setAuthCardMode(mode) {
  if (!elements.authForm) {
    return;
  }

  elements.authForm.classList.remove("is-connecting", "is-success", "is-error");
  if (mode) {
    elements.authForm.classList.add(mode);
  }
}

/** 로그인 입력필드/버튼 비활성화 제어. */
function setAuthFormEnabled(enabled) {
  if (elements.authUsername) {
    elements.authUsername.disabled = !enabled;
  }
  if (elements.authPassword) {
    elements.authPassword.disabled = !enabled;
  }
  if (elements.authForm) {
    var submit = elements.authForm.querySelector(".auth-submit");
    if (submit) {
      submit.disabled = !enabled;
    }
  }
}

// ----- FTP 세션/명령 진입 -----

/** 인증 이후 FTP 세션 도입 로그를 순차 출력하고 입력을 연다. */
function startInvestigationMode() {
  var introLines = [
    { text: "Connected to hyresis.local (read-only).", tone: "log-success" },
    { text: "Login successful: observer", tone: "log-muted" },
    { text: "Type 'help' to see commands.", tone: "log-muted" },
  ];
  var index = 0;

  state.investigationBooting = true;
  state.investigationCwd = "/하이레시스";
  setInputEnabled(false);
  setTerminalPathbar(state.investigationCwd);
  setInvestigationPanelVisible(true);
  setInvestigationPreview("항목을 클릭해 내용을 확인하세요.", "", []);
  renderInvestigationPanel();

  function streamNextIntroLine() {
    var line = introLines[index];
    if (!line) {
      appendLogLine("Mission: inspect archive folders and infer cause of self-invalidation.", "log-warn");
      appendLogLine("Commands: ls, cd, cat, pwd, help, view [file], verify hashline, audit, puzzle", "log-muted");
      appendLogLine("Workflow: preview with cat, then open in view.", "log-muted");
      renderAuditMonitor();
      state.investigationBooting = false;
      setInputEnabled(true);
      return;
    }

    appendLogLine(line.text, line.tone);
    index += 1;
    setTimeout(streamNextIntroLine, 140);
  }

  setTimeout(streamNextIntroLine, 120);
}

/** 입력 라우터: 현재는 FTP 명령 처리기로만 위임한다. */
function processUserInput(rawInput) {
  handleInvestigationCommand(rawInput);
}

/**
 * FTP 셸 명령 파서/디스패처.
 * 지원 명령: help, pwd, ls, cd, cat, view, verify, audit, puzzle
 */
function handleInvestigationCommand(rawInput) {
  var trimmed = String(rawInput || "").trim();
  var parts = trimmed ? trimmed.split(/\s+/) : [];
  var command = parts[0] ? parts[0].toLowerCase() : "";
  var arg = parts.length > 1 ? trimmed.slice(parts[0].length).trim() : "";

  if (state.investigationBooting || !command) {
    return;
  }

  appendLogLine("observer@hyresis:" + buildShellPromptPath() + "$ " + trimmed, "log-emphasis");
  saveInputHistory(trimmed);

  if (command === "help") {
    appendLogLine("Syntax: ls [path] | cd <path> | cat <file> | pwd | view [file] | verify hashline [path|selected|all] | audit | puzzle", "log-muted");
    appendLogLine("audit -> threshold monitor refresh and summary", "log-muted");
    appendLogLine("verify hashline -> check hashline integrity for preview/selected/all", "log-muted");
    return;
  }

  if (command === "pwd") {
    appendLogLine(buildFtpPath(state.investigationCwd), "log-muted");
    return;
  }

  if (command === "ls") {
    listFs(arg || state.investigationCwd);
    return;
  }

  if (command === "cd") {
    if (!arg) {
      appendLogLine("usage: cd <path>", "log-warn");
      return;
    }
    changeDirectory(arg);
    return;
  }

  if (command === "cat") {
    if (!arg) {
      appendLogLine("usage: cat <file>", "log-warn");
      return;
    }
    readFile(arg);
    return;
  }

  if (command === "view" || command === "vim" || command === "vi" || command === "edit") {
    if (arg) {
      readFile(arg, { openVim: true });
      return;
    }
    if (previewFilePath) {
      openPreviewInTerminalVim(previewFilePath, previewFileLines);
      return;
    }
    appendLogLine("no preview buffer. use cat <file> first or view <file>.", "log-warn");
    return;
  }

  if (command === "puzzle" || command === "/puzzle") {
    openPuzzleGatewayPlaceholder();
    return;
  }

  if (command === "audit") {
    runAuditSummaryCommand();
    return;
  }

  if (command === "verify") {
    runVerifyCommand(arg);
    return;
  }

  appendLogLine("unknown command: " + command, "log-warn");
}

/** 퍼즐 시스템 재기획 전까지 유지되는 placeholder 엔드포인트. */
function openPuzzleGatewayPlaceholder() {
  appendLogLine("[PUZZLE] gateway endpoint exists.", "log-warn");
  appendLogLine("[PUZZLE] current runtime disabled for refactor.", "log-muted");
  appendLogLine("[PUZZLE] re-planning pending.", "log-muted");
}

/** audit 명령: 임계치 모니터를 갱신하고 핵심 수치를 출력한다. */
function runAuditSummaryCommand() {
  var thresholds = getAuditThresholds();
  var records = collectDecisionRecords();
  var unresolvedCount = records.filter(function isUnresolved(record) {
    return record.decisionResult === "UNRESOLVED";
  }).length;
  var unresolvedRate = records.length > 0 ? (unresolvedCount / records.length) * 100 : 0;
  var p95Latency = computePercentile(
    records.map(function pickLatency(record) {
      return record.latencyMs;
    }),
    0.95
  );

  renderAuditMonitor();
  appendLogLine("[AUDIT] total=" + records.length, "log-muted");
  appendLogLine("[AUDIT] unresolved=" + unresolvedRate.toFixed(1) + "% (threshold " + thresholds.unresolvedPercent.toFixed(1) + "%)", "log-muted");
  appendLogLine("[AUDIT] p95 latency=" + Math.round(p95Latency) + "ms (threshold " + Math.round(thresholds.latencyMs) + "ms)", "log-muted");
  appendLogLine("[AUDIT] anomaly windows=" + auditAnomalyGroups.length, "log-muted");
}

/** verify 명령: hashline 무결성을 검증한다. */
function runVerifyCommand(arg) {
  var safeArg = String(arg || "").trim();
  var parts = safeArg ? safeArg.split(/\s+/) : [];
  var subcommand = parts[0] ? parts[0].toLowerCase() : "";
  var targetRaw = parts.length > 1 ? safeArg.slice(parts[0].length).trim() : "";
  var targets = [];

  if (subcommand !== "hashline") {
    appendLogLine("usage: verify hashline [path|selected|all]", "log-warn");
    return;
  }

  if (!targetRaw) {
    if (previewFilePath) {
      targets.push(normalizePath(previewFilePath));
    } else if (previewDownloadQueue.length > 0) {
      targets = previewDownloadQueue.map(function toPath(item) {
        return normalizePath(item.path || "");
      });
    } else {
      appendLogLine("no target. preview a file or use: verify hashline all", "log-warn");
      return;
    }
  } else if (targetRaw.toLowerCase() === "selected") {
    if (previewDownloadQueue.length === 0) {
      appendLogLine("selected queue is empty.", "log-warn");
      return;
    }
    targets = previewDownloadQueue.map(function toPath(item) {
      return normalizePath(item.path || "");
    });
  } else if (targetRaw.toLowerCase() === "all") {
    targets = collectAllHashlinePaths();
  } else {
    targets.push(normalizePath(targetRaw));
  }

  runHashlineVerification(targets);
}

/** hashline 필드를 가진 파일 경로를 전체 FS에서 수집한다. */
function collectAllHashlinePaths() {
  var paths = Object.keys(LOG_FS);
  var index = 0;
  var targets = [];

  while (index < paths.length) {
    var path = paths[index];
    var entry = LOG_FS[path];
    var lines = entry && Array.isArray(entry.content) ? entry.content : [];
    var joined = lines.join("\n");

    if (entry && entry.type === "file") {
      if (/^hashline=/m.test(joined) || /"hashline"\s*:/.test(joined)) {
        targets.push(path);
      }
    }
    index += 1;
  }

  targets.sort();
  return targets;
}

/** 선택된 경로 목록의 hashline 검증을 순차 실행한다. */
async function runHashlineVerification(paths) {
  var uniquePaths = Array.from(new Set((paths || []).filter(Boolean)));
  var index = 0;
  var passCount = 0;
  var failCount = 0;
  var skipCount = 0;

  appendLogLine("[VERIFY] hashline start (" + uniquePaths.length + " files)", "log-muted");
  while (index < uniquePaths.length) {
    var result = await verifyHashlineForPath(uniquePaths[index]);
    if (result.status === "PASS") {
      passCount += 1;
      appendLogLine("[VERIFY] PASS " + result.path, "log-success");
    } else if (result.status === "FAIL") {
      failCount += 1;
      appendLogLine("[VERIFY] FAIL " + result.path + " expected=" + result.expected + " actual=" + result.actual, "log-alert");
    } else {
      skipCount += 1;
      appendLogLine("[VERIFY] SKIP " + result.path + " (" + result.reason + ")", "log-warn");
    }
    index += 1;
  }

  appendLogLine("[VERIFY] done pass=" + passCount + " fail=" + failCount + " skip=" + skipCount, failCount > 0 ? "log-alert" : "log-muted");
}

/** 단일 파일의 hashline 값을 다시 계산해 비교한다. */
async function verifyHashlineForPath(path) {
  var normalized = normalizePath(path);
  var entry = LOG_FS[normalized];
  var payload = null;
  var expected = "";
  var actual = "";

  if (!entry || entry.type !== "file" || !Array.isArray(entry.content)) {
    return { status: "SKIP", path: normalized, reason: "file not found" };
  }

  payload = extractHashlinePayload(entry.content);
  if (!payload.expected || !payload.payload) {
    return { status: "SKIP", path: normalized, reason: payload.reason || "no hashline" };
  }

  actual = "sha256:" + (await sha256Hex(payload.payload));
  expected = normalizeHashline(payload.expected);
  if (actual === expected) {
    return { status: "PASS", path: normalized, expected: expected, actual: actual };
  }

  return { status: "FAIL", path: normalized, expected: expected, actual: actual };
}

/** 파일 내용에서 hashline과 해시 대상 payload를 추출한다. */
function extractHashlinePayload(lines) {
  var safeLines = Array.isArray(lines) ? lines.slice() : [];
  var joined = safeLines.join("\n");
  var isJsonLike = safeLines.length > 0 && safeLines[0].trim() === "{";
  var expected = "";
  var payload = "";

  if (isJsonLike) {
    try {
      var parsed = JSON.parse(joined);
      if (!parsed || typeof parsed !== "object" || !parsed.hashline) {
        return { expected: "", payload: "", reason: "json has no hashline" };
      }
      expected = String(parsed.hashline || "");
      delete parsed.hashline;
      payload = stableStringify(parsed);
      return { expected: expected, payload: payload, reason: "" };
    } catch (error) {
      return { expected: "", payload: "", reason: "json parse failed" };
    }
  }

  var filtered = [];
  var index = 0;
  while (index < safeLines.length) {
    var line = String(safeLines[index] || "");
    if (line.indexOf("hashline=") === 0) {
      expected = line.slice("hashline=".length).trim();
    } else {
      filtered.push(line);
    }
    index += 1;
  }

  if (!expected) {
    return { expected: "", payload: "", reason: "no hashline field" };
  }

  payload = filtered.join("\n");
  return { expected: expected, payload: payload, reason: "" };
}

/** hashline 표현을 sha256:hex 포맷으로 정규화한다. */
function normalizeHashline(value) {
  var text = String(value || "").trim().toLowerCase();
  if (!text) {
    return "";
  }
  if (text.indexOf("sha256:") === 0) {
    return text;
  }
  return "sha256:" + text;
}

/** 객체 키 순서를 고정해 일관된 문자열을 만든다. */
function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  var keys = Object.keys(value).sort();
  var parts = keys.map(function toPair(key) {
    return JSON.stringify(key) + ":" + stableStringify(value[key]);
  });
  return "{" + parts.join(",") + "}";
}

/** 브라우저 crypto.subtle로 sha-256 hex를 계산한다. */
async function sha256Hex(text) {
  var encoder = new TextEncoder();
  var data = encoder.encode(String(text || ""));
  var digest = await crypto.subtle.digest("SHA-256", data);
  var bytes = Array.from(new Uint8Array(digest));
  return bytes.map(function toHex(byte) {
    return byte.toString(16).padStart(2, "0");
  }).join("");
}

// ----- 연결 상태/공통 UI 토글 -----

/** 좌측 패널 링크 지연값을 주기적으로 갱신한다(분위기 연출용). */
function updateFtpLinkChip() {
  if (!elements.investigationLinkChip) {
    return;
  }

  var latency = 70 + Math.floor(Math.random() * 71);
  elements.investigationLinkChip.textContent = "LINK: SECURE/" + latency + "ms";
}

/** 링크 지연값 ticker 시작(중복 시작 방지). */
function startFtpLinkTicker() {
  if (!elements.investigationLinkChip || ftpLinkTimer) {
    return;
  }
  updateFtpLinkChip();
  ftpLinkTimer = setInterval(updateFtpLinkChip, 1200);
}

/** 좌측 탐색 패널 표시 상태 제어. */
function setInvestigationPanelVisible(visible) {
  var isVisible = Boolean(visible);

  if (!elements.investigationPanel) {
    return;
  }

  elements.investigationPanel.classList.toggle("is-visible", isVisible);
  if (elements.terminalWorkspace) {
    elements.terminalWorkspace.classList.toggle("investigation-collapsed", !isVisible);
  }
}

/** 터미널 연결/분리 상태 클래스 토글. */
function setTerminalConnected(connected) {
  var isConnected = Boolean(connected);

  if (elements.terminalWorkspace) {
    elements.terminalWorkspace.classList.toggle("is-disconnected", !isConnected);
  }
  if (elements.terminalPane) {
    elements.terminalPane.classList.toggle("is-disconnected", !isConnected);
  }
}

/** 커맨드 입력 활성화 토글(포커스 포함). */
function setInputEnabled(enabled) {
  state.inputEnabled = enabled;
  if (elements.input) {
    elements.input.disabled = !enabled;
  }
  if (elements.submit) {
    elements.submit.disabled = !enabled;
  }
  if (enabled && elements.input) {
    elements.input.focus();
  }
}

/** 시스템 부팅 오버레이 표시 상태 제어. */
function setSystemOverlayVisible(visible) {
  if (!elements.systemOverlay) {
    return;
  }
  elements.systemOverlay.classList.toggle("is-hidden", !visible);
}

/** 시스템 부팅 상태 텍스트 갱신. */
function setSystemStatus(text) {
  if (elements.systemStatus) {
    elements.systemStatus.textContent = text || "";
  }
}

/** 시스템 부트 로그 영역 전체 텍스트 교체. */
function setBootLogText(text) {
  if (!elements.systemBootLog) {
    return;
  }
  elements.systemBootLog.textContent = text || "";
}

/** 시스템 부트 로그에 한 줄 추가하고 하단으로 스크롤한다. */
function appendBootLine(line) {
  var current = elements.systemBootLog ? elements.systemBootLog.textContent : "";
  var next = current ? current + "\n" + line : line;
  setBootLogText(next);
  if (elements.systemBootLog) {
    elements.systemBootLog.scrollTop = elements.systemBootLog.scrollHeight;
  }
}

// ----- 경로/포맷 유틸 -----

/** 파일명에서 확장자(대문자)를 추출한다. */
function getFileExt(name) {
  var text = String(name || "");
  var dot = text.lastIndexOf(".");
  if (dot <= 0 || dot === text.length - 1) {
    return "";
  }
  return text.slice(dot + 1).toUpperCase();
}

/** 파일 목록 표시에 사용할 정수형 크기 문자열 포맷터. */
function formatFsSize(size, isDir) {
  if (isDir) {
    return "";
  }

  var value = Number(size || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }
  return String(Math.floor(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 전송 상태 표시에 사용할 사람이 읽기 쉬운 용량 포맷터. */
function formatTransferSize(bytes) {
  var value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  if (value < 1024) {
    return value + " B";
  }
  if (value < 1024 * 1024) {
    return (value / 1024).toFixed(1) + " KB";
  }
  return (value / (1024 * 1024)).toFixed(2) + " MB";
}

/**
 * 상대/절대 경로를 현재 cwd 기준으로 정규화한다.
 * ".", ".." 토큰을 처리해 항상 절대 경로를 반환한다.
 */
function normalizePath(path) {
  var raw = String(path || "").trim();
  var base = state.investigationCwd || "/하이레시스";
  var parts = [];
  var tokens = [];
  var index = 0;

  if (!raw || raw === ".") {
    return base;
  }

  if (raw.indexOf("/") === 0) {
    tokens = raw.split("/");
  } else {
    tokens = (base + "/" + raw).split("/");
  }

  while (index < tokens.length) {
    var token = tokens[index];
    if (!token || token === ".") {
      index += 1;
      continue;
    }
    if (token === "..") {
      if (parts.length > 0) {
        parts.pop();
      }
      index += 1;
      continue;
    }
    parts.push(token);
    index += 1;
  }

  return "/" + parts.join("/");
}

/** 정규화된 path로 가상 FS 엔트리를 조회한다. */
function resolveFsEntry(path) {
  return LOG_FS[normalizePath(path)] || null;
}

/** 내부 path를 ftp://hyresis.local 경로로 변환한다. */
function buildFtpPath(path) {
  var normalized = normalizePath(path);
  var ftpPath = normalized.replace("/하이레시스", "") || "/";
  return "ftp://hyresis.local" + ftpPath;
}

/** 프롬프트 경로 표시용(루트 /하이레시스를 ~로 축약). */
function buildShellPromptPath() {
  var normalized = normalizePath(state.investigationCwd || "/하이레시스");
  var promptPath = normalized.replace("/하이레시스", "~");
  return promptPath || "~";
}

/** 상단 pathbar에 현재 작업 모드(::transfer/preview/view)를 반영한다. */
function setTerminalPathbar(path, mode) {
  var normalized = normalizePath(path || state.investigationCwd || "/하이레시스");
  var logicalPath = normalized.replace("/하이레시스", "/archive");
  var base = "/hyresis/gateway";
  var text = base + (logicalPath || "/archive");

  if (mode === "retr") {
    text += " ::transfer";
  } else if (mode === "preview") {
    text += " ::preview";
  } else if (mode === "view") {
    text += " ::view";
  }

  if (elements.terminalPathbar) {
    elements.terminalPathbar.textContent = text;
  }
}

/** 파일 전송 진행률 막대 문자열 생성. */
function buildLoadingGauge(fill, total) {
  return "[" + "=".repeat(fill) + "-".repeat(total - fill) + "]";
}

/** audit threshold 입력값을 읽어 정규화한다. */
function getAuditThresholds() {
  var unresolvedPercent = elements.thresholdUnresolved ? Number(elements.thresholdUnresolved.value) : 30;
  var latencyMs = elements.thresholdLatency ? Number(elements.thresholdLatency.value) : 220;
  var safeUnresolved = Number.isFinite(unresolvedPercent) ? Math.min(100, Math.max(0, unresolvedPercent)) : 30;
  var safeLatency = Number.isFinite(latencyMs) ? Math.max(1, latencyMs) : 220;

  return {
    unresolvedRate: safeUnresolved / 100,
    unresolvedPercent: safeUnresolved,
    latencyMs: safeLatency,
  };
}

/** 프리뷰로 선택된 decision 로그를 파싱해 감사 모니터링용 레코드 배열을 생성한다. */
function collectDecisionRecords() {
  var records = [];
  var index = 0;

  if (previewDownloadQueue.length === 0) {
    return records;
  }

  while (index < previewDownloadQueue.length) {
    var selected = previewDownloadQueue[index];
    var parsed = parseDecisionLog(selected && selected.lines ? selected.lines : []);
    var hasDecision = Boolean(parsed.decision_result);
    var path = selected && selected.path ? selected.path : "";
    var ts = parsed.ts || "";
    var dateOnly = ts ? ts.slice(0, 10) : "unknown";

    if (hasDecision) {
      records.push({
        name: path.split("/").pop() || "",
        path: path,
        ts: ts,
        day: dateOnly,
        inputRef: parsed.input_ref || "",
        ruleRef: parsed.rule_ref || "",
        decisionResult: parsed.decision_result || "UNKNOWN",
        reasonCode: parsed.reason_code || "N/A",
        latencyMs: parsed.latency_ms ? Number(parsed.latency_ms) : 0,
        evidenceRef: parsed.evidence_ref || "",
        hashline: parsed.hashline || "",
        rawLines: selected.lines ? selected.lines.slice() : [],
      });
    }

    index += 1;
  }

  records.sort(function sortByTime(a, b) {
    return a.ts.localeCompare(b.ts);
  });

  return records;
}

/** key=value 라인 기반 log 파일을 파싱한다. */
function parseDecisionLog(lines) {
  var map = {};
  var index = 0;
  var safeLines = Array.isArray(lines) ? lines : [];

  while (index < safeLines.length) {
    var line = String(safeLines[index] || "").trim();
    var eq = line.indexOf("=");
    if (eq > 0) {
      var key = line.slice(0, eq).trim();
      var value = line.slice(eq + 1).trim();
      map[key] = value;
    }
    index += 1;
  }

  return map;
}

/** p-분위수 계산 (예: p=0.95). */
function computePercentile(values, p) {
  var sorted = values
    .filter(function onlyNumber(value) {
      return Number.isFinite(value);
    })
    .slice()
    .sort(function sortAsc(a, b) {
      return a - b;
    });

  if (sorted.length === 0) {
    return 0;
  }

  var rank = Math.ceil(sorted.length * p) - 1;
  var index = Math.min(sorted.length - 1, Math.max(0, rank));
  return sorted[index];
}

/** 레코드 배열에서 사유 코드 최빈값을 찾는다. */
function getTopReasonCode(records) {
  var counter = {};
  var topKey = "N/A";
  var topCount = -1;
  var index = 0;

  while (index < records.length) {
    var code = records[index].reasonCode || "N/A";
    counter[code] = (counter[code] || 0) + 1;
    if (counter[code] > topCount) {
      topCount = counter[code];
      topKey = code;
    }
    index += 1;
  }

  return topKey;
}

/** day 기준으로 묶은 anomaly 그룹을 생성한다. */
function buildAuditAnomalyGroups(records, thresholds) {
  var grouped = {};
  var days = [];
  var groups = [];
  var index = 0;

  while (index < records.length) {
    var day = records[index].day;
    if (!grouped[day]) {
      grouped[day] = [];
      days.push(day);
    }
    grouped[day].push(records[index]);
    index += 1;
  }

  days.sort();
  index = 0;

  while (index < days.length) {
    var key = days[index];
    var dayRecords = grouped[key];
    var unresolvedCount = dayRecords.filter(function isUnresolved(record) {
      return record.decisionResult === "UNRESOLVED";
    }).length;
    var unresolvedRate = dayRecords.length > 0 ? unresolvedCount / dayRecords.length : 0;
    var p95 = computePercentile(
      dayRecords.map(function pickLatency(record) {
        return record.latencyMs;
      }),
      0.95
    );

    if (unresolvedRate >= thresholds.unresolvedRate || p95 >= thresholds.latencyMs) {
      groups.push({
        day: key,
        total: dayRecords.length,
        unresolvedCount: unresolvedCount,
        unresolvedRate: unresolvedRate,
        p95Latency: p95,
        topReason: getTopReasonCode(dayRecords),
        records: dayRecords,
      });
    }

    index += 1;
  }

  return groups;
}

/** 운영자 대시보드 전체를 다시 렌더링한다. */
function renderAuditMonitor() {
  if (!elements.auditKpiGrid || !elements.auditAnomalyList || !elements.previewDownloadList) {
    return;
  }

  var thresholds = getAuditThresholds();
  var records = collectDecisionRecords();
  var unresolvedCount = records.filter(function isUnresolved(record) {
    return record.decisionResult === "UNRESOLVED";
  }).length;
  var unresolvedRate = records.length > 0 ? unresolvedCount / records.length : 0;
  var p95Latency = computePercentile(
    records.map(function pickLatency(record) {
      return record.latencyMs;
    }),
    0.95
  );

  auditAnomalyGroups = buildAuditAnomalyGroups(records, thresholds);
  renderAuditKpis(records.length, unresolvedRate, p95Latency, auditAnomalyGroups.length, thresholds);
  renderAuditAnomalyRows(auditAnomalyGroups, thresholds);
  renderPreviewDownloadList();
  syncAuditDownloadAvailability();
}

/** KPI 카드 렌더링. */
function renderAuditKpis(total, unresolvedRate, p95Latency, anomalyCount, thresholds) {
  var unresolvedPercent = (unresolvedRate * 100).toFixed(1) + "%";
  var unresolvedClass = unresolvedRate >= thresholds.unresolvedRate ? "is-alert" : "";
  var latencyClass = p95Latency >= thresholds.latencyMs ? "is-alert" : "";
  var anomalyClass = anomalyCount > 0 ? "is-alert" : "";
  var unresolvedState = unresolvedClass ? "주의" : "정상";
  var latencyState = latencyClass ? "주의" : "정상";
  var anomalyState = anomalyClass ? "주의" : "정상";

  elements.auditKpiGrid.innerHTML =
    '<div class="audit-kpi-card">' +
    '<div class="audit-kpi-label">선택 파일 판단 건수</div>' +
    '<div class="audit-kpi-value">' + total + "</div>" +
    "</div>" +
    '<div class="audit-kpi-card">' +
    '<div class="audit-kpi-label">판단 보류 비율</div>' +
    '<div class="audit-kpi-value ' + unresolvedClass + '">' + unresolvedPercent + " (" + unresolvedState + ")</div>" +
    "</div>" +
    '<div class="audit-kpi-card">' +
    '<div class="audit-kpi-label">응답 지연 지표(ms)</div>' +
    '<div class="audit-kpi-value ' + latencyClass + '">' + Math.round(p95Latency) + " (" + latencyState + ")</div>" +
    "</div>" +
    '<div class="audit-kpi-card">' +
    '<div class="audit-kpi-label">보류 비율 기준</div>' +
    '<div class="audit-kpi-value">' + thresholds.unresolvedPercent.toFixed(1) + "%</div>" +
    "</div>" +
    '<div class="audit-kpi-card">' +
    '<div class="audit-kpi-label">지연 기준</div>' +
    '<div class="audit-kpi-value">' + Math.round(thresholds.latencyMs) + " ms</div>" +
    "</div>" +
    '<div class="audit-kpi-card">' +
    '<div class="audit-kpi-label">기준 초과 구간 수</div>' +
    '<div class="audit-kpi-value ' + anomalyClass + '">' + anomalyCount + " (" + anomalyState + ")</div>" +
    "</div>";
}

/** anomaly 목록 렌더링. */
function renderAuditAnomalyRows(groups, thresholds) {
  var index = 0;
  var canDownload = state.phase === FLOW_PHASE.STREAMING;

  elements.auditAnomalyList.innerHTML = "";
  if (!groups || groups.length === 0) {
    elements.auditAnomalyList.innerHTML = '<div class="audit-anomaly-empty">현재 임계치 기준 초과 이벤트가 없습니다.</div>';
    return;
  }

  while (index < groups.length) {
    var row = document.createElement("div");
    var unresolvedText = (groups[index].unresolvedRate * 100).toFixed(1) + "%";
    var unresolvedAlert = groups[index].unresolvedRate >= thresholds.unresolvedRate ? "is-alert" : "";
    var latencyAlert = groups[index].p95Latency >= thresholds.latencyMs ? "is-alert" : "";
    row.className = "audit-anomaly-row";
    row.innerHTML =
      '<span class="audit-anomaly-cell">' + groups[index].day + "</span>" +
      '<span class="audit-anomaly-cell ' + unresolvedAlert + '">보류율 ' + unresolvedText + "</span>" +
      '<span class="audit-anomaly-cell ' + latencyAlert + '">지연 ' + Math.round(groups[index].p95Latency) + "ms</span>" +
      '<span class="audit-anomaly-cell">' + groups[index].topReason + "</span>" +
      '<button type="button" class="audit-download-button" data-day="' + groups[index].day + '" ' + (canDownload ? "" : "disabled") + '>원본 로그 다운로드</button>';
    elements.auditAnomalyList.appendChild(row);
    index += 1;
  }
}

/** anomaly 리스트 내 다운로드 버튼 핸들러. */
function handleAuditAnomalyListClick(clickEvent) {
  if (state.phase !== FLOW_PHASE.STREAMING) {
    return;
  }
  var button = clickEvent.target ? clickEvent.target.closest(".audit-download-button") : null;
  if (!button || !button.dataset || !button.dataset.day) {
    return;
  }

  downloadAnomalyBundle(button.dataset.day);
}

/** 수동 새로고침 버튼 핸들러. */
function handleAuditRefreshClick() {
  renderAuditMonitor();
  appendLogLine("[AUDIT] threshold monitor refreshed.", "log-muted");
}

/** 전체 anomaly 구간 raw를 한 번에 다운로드한다. */
function handleAuditDownloadAllClick() {
  if (state.phase !== FLOW_PHASE.STREAMING) {
    return;
  }
  if (!auditAnomalyGroups || auditAnomalyGroups.length === 0) {
    return;
  }

  var allRecords = [];
  var index = 0;
  while (index < auditAnomalyGroups.length) {
    allRecords = allRecords.concat(auditAnomalyGroups[index].records);
    index += 1;
  }

  downloadRawBundleText("anomaly_all_windows", allRecords);
}

/** 지정 day anomaly의 raw 로그 번들을 다운로드한다. */
function downloadAnomalyBundle(day) {
  if (state.phase !== FLOW_PHASE.STREAMING) {
    return;
  }
  var target = null;
  var index = 0;

  while (index < auditAnomalyGroups.length) {
    if (auditAnomalyGroups[index].day === day) {
      target = auditAnomalyGroups[index];
      break;
    }
    index += 1;
  }

  if (!target) {
    return;
  }

  downloadRawBundleText("anomaly_" + day.replace(/-/g, ""), target.records);
}

/** raw 레코드 묶음을 텍스트 파일로 생성/다운로드한다. */
function downloadRawBundleText(name, records) {
  var lines = [];
  var index = 0;
  var filename = (name || "anomaly_bundle") + ".txt";

  lines.push("[RAW_LOG_BUNDLE]");
  lines.push("generated_at=" + new Date().toISOString());
  lines.push("record_count=" + records.length);
  lines.push("");

  while (index < records.length) {
    lines.push("---- " + records[index].path + " ----");
    lines = lines.concat(records[index].rawLines);
    lines.push("");
    index += 1;
  }

  triggerTextDownload(filename, lines.join("\n"));
  appendLogLine("[AUDIT] raw bundle downloaded: " + filename, "log-success");
}

/** 브라우저 파일 다운로드 트리거. */
function triggerTextDownload(filename, text) {
  var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** 감사 관련 다운로드 버튼의 활성화 상태를 접속 상태와 동기화한다. */
function syncAuditDownloadAvailability() {
  var canDownload = state.phase === FLOW_PHASE.STREAMING;
  if (elements.auditDownloadAll) {
    elements.auditDownloadAll.disabled = !canDownload || auditAnomalyGroups.length === 0;
  }
  if (elements.previewDownloadAll) {
    elements.previewDownloadAll.disabled = !canDownload || previewDownloadQueue.length === 0;
  }
}

/** preview 버퍼의 현재 파일을 다운로드 큐에 추가한다. */
function handleInvestigationDownloadClick() {
  if (state.phase !== FLOW_PHASE.STREAMING || !previewFilePath || previewFileLines.length === 0) {
    return;
  }

  var exists = previewDownloadQueue.some(function hasSamePath(item) {
    return item.path === previewFilePath;
  });
  if (exists) {
    appendLogLine("[AUDIT] 이미 선택된 파일입니다: " + buildFtpPath(previewFilePath), "log-warn");
    return;
  }

  previewDownloadQueue.push({
    path: previewFilePath,
    lines: previewFileLines.slice(),
  });
  renderPreviewDownloadList();
  syncAuditDownloadAvailability();
  appendLogLine("[AUDIT] 프리뷰 파일 추가됨: " + buildFtpPath(previewFilePath), "log-success");
}

/** 선택된 프리뷰 파일 목록을 갱신한다. */
function renderPreviewDownloadList() {
  var index = 0;
  if (!elements.previewDownloadList) {
    return;
  }

  elements.previewDownloadList.innerHTML = "";
  if (previewDownloadQueue.length === 0) {
    elements.previewDownloadList.innerHTML = '<div class="audit-anomaly-empty">아직 추가된 파일이 없습니다.</div>';
    return;
  }

  while (index < previewDownloadQueue.length) {
    var item = previewDownloadQueue[index];
    var row = document.createElement("div");
    row.className = "audit-selected-row";
    row.innerHTML =
      '<div class="audit-selected-name">' + item.path + "</div>" +
      '<button type="button" class="audit-selected-remove" data-remove-path="' + item.path + '">제거</button>';
    elements.previewDownloadList.appendChild(row);
    index += 1;
  }
}

/** 선택 파일 목록에서 항목 제거. */
function handlePreviewDownloadListClick(clickEvent) {
  var button = clickEvent.target ? clickEvent.target.closest(".audit-selected-remove") : null;
  if (!button || !button.dataset || !button.dataset.removePath) {
    return;
  }

  previewDownloadQueue = previewDownloadQueue.filter(function keepOthers(item) {
    return item.path !== button.dataset.removePath;
  });
  renderPreviewDownloadList();
  syncAuditDownloadAvailability();
}

/** 선택된 프리뷰 파일 묶음을 다운로드한다. */
function handlePreviewDownloadAllClick() {
  if (state.phase !== FLOW_PHASE.STREAMING || previewDownloadQueue.length === 0) {
    return;
  }

  var lines = [];
  var index = 0;
  var filename = "selected_preview_bundle.txt";

  lines.push("[SELECTED_PREVIEW_BUNDLE]");
  lines.push("generated_at=" + new Date().toISOString());
  lines.push("file_count=" + previewDownloadQueue.length);
  lines.push("");

  while (index < previewDownloadQueue.length) {
    lines.push("---- " + previewDownloadQueue[index].path + " ----");
    lines = lines.concat(previewDownloadQueue[index].lines);
    lines.push("");
    index += 1;
  }

  triggerTextDownload(filename, lines.join("\n"));
  appendLogLine("[AUDIT] 선택 프리뷰 묶음 다운로드 완료: " + filename, "log-success");
}

// ----- 파일 패널 렌더링/상호작용 -----

/** 파일 리스트 행(button) DOM을 생성한다. */
function buildInvestigationRowButton(options) {
  var button = document.createElement("button");
  var nameCell = document.createElement("span");
  var extCell = document.createElement("span");
  var sizeCell = document.createElement("span");
  var dateCell = document.createElement("span");
  var timeCell = document.createElement("span");
  var typeCell = document.createElement("span");
  var type = options && options.type ? options.type : "file";
  var isDir = type === "dir";
  var meta = (options && options.meta) || {};
  var attrText = meta.attr || (isDir ? "DIR,RO" : "RO,LOG");

  button.type = "button";
  button.className = "investigation-item " + (isDir ? "item-dir" : "item-file");
  if (meta.flagged) {
    button.classList.add("item-flagged");
  }
  button.dataset.path = options.path || "";
  button.dataset.kind = type;

  nameCell.className = "investigation-cell col-name";
  nameCell.textContent = options && options.name ? options.name : "";
  extCell.className = "investigation-cell col-ext";
  extCell.textContent = options && options.ext ? options.ext : "";
  sizeCell.className = "investigation-cell col-size";
  sizeCell.textContent = formatFsSize(meta.size, isDir);
  dateCell.className = "investigation-cell col-date";
  dateCell.textContent = meta.date || "--.--.--";
  timeCell.className = "investigation-cell col-time";
  timeCell.textContent = meta.time || "--:--";
  typeCell.className = "investigation-cell col-type";
  typeCell.textContent = attrText;

  button.appendChild(nameCell);
  button.appendChild(extCell);
  button.appendChild(sizeCell);
  button.appendChild(dateCell);
  button.appendChild(timeCell);
  button.appendChild(typeCell);
  return button;
}

/** 현재 디렉터리 자식 목록을 UI 렌더링용 행 데이터로 변환한다. */
function getFsChildrenRows(cwd, entry) {
  var rows = [];
  var index = 0;

  while (index < entry.children.length) {
    var childName = entry.children[index];
    var childPath = normalizePath(cwd + "/" + childName);
    var childEntry = LOG_FS[childPath];
    var type = childEntry && childEntry.type === "dir" ? "dir" : "file";

    rows.push({
      name: childName,
      path: childPath,
      type: type,
      ext: type === "dir" ? "" : getFileExt(childName),
      meta: LOG_META[childPath] || {},
    });

    index += 1;
  }

  rows.sort(function sortRows(a, b) {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "ko");
  });

  return rows;
}

/** preview buffer 상태에 따라 :view 버튼 활성 상태를 동기화한다. */
function syncInvestigationEditButton() {
  if (!elements.investigationEditButton) {
    return;
  }

  var canUsePreview = Boolean(previewFilePath) && state.phase === FLOW_PHASE.STREAMING;
  elements.investigationEditButton.disabled = !canUsePreview;
  elements.investigationEditButton.textContent = "뷰어 열기 :view";
  if (elements.investigationDownloadButton) {
    elements.investigationDownloadButton.disabled = !canUsePreview;
  }
}

/** 우측 preview buffer 텍스트/경로/라인 캐시를 갱신한다. */
function setInvestigationPreview(text, path, lines) {
  if (elements.investigationContent) {
    elements.investigationContent.textContent = text || "항목을 클릭해 내용을 확인하세요.";
  }
  previewFilePath = path || "";
  previewFileLines = Array.isArray(lines) ? lines.slice() : [];
  syncInvestigationEditButton();
}

/** 좌측 파일 패널(헤더/목록/경로)을 현재 cwd 기준으로 재렌더링한다. */
function renderInvestigationPanel(message) {
  var cwd = state.investigationCwd;
  var entry = LOG_FS[cwd];
  var rows = [];
  var index = 0;
  var rowHeader = null;
  var isStreaming = state.phase === FLOW_PHASE.STREAMING;

  if (!elements.investigationList || !elements.investigationPath || !elements.investigationContent) {
    return;
  }

  if (!isStreaming) {
    elements.investigationPath.textContent = "ftp://hyresis.local/ (login required)";
    elements.investigationList.innerHTML = "";
    setInvestigationPreview(message || "로그인 후 파일 목록을 확인할 수 있습니다.", "", []);
    return;
  }

  if (!entry || entry.type !== "dir") {
    elements.investigationPath.textContent = buildFtpPath(cwd);
    elements.investigationList.innerHTML = "";
    setInvestigationPreview("[FS] 현재 경로를 렌더링할 수 없습니다.", "", []);
    return;
  }

  elements.investigationPath.textContent = buildFtpPath(cwd);
  elements.investigationList.innerHTML = "";

  rowHeader = document.createElement("div");
  rowHeader.className = "investigation-row-header";
  rowHeader.innerHTML =
    '<span class="investigation-cell col-name">NAME</span>' +
    '<span class="investigation-cell col-ext">EXT</span>' +
    '<span class="investigation-cell col-size">SIZE</span>' +
    '<span class="investigation-cell col-date">DATE</span>' +
    '<span class="investigation-cell col-time">TIME</span>' +
    '<span class="investigation-cell col-type">ATTR</span>';
  elements.investigationList.appendChild(rowHeader);

  if (cwd !== "/하이레시스") {
    elements.investigationList.appendChild(
      buildInvestigationRowButton({
        name: "..",
        path: normalizePath(cwd + "/.."),
        type: "dir",
        ext: "",
        meta: { date: "--.--.--", time: "--:--", attr: "DIR" },
      })
    );
  }

  rows = getFsChildrenRows(cwd, entry);
  while (index < rows.length) {
    elements.investigationList.appendChild(buildInvestigationRowButton(rows[index]));
    index += 1;
  }

  if (message) {
    setInvestigationPreview(message, previewFilePath, previewFileLines);
    return;
  }

  setInvestigationPreview("항목을 클릭해 내용을 확인하세요.", "", []);
}

/** 리스트 항목 선택/로딩/열림 상태 클래스를 초기화한다. */
function clearInvestigationRowStates() {
  if (!elements.investigationList) {
    return;
  }

  var rows = elements.investigationList.querySelectorAll(".investigation-item");
  var index = 0;
  while (index < rows.length) {
    rows[index].classList.remove("is-selected", "is-loading", "is-opened");
    index += 1;
  }
}

/** 클릭된 항목에 로딩 상태를 표시한다. */
function markInvestigationRowLoading(rowButton, loading) {
  if (!rowButton || !rowButton.classList) {
    return;
  }

  clearInvestigationRowStates();
  rowButton.classList.add("is-selected");
  rowButton.classList.toggle("is-loading", Boolean(loading));
}

/** 지정 path에 대응되는 행을 opened 상태로 마킹한다. */
function markInvestigationRowOpenedByPath(path) {
  if (!elements.investigationList) {
    return;
  }

  var selector = '.investigation-item[data-path="' + normalizePath(path) + '"]';
  var rowButton = elements.investigationList.querySelector(selector);
  if (!rowButton) {
    return;
  }

  clearInvestigationRowStates();
  rowButton.classList.add("is-selected", "is-opened");
}

/** 파일 패널 항목 클릭 처리(dir -> cd, file -> cat). */
function handleInvestigationItemClick(clickEvent) {
  if (state.phase !== FLOW_PHASE.STREAMING) {
    return;
  }

  var target = clickEvent.target ? clickEvent.target.closest(".investigation-item") : null;
  if (!target || !target.dataset || !target.dataset.path) {
    return;
  }

  var path = target.dataset.path;
  var kind = target.dataset.kind || "";
  markInvestigationRowLoading(target, kind === "file");

  if (kind === "dir") {
    changeDirectory(path);
    return;
  }

  if (kind === "file") {
    readFile(path, { rowButton: target });
  }
}

/** ls 구현: 디렉터리 내용을 터미널에 출력하고 패널을 갱신한다. */
function listFs(path) {
  var entry = resolveFsEntry(path);
  var targetPath = normalizePath(path);

  if (!entry) {
    appendLogLine("path unavailable: " + buildFtpPath(path), "log-warn");
    return;
  }

  if (entry.type !== "dir") {
    appendLogLine("not a directory: " + buildFtpPath(path), "log-warn");
    return;
  }

  appendLogLine(buildFtpPath(targetPath), "log-muted");
  var index = 0;
  while (index < entry.children.length) {
    appendLogLine("  " + entry.children[index], "log-emphasis");
    index += 1;
  }

  renderInvestigationPanel();
}

/** cd 구현: cwd를 변경하고 pathbar/패널을 동기화한다. */
function changeDirectory(path) {
  var nextPath = normalizePath(path);
  var entry = LOG_FS[nextPath];
  if (!entry || entry.type !== "dir") {
    appendLogLine("cd: no such directory: " + buildFtpPath(nextPath), "log-warn");
    return;
  }

  state.investigationCwd = nextPath;
  appendLogLine("cwd -> " + buildFtpPath(state.investigationCwd), "log-muted");
  setTerminalPathbar(nextPath);
  renderInvestigationPanel();
  clearInvestigationRowStates();
}

/**
 * cat 전송 연출.
 * 진행률/속도를 표시한 뒤 완료 콜백에서 preview buffer를 갱신한다.
 */
function startRemoteFileTransfer(targetPath, entry, done) {
  var body = entry && Array.isArray(entry.content) ? entry.content.join("\n") : "";
  var meta = LOG_META[targetPath] || {};
  var totalBytes = Number(meta.size || 0);
  var total = totalBytes > 0 ? totalBytes : Math.max(512, body.length * 3);
  var ticks = 10;
  var step = 0;
  var jobId = fileTransferJob + 1;

  fileTransferJob = jobId;
  setTerminalPathbar(targetPath, "retr");
  setInvestigationPreview(
    "retr " + buildFtpPath(targetPath) + "\nsize " + formatTransferSize(total) + "\nwaiting...",
    "",
    []
  );
  appendLogLine("retr " + buildFtpPath(targetPath), "log-muted");

  function tick() {
    var downloaded = 0;
    var percent = 0;
    var speed = 0;

    if (fileTransferJob !== jobId) {
      return;
    }

    step += 1;
    downloaded = Math.min(total, Math.floor((total * step) / ticks));
    percent = Math.floor((downloaded / total) * 100);
    speed = 72 + Math.floor(Math.random() * 84);

    if (elements.investigationContent) {
      elements.investigationContent.textContent =
        "retr " + buildFtpPath(targetPath) + "\n" +
        "size " + formatTransferSize(total) + "\n" +
        buildLoadingGauge(Math.min(step, ticks), ticks) + " " + percent + "%\n" +
        "rate " + speed + " KB/s";
    }

    if (step >= ticks) {
      appendLogLine("download complete (" + formatTransferSize(total) + ")", "log-success");
      if (typeof done === "function") {
        done();
      }
      return;
    }

    setTimeout(tick, 90 + Math.floor(Math.random() * 80));
  }

  setTimeout(tick, 120);
}

/** cat/view 공통 파일 로드: 경로 검증 후 전송 연출 시작. */
function readFile(path, options) {
  var opts = options || {};
  var targetPath = normalizePath(path);
  var entry = LOG_FS[targetPath];

  if (!entry || entry.type !== "file") {
    appendLogLine("cat: file unavailable: " + buildFtpPath(targetPath), "log-warn");
    return;
  }

  startRemoteFileTransfer(targetPath, entry, function onTransferComplete() {
    setTerminalPathbar(targetPath, "preview");
    setInvestigationPreview(entry.content.join("\n"), targetPath, entry.content);
    markInvestigationRowOpenedByPath(targetPath);

    if (opts.openVim) {
      openPreviewInTerminalVim(targetPath, entry.content);
    }
  });
}

/** view 구현: preview 내용을 read-only 뷰어 스타일로 터미널에 출력. */
function openPreviewInTerminalVim(path, lines) {
  var safeLines = Array.isArray(lines) ? lines : [];
  var charCount = safeLines.join("\n").length;
  var index = 0;

  setTerminalPathbar(path, "view");
  appendLogLine("[VIEW] open " + buildFtpPath(path), "log-muted");
  appendLogLine('"' + normalizePath(path) + '" ' + safeLines.length + "L, " + charCount + "B", "log-muted");
  appendLogLine("-- VIEW-ONLY --", "log-muted");

  while (index < safeLines.length) {
    var lineNo = String(index + 1).padStart(2, "0");
    appendLogLine(lineNo + " | " + safeLines[index], "log-emphasis");
    index += 1;
  }

  appendLogLine("-- READ-ONLY -- save is blocked (permission denied)", "log-muted");
}

/** preview buffer를 기준으로 view를 여는 버튼 핸들러. */
function handleInvestigationEditClick() {
  if (state.phase !== FLOW_PHASE.STREAMING) {
    return;
  }

  if (!previewFilePath || previewFileLines.length === 0) {
    return;
  }

  openPreviewInTerminalVim(previewFilePath, previewFileLines);
}

// ----- 터미널 로그/히스토리 -----

/** 로그 영역/로그 큐/스크롤 고정 상태를 초기화한다. */
function clearLog() {
  if (elements.log) {
    elements.log.innerHTML = "";
  }
  state.logQueue = [];
  state.typingActive = false;
  state.logPinnedToBottom = true;
}

/**
 * 터미널 로그 한 줄 출력.
 * options.animate=true일 때만 타이핑 큐를 사용한다.
 */
function appendLogLine(text, tone, options) {
  var shouldAnimate = false;
  if (options && typeof options.animate === "boolean") {
    shouldAnimate = options.animate;
  }

  if (!shouldAnimate) {
    var staticLine = createLogLine(tone);
    staticLine.textContent = text;
    scrollLogToBottom();
    return staticLine;
  }

  enqueueLogLine(text, tone);
  return null;
}

/** 로그 라인 DOM 노드를 생성해 로그 컨테이너에 추가한다. */
function createLogLine(tone) {
  var line = document.createElement("div");
  line.className = "log-line " + (tone || "log-muted");
  elements.log.appendChild(line);
  return line;
}

/** 사용자가 하단을 보고 있을 때에만 자동 스크롤한다. */
function scrollLogToBottom() {
  if (!elements.log || !state.logPinnedToBottom) {
    return;
  }

  elements.log.scrollTop = elements.log.scrollHeight;
  requestAnimationFrame(function onNextFrame() {
    elements.log.scrollTop = elements.log.scrollHeight;
  });
}

/** 로그 스크롤 위치를 감지해 자동 스크롤 고정 여부를 갱신한다. */
function handleLogScroll() {
  if (!elements.log) {
    return;
  }

  var threshold = 12;
  var distanceToBottom = elements.log.scrollHeight - (elements.log.scrollTop + elements.log.clientHeight);
  state.logPinnedToBottom = distanceToBottom <= threshold;
}

/** 실행된 명령을 히스토리에 저장(중복 꼬리 제거, 길이 제한 포함). */
function saveInputHistory(inputText) {
  if (!inputText) {
    return;
  }

  if (state.inputHistory.length === 0 || state.inputHistory[state.inputHistory.length - 1] !== inputText) {
    state.inputHistory.push(inputText);
    if (state.inputHistory.length > 60) {
      state.inputHistory.shift();
    }
  }

  state.inputHistoryCursor = state.inputHistory.length;
}

/** 히스토리 커서를 이동하고 입력창 값을 이전/다음 명령으로 치환한다. */
function navigateHistory(direction) {
  if (state.inputHistory.length === 0) {
    return;
  }

  var nextCursor = state.inputHistoryCursor + direction;
  if (nextCursor < 0) {
    nextCursor = 0;
  }
  if (nextCursor > state.inputHistory.length) {
    nextCursor = state.inputHistory.length;
  }

  state.inputHistoryCursor = nextCursor;
  if (nextCursor === state.inputHistory.length) {
    elements.input.value = "";
  } else {
    elements.input.value = state.inputHistory[nextCursor];
  }
}

/** 타이핑 출력 큐에 로그 항목을 등록한다. */
function enqueueLogLine(text, tone) {
  state.logQueue.push({ text: text, tone: tone || "log-muted" });
  if (!state.typingActive) {
    processNextLogLine();
  }
}

/** 로그 큐를 순차 타이핑 출력한다(현재는 필요 시에만 사용). */
function processNextLogLine() {
  if (state.logQueue.length === 0) {
    state.typingActive = false;
    return;
  }

  state.typingActive = true;
  var nextItem = state.logQueue.shift();
  var line = createLogLine(nextItem.tone);
  var text = nextItem.text;
  var index = 0;

  line.textContent = "";

  if (!text) {
    finishTypedLine();
    return;
  }

  function typeNextChar() {
    line.textContent += text.charAt(index);
    scrollLogToBottom();
    index += 1;

    if (index < text.length) {
      setTimeout(typeNextChar, GAME_CONFIG.typingCharDelayMs);
    } else {
      finishTypedLine();
    }
  }

  function finishTypedLine() {
    scrollLogToBottom();
    setTimeout(function scheduleNext() {
      state.typingActive = false;
      processNextLogLine();
    }, GAME_CONFIG.typingLineDelayMs);
  }

  typeNextChar();
}

/** 앱 시작점. */
document.addEventListener("DOMContentLoaded", handleDomContentLoaded);
