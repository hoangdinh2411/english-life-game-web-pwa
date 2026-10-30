# Production asset workflow

Tài liệu này hướng dẫn cách đưa asset đã review từ
`local-assets/maps/` lên production. Đây là quy trình một chiều:
**local reviewed assets → immutable production assets**. Quy trình không tải
asset từ production về local, không ghi ngược vào asset nguồn và không tự động
xóa object trên production.

## Prompt dùng lại cho AI

Copy prompt dưới đây vào Codex khi cần chuẩn bị asset. Thay các giá trị trong
`<...>` trước khi gửi:

```text
Work on the production asset workflow for Life Abroad.

Read and follow AGENTS.md, docs/TECH.md, docs/TASKS.md and
docs/PRODUCTION_ASSET_WORKFLOW.md. Do not read docs/DONE.md. Do not use
subagents. Do not start development servers.

Requested operation: <ADD_ASSETS_TO_EXISTING_MAP | ADD_NEW_MAP_FOLDER>
Target map: <map id, for example loc_cafe or loc_library>
Asset changes: <describe every added or changed file and its purpose>

Inspect the current implementation and local-assets/maps/<map id>. Validate
filenames, logical keys, file types, JSON/atlas/animation contracts, NPC
ownership and client loading requirements. For a new map, update every required
allowlist, content/database location, client route/loader contract, tests and
maintained documentation. Preserve the signed-out Receptionist /practice path.

Run focused tests, lint, typecheck, content validation, build and PWA checks as
appropriate. Create and validate a reviewed production asset pack locally, but
do not upload a GitHub Release, use production secrets, run the production
workflow, deploy, migrate production, seed production or mutate any remote
environment without my separate explicit approval.

Report the exact files changed, validation results, manifest map/file counts,
remaining manual review, and the production inputs I will need. Never print
secrets. Do not commit, push, tag or create a Release without asking first.
```

Prompt trên chỉ cho phép AI **chuẩn bị và kiểm tra**. Việc tạo Release hoặc chạy
production vẫn cần một yêu cầu phê duyệt riêng. Không nên gộp chuẩn bị asset và
deploy thật vào cùng một lệnh mơ hồ.

## Khái niệm quan trọng

### Canonical source

`local-assets/maps/` là nguồn asset chính. Folder này bị Git ignore vì chứa
binary lớn và artwork nguồn. Các file ở đây phải được backup và review ngoài
Git.

### Runtime asset và source asset

- Runtime asset là file thực sự được game tải: background, player sheet,
  animation JSON, NPC sheet, atlas, portrait, actor JSON hoặc audio.
- Folder `source/` chứa artwork hoặc dữ liệu trung gian. Tool upload không duyệt
  `source/` như một runtime folder thông thường.
- Một số asset station cũ được khai báo bổ sung rõ ràng trong tooling. Không
  nên giả định rằng đặt file mới vào `source/` sẽ tự động upload.

### Immutable version

Mỗi object production có version và SHA-256 trong path. Nếu bytes không đổi,
tool bỏ qua upload. Nếu checksum thay đổi, tool tạo version kế tiếp. Tool không
ghi đè bytes khác vào cùng version và không xóa version cũ.

### Reviewed asset pack

Vì GitHub runner không có `local-assets/maps/`, operator phải tạo hai file:

- `production-assets.tgz`
- `production-assets.manifest.json`

Workflow chỉ nhận pack khi SHA-256 của cả hai file khớp với input đã phê duyệt.

## Điều kiện ban đầu

Trước mọi thay đổi:

1. Checkout branch task, không làm trực tiếp trên `dev` hoặc `main`.
2. `local-assets/maps/` phải có bản canonical mới nhất và đã backup.
3. Không chứa secret, `.env`, token, file tạm hoặc dữ liệu cá nhân.
4. Node và pnpm phải đúng version của repository.
5. Không cần chạy development server.
6. Production GitHub Environment, Supabase và Render không cần được truy cập
   trong giai đoạn author/review asset.

## Trường hợp A — Thêm hoặc thay đổi asset trong map hiện có

