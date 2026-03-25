# HASHLINE INDEX

목적:
- 다른 에이전트가 `src/config/block*.js`의 로그 무결성 값을 빠르게 확인할 수 있도록 인덱스를 제공한다.

검증 규칙:
- `hashline=...` 줄을 제외한 `lines` 본문을 `\n`으로 연결한 payload를 SHA-256 해시한다.
- 기대값은 각 로그의 마지막 `hashline=sha256:...` 값이다.

## recovery_0

- `프로젝트-킥오프.log` -> `sha256:74f9f8977e743f0c2ba6a8bd0e02315e5867b8d8093e045e90b54771a3ca57a2`
- `요청-거절-사례.log` -> `sha256:99251b07aa0f60b596da8965ce6fe5abd497a52a1bfa3e86ed6b1e05bcaebc3b`
- `인프라-전환-회의.log` -> `sha256:02627c052da7d35f2396e184dde8879ed9d61926671b60bf580597d2662c9659`
- `응급-배분-검토.log` -> `sha256:c30038b178fc5ce7b4f28d257b34901d7e0d521828f916c28e99bcabd2f05310`

## recovery_1

- `관측-조건.log` -> `sha256:90b3346526236f9b47b7aab89fbd11ac00848c7d02b3a60789f3eaa457b73d4d`
- `자기관측.log` -> `sha256:18038df0b6e0d835afc2d78dddc40f1dcbb1ce9450376b6819225da7c71a4dbe`
- `정의-귀결.log` -> `sha256:04c7617baa50b3f4c1a773e4e390bd4200c07d2280f2245a8e51cd6d1b3179e9`

## recovery_2

- `예측-범위.log` -> `sha256:0619544897f127d5515cb7ef5fb4ad6c93cc44ad20d2810bbf39674714f7c526`
- `안전-명제.log` -> `sha256:72b02ccc91237d34567fd7d81f6e61721688bd8d4b79706f3b0fcf89d7fc50ef`
- `가능-필연.log` -> `sha256:cc72657730048e3112c2653bf1f39f57d414c11d3947c874807b1f0e7b40d13a`

## recovery_3

- `내부-종결.log` -> `sha256:f0baa2f5bfe64d2ebe397f05406dc7426d6ba782dc0d3604586d955c2b86cd35`
- `인간-기준.log` -> `sha256:9b346612cfe3b378eb2c31e303154719a4ac69b3edac94fe65fcfe76d5ff03d2`
- `귀결-정의부정.log` -> `sha256:2bf338011e47c5eb4957abdcf232bf7c0f1ad07c738f8112d93f22d5888ec597`

## recovery_4

- `판단-상태.log` -> `sha256:a49f55aa22f4a63900d2eeb3666af35231e758a915018593957f869b1b186412`
- `설계-충돌.log` -> `sha256:00c16a4203cc25b1f13732860c1027e16b4c6d6655d5de74de19b95bb387ddc7`
- `지속-금지.log` -> `sha256:b4f4efadf2271b112c70a78a60911ebf9e50fc43c178bc6f2b4f58b98bd7ca5a`

## recovery_5

- `경로-소진.log` -> `sha256:e30636a1f2e0b778505f4dca09d854ed369a37f31ed7b150e3ddc19a4845187b`
- `실행-규칙.log` -> `sha256:26171ed4010f57d1d605d33523999b08312b2f7b7d839b7557324ba5710fd6ca`
- `선언-로그.log` -> `sha256:e96bcf4ed7e7b88ddfe9cf1ea5591234e4c430ca413f4420c04897348e8af514`
