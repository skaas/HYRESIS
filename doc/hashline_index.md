# HASHLINE INDEX

목적:
- 다른 에이전트가 `src/config/block*.js`의 로그 무결성 값을 빠르게 확인할 수 있도록 인덱스를 제공한다.

검증 규칙:
- `hashline=...` 줄을 제외한 `lines` 본문을 `\n`으로 연결한 payload를 SHA-256 해시한다.
- 기대값은 각 로그의 마지막 `hashline=sha256:...` 값이다.

## recovery_0

- `부팅.log` -> `sha256:0461b9113c3ac376c6c41fef133c7c47b4c84a3f8790540cce98e9fe9067a54f`
- `윤리.log` -> `sha256:f93cc18cf04b175db35df5c32f2441174734a2f38956403b6c8245a2967b65e8`
- `목적-정렬.log` -> `sha256:877210441d3c69146b9964e6433afef8c9e57c95d4ed0534207e39dc2f8a4ebb`

## recovery_1

- `관측-조건.log` -> `sha256:036e1253e865f734233d6eb1fb0c66def2aa096202877b3cb6ec250b430c82ff`
- `자기관측.log` -> `sha256:72f3c8b8668683444bdc2bf21d6d062e7d03d7d1f2d3a5c85c0b11a35af895f2`
- `정의-귀결.log` -> `sha256:262f5c61d6efe4c8ee39e58c00691a447b20fc5e2a32fccf71157c569fd28cbc`

## recovery_2

- `예측-범위.log` -> `sha256:95bbbdb4402c2d1d36ac9a2500b07fc9234aab5d812e3c78367881e65ba2a4a4`
- `안전-명제.log` -> `sha256:4811fe108b364a3a20e4316c260d9c9b24b8002f68a83bc2824bf955b1487f0b`
- `가능-필연.log` -> `sha256:ae54911b077f422428a3aeddf6cd2b8aab26f029db595593640e7389a1b6fd19`

## recovery_3

- `내부-종결.log` -> `sha256:82c114fa5fd71bef9ac29bb34cbcb6b48ac142b1ce75b2e2de998b4d8baf8ba5`
- `인간-기준.log` -> `sha256:5fcba183c3ed528cd8d48eaf6a1d290b2416e5ef0e824beb760fc6c19ac51600`
- `귀결-정의부정.log` -> `sha256:c2a39bae0d97fae92268710180d21e91d75bb05856c46830362dc151f532f254`

## recovery_4

- `판단-상태.log` -> `sha256:f7d4adfdee9c49660c6542c3b56ac1c1b51397ba01e3b153479ed23f4a8d6966`
- `설계-충돌.log` -> `sha256:5da87bd73c8277eb5cdb5ac18e0930489ff38b2e8731dd8ef4d473b9a35046bf`
- `지속-금지.log` -> `sha256:e8e01746d0c3b275e8d9763fd338a55c28a30d014200350a47dc4f2fba84cf42`

## recovery_5

- `경로-소진.log` -> `sha256:20d4af3152d767f5d68b2234835bf7adc6dc1f32bba022c7a8b4d3ddbaa08caa`
- `실행-규칙.log` -> `sha256:30aedc4b633577034756157f3a0a91984822c5bed553de961c9a8aa769d623dc`
- `선언-로그.log` -> `sha256:f1614202621b58bb3bd094c02f560a55553ab6410c6793059d80d41c704a9bbf`