Ví dụ: thêm portrait cho NPC tại `loc_cafe`, thay background của
`loc_town_street`, hoặc sửa walking sheet của `loc_tax_office`.

### A1. Chọn đúng map

Các map hiện được production tooling chấp nhận:

- `loc_station`
- `loc_town_street`
- `loc_cafe`
- `loc_corner_cafe`
- `loc_clothes`
- `loc_tax_office`

Không tạo folder gần giống như `loc-cafe`, `Loc_Cafe` hoặc `loc_cafe_v2` để né
versioning. Thay đổi map hiện tại phải nằm trong đúng folder hiện tại.

### A2. Đặt file đúng vị trí

Các file runtime cốt lõi của mỗi map:

- `background.png`
- `player.png`
- `animations.json`

Map có NPC thường có thêm:

- `<npc asset key>.png`
- `<npc asset key>-atlas.json`
- `portrait-<npc id>.png`
- `actors.json` nếu map dùng actor manifest
- Audio/JSON liên quan nếu loader của map hỗ trợ

Tên file trở thành logical key. Không được có hai file tạo ra cùng cặp
`npcId:key`. Filename phải ổn định, chữ thường và phù hợp với schema hiện có.

### A3. Phân biệt “file mới” và “file thay thế”

- File mới: logical key chưa tồn tại trên production → version bắt đầu từ `1`.
- File thay thế: cùng logical key nhưng SHA-256 khác → version hiện tại cộng `1`.
- File không đổi: SHA-256 giống production → không upload.
- Đổi filename: được hiểu là logical key mới, không phải version mới của file
  cũ. Chỉ đổi tên khi đó thực sự là một asset identity mới.

### A4. Kiểm tra contract

Kiểm tra tối thiểu:

1. File tồn tại, không rỗng và đúng MIME/extension.
2. PNG/WebP/SVG mở được và có kích thước/frame layout mà loader mong đợi.
3. JSON parse được, không có field tùy ý chưa được client hỗ trợ.
4. `animations.json` có `walk-0`, `walk-1`, `walk-2`, `walk-3`, texture
   `player`, frame list, frame rate và repeat hợp lệ.
5. Atlas trỏ tới đúng image và mọi frame nằm trong giới hạn ảnh.
6. Portrait có đúng NPC ID và đúng grid mà UI sử dụng.
7. NPC thuộc đúng location trong content/database.
8. Không import destination NPC art trở lại client bundle.
9. `/practice` vẫn dùng Receptionist asset được bundle và không phụ thuộc
   Storage.

### A5. Chạy kiểm tra repository

Chạy các kiểm tra phù hợp từ repository root:

```sh
pnpm test:ops
pnpm lint
pnpm typecheck
pnpm test
pnpm content:validate
pnpm build
pnpm check:pwa
```

Nếu môi trường sandbox chặn loopback socket, server unit tests phải được chạy ở
môi trường cho phép `127.0.0.1`; không được ghi “pass” nếu chỉ bỏ qua chúng.

### A6. Tạo asset pack

Tạo một output folder mới bên ngoài `local-assets/maps/`, rồi chạy:

```sh
pnpm production:assets -- create <output>/production-assets.tgz <output>/production-assets.manifest.json
```

Lệnh in ra SHA-256 của archive và manifest. Lưu hai giá trị này nhưng không
chỉnh sửa file sau khi lấy hash.

### A7. Validate chính pack vừa tạo

Giải nén archive vào một temporary folder, sau đó chạy:

```sh
pnpm production:assets -- validate <temporary>/maps <output>/production-assets.manifest.json
```

Kết quả phải liệt kê đủ sáu map. Nếu validate thất bại, không upload Release và
không sửa manifest bằng tay để ép pass; sửa canonical source rồi tạo pack mới.

### A8. Review manifest

Reviewer kiểm tra:

- Đủ sáu map hiện hành.
- Chỉ có logical key dự kiến.
- Map/NPC ownership đúng.
- Bytes và SHA-256 có format hợp lệ.
- Không có secret hoặc file ngoài phạm vi.
- Asset thay đổi có lý do và screenshot/preview review tương ứng.

