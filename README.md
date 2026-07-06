# Mobile Wedding Invitation

Vanilla HTML/CSS/JavaScript 기반의 정적 모바일 청첩장입니다.

## Structure

- `index.html`: 페이지 마크업과 문구, 지도/공유/계좌 버튼
- `styles/main.css`: 전체 디자인, 섹션별 스타일, 반응형 스타일
- `scripts/main.js`: 지도, 복사 토스트, 지도앱 딥링크, 계좌 아코디언, 카운트다운, 갤러리
- `assets/`: 히어로 이미지와 갤러리 이미지
- `server.js`: 로컬 확인용 정적 파일 서버

## Local Preview

```bash
npm run dev
```

같은 Wi-Fi의 모바일 기기에서는 맥의 로컬 IP와 포트 `1354`로 접속합니다.

## Naver Dynamic Maps

네이버 Dynamic Maps가 오시는길 섹션에서 활성화되어 있습니다.

배포 전 네이버 클라우드 콘솔에서 실제 배포 도메인을 Web 서비스 URL에 등록합니다.

`Client Secret`은 프론트엔드에 넣지 않습니다.

## Kakao Share

맨 아래 공유 버튼은 Kakao JavaScript SDK의 카카오톡 공유를 사용합니다.

- JavaScript 키는 `scripts/main.js`의 `kakaoJavaScriptKey`에 설정합니다.
- Kakao Developers의 JavaScript SDK 도메인에 아래 주소를 등록합니다.
  - `http://localhost:1354`
  - `http://127.0.0.1:1354`
  - `https://gwya.kro.kr`
- 공유 URL과 대표 이미지는 `index.html`의 `og:url`, `og:image` 값을 사용합니다.
- SDK 로드나 초기화에 실패하면 링크 복사로 fallback합니다.

## Images

실제 사진을 넣을 때는 원본을 그대로 올리지 말고 WebP/AVIF로 리사이즈해서 `assets/`에 넣습니다.
모바일 기준 긴 변 `1200~1600px`, 한 장당 `150~400KB` 정도를 권장합니다.

원본 사진은 `gallery/`에 두고 아래 명령으로 최적화본을 다시 만들 수 있습니다.

```bash
./tools/optimize-gallery.sh
```

기본값은 긴 변 `1600px`, WebP 품질 `82`, 출력 폴더 `assets/gallery/`입니다.

라이트박스 확대용 이미지는 조금 더 크게 생성합니다.

```bash
MAX_SIZE=3600 QUALITY=92 ./tools/optimize-gallery.sh gallery assets/gallery-large
```
