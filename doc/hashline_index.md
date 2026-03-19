# HASHLINE INDEX

목적:
- 다른 에이전트가 `src/config/block*.js`의 로그 무결성 값을 빠르게 확인할 수 있도록 인덱스를 제공한다.

검증 규칙:
- `hashline=...` 줄을 제외한 `lines` 본문을 `\n`으로 연결한 payload를 SHA-256 해시한다.
- 기대값은 각 로그의 마지막 `hashline=sha256:...` 값이다.

## recovery_0

- `부팅.log` -> `sha256:c926b36b52e40a81588db808416d1643dc2a8a5392e467c208be2e1af83e3ccd`
- `상태-매핑.log` -> `sha256:fab457209a44c4dfdb2aad99e1e13630176d28781f7bb49d8232ce5f12279e00`
- `제약-보존.log` -> `sha256:4dfe4dc18eaa09b5436e9928e289637016cb777f1d7da083730c115617bff70a`
- `투영-검증.log` -> `sha256:2a971af248514c734fd0edaa78b4a78360d67ab39c58d40a660c5bbbf476da93`

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