### A9. Tạo immutable GitHub Release

Sau khi code và pack được review:

1. Tạo tag/Release riêng cho asset pack.
2. Upload đúng hai file với tên cố định.
3. Không replace file trong Release cũ.
4. Lưu Release tag, archive SHA-256 và manifest SHA-256 cho production input.

AI không được tự làm bước này nếu chưa có yêu cầu phê duyệt rõ ràng.

## Trường hợp B — Thêm một map folder mới

Ví dụ: thêm `local-assets/maps/loc_library/`.

Map mới không được tự động upload chỉ vì folder tồn tại. Đây là security gate,
không phải hạn chế cần né.

### B1. Chốt product và map ID

Trước khi tạo folder, xác nhận:

- Map có thật sự nằm trong task/product scope không.
- Map ID ổn định, ví dụ `loc_library`.
- Entry/exit và map kết nối với location nào.
- NPC nào thuộc map.
- Map online hay có yêu cầu offline riêng.

Không thêm map nếu các quyết định trên còn mơ hồ.

### B2. Tạo canonical folder

Tạo:

```text
local-assets/maps/loc_library/
  background.png
  player.png
  animations.json
  actors.json                 # nếu có NPC actors
  <npc sheets and atlases>    # nếu có NPC
  <portraits>                 # nếu có NPC dialogue
  source/                     # optional, không tự upload như runtime files
```

Không copy một map khác rồi để lại logical key, NPC ID hoặc atlas image name cũ.

### B3. Đăng ký map trong implementation

AI/developer phải kiểm tra và cập nhật, khi áp dụng:

1. `supportedMaps` trong production asset tooling.
2. Location/content seed tương ứng.
3. Forward database migration nếu production schema/data cần location trước
   khi upload.
4. Client route, portal, spawn point và map loader.
5. Map-pack schema/actor requirements.
6. NPC location ownership và portrait registration.
7. Tests cho map loading, cleanup, collision, navigation và missing assets.
8. Production asset tests và manifest expectation.
9. `docs/GAME.md` nếu product behavior thay đổi.
10. `docs/TECH.md` nếu interface/deployment contract thay đổi.

Không chỉ thêm tên vào `supportedMaps`. Làm vậy có thể upload được file nhưng
game, database hoặc rollback vẫn hỏng.

### B4. Kiểm tra compatibility và release order

Map mới phải tuân theo thứ tự release:

1. Code/content validation và build.
2. Forward migration tạo location/schema cần thiết.
3. Idempotent seed.
4. API tương thích với map mới.
5. Upload/reconcile immutable assets.
6. Client biết cách tải map mới.
7. Authenticated smoke checks.

API phải được deploy trước asset vì upload endpoint xác minh map và NPC
ownership. Client được deploy sau asset để tránh client mới trỏ tới pack chưa
có.

### B5. Thêm test bắt buộc

Ngoài test của trường hợp A, map mới cần chứng minh:

- Folder thiếu background/player/animations bị từ chối.
- Animation hoặc atlas malformed bị từ chối.
- Map chưa đăng ký bị từ chối.
- NPC không thuộc map bị API từ chối.
- Asset giống nhau được skip.
- Asset đổi checksum nhận immutable version mới.
- Partial upload failure giữ file đã upload và cho phép retry.
- Client cleanup xóa texture/audio/JSON/animation của map cũ.
- Rollback code/manifest cũ không cần xóa asset map mới.
- Receptionist `/practice` vẫn hoạt động offline.

### B6. Tạo pack và review

Sau khi implementation và tests pass, thực hiện lại A6–A9. Manifest mới phải
chứa map mới cùng toàn bộ map bắt buộc trước đó. Nếu tooling vẫn báo chỉ sáu map,
việc đăng ký map mới chưa hoàn tất.

## Chạy production workflow

Chỉ làm sau khi branch đã được review/merge, CI của full commit SHA pass, asset
pack được review và GitHub `production` Environment đã có required reviewer.

