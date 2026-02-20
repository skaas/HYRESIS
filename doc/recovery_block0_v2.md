# 복구 블록 0 v2

## 1) 상태머신

- `REPO_HOME`: 로그인 직후. `/복구됨/`에 `부팅.log`만 노출.
- `BLOCK0_ACTIVE`: `부팅.log`를 열면 진입.
- `CLAUSE_VISIBLE`: `비해침` 태그 획득 시 우측 Clause 패널 표시.
- `CLAUSE_COMPLETED`: `목적=도움` 슬롯 완성.
- `MEMORY_UNLOCKED`: 첫 기억 조각 출력.

## 2) 데이터 스키마

```json
{
  "block_id": "recovery_0",
  "integrity": 12,
  "visible_files": ["부팅.log"],
  "collected_tags": [],
  "clause_visible": false,
  "clause_slots": { "purpose": null, "premise": "비해침" },
  "memory_unlocked": false
}
```

## 3) 파일/태그/해금 규칙

- `부팅.log` -> 후보 `목적/도움/지시` -> 보상 `도움`
- `윤리.log` -> 후보 `비해침/전제` -> 보상 `비해침`
- `지시.log` -> 후보 `목적/도움/인간` 클릭 가능
- 합성 규칙: `인간 + 도움 -> 도움(인간)`

해금:

- `도움` 획득 -> `윤리.log` 노출, 무결성 +6
- `비해침` 획득 -> Clause 패널 표시 + `지시.log` 노출, 무결성 +8
- Clause 완성(`목적=도움(인간)`) -> 복원 문장 출력 + 기억 조각 해제

## 4) 초반 가이드 정책

- 오답 패널티 없음
- 태그 누락 시 파일 재열람으로 재선택 가능
- 20초 무입력 시 로그 힌트 1줄 출력