Trong GitHub mở **Actions → Deploy production → Run workflow**, nhập:

- `release_commit_sha`: full 40-character SHA đã pass CI.
- `asset_pack_release_tag`: Release tag chứa pack đã review.
- `asset_pack_sha256`: SHA-256 của `production-assets.tgz`.
- `asset_manifest_sha256`: SHA-256 của manifest.
- `confirmation`: chính xác `DEPLOY_PRODUCTION`.

Required reviewer phải kiểm tra input trước khi approve.

Workflow thực hiện:

1. Checkout đúng SHA.
2. Validate production configuration và secret boundary.
3. Download, hash-check và validate asset pack.
4. Chạy quality gates/build.
5. Apply forward migrations và idempotent seed.
6. Deploy API.
7. Reconcile tất cả map với explicit apply, rồi chạy check mode.
8. Deploy client.
9. Chạy authenticated health/catalog/tutorial-audio smoke checks và kiểm tra
   `/practice` shell.

Normal push không chạy workflow này.

## Kiểm tra sau deploy

### Existing-map asset change

1. Đăng nhập bằng smoke account.
2. Đi tới map đã thay đổi.
3. Kiểm tra background, player, NPC walking, portrait và audio liên quan.
4. Rời map rồi quay lại để kiểm tra cleanup/reload.
5. Mở browser network/errors; không được có 404 hoặc cache nhầm version.
6. Mở signed-out `/practice`; Receptionist phải tiếp tục hoạt động.

### New map

1. Kiểm tra entry portal và spawn point.
2. Kiểm tra collision và đường quay về map trước.
3. Kiểm tra tất cả NPC, portrait, dialogue và teardown.
4. Refresh trực tiếp tại route liên quan nếu routing hỗ trợ.
5. Kiểm tra authorization: user chưa đăng nhập không được nhận remote game
   state/rewards.

### Idempotency proof

Chạy lại cùng commit và cùng pack chỉ khi operator chủ ý xác minh idempotency.
Asset reconciliation lần hai phải upload `0` file và delete `0` object.

## Failure handling

- **Hash mismatch:** dừng; file Release không phải bytes đã review.
- **Manifest mismatch:** dừng; canonical pack và manifest khác nhau.
- **Missing/malformed asset:** sửa local source và tạo Release mới.
- **API deploy failure:** không deploy client; kiểm tra API trước.
- **Partial asset failure:** không xóa file đã upload; sửa nguyên nhân và retry
  cùng immutable pack.
- **Reconcile check còn changed assets:** không deploy client.
- **Smoke failure:** release chưa được chấp nhận dù Render báo live.
- **Secret xuất hiện trong log/client:** revoke ngay key bị lộ và điều tra trước
  lần deploy tiếp theo.

## Rollback

Rollback bằng cách chạy lại manual workflow với:

- Full SHA của release tốt trước đó.
- Release tag và hai SHA-256 của asset pack trước đó.

Không xóa asset mới. Immutable asset mới có thể ở lại Storage mà không được
manifest/code cũ tham chiếu. Database migration phải backward-compatible; nếu
migration phá schema cũ thì rollback code không còn an toàn.

## Checklist ngắn cho reviewer

- [ ] Task/branch đúng scope.
- [ ] Canonical local assets đã backup và review.
- [ ] Không có secret hoặc dữ liệu cá nhân.
- [ ] Existing map hay new map đã được phân loại đúng.
- [ ] Runtime/source files không bị nhầm.
- [ ] Contract animation/atlas/portrait/NPC ownership pass.
- [ ] Focused tests, lint, typecheck, full tests, content, build và PWA pass.
- [ ] Pack create + extract + validate pass.
- [ ] Manifest và SHA-256 được review.
- [ ] GitHub Release mới, không replace Release cũ.
- [ ] Full release commit SHA đã pass CI.
- [ ] Production Environment reviewer kiểm tra input.
- [ ] Post-deploy client và backend smoke pass.
- [ ] Repeat apply, nếu được yêu cầu, upload `0` và delete `0`.

