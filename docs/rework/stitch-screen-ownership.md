# Stitch screen ownership

Live inventory retrieved read-only on 2026-11-16 from **Katipan Wedding Planner UI System** (`13691899610292683671`): **61 DESIGN screens and 6 IMAGE assets**, all mapped below exactly once. Base: **Warm Editorial Nuptial**. Existing [source-of-truth document](../ui/stitch-ui-source-of-truth.md) remains the visual/token baseline; its route column is historical planning, not the current router.

Agent 01 is design guardian for every screen but not a second feature owner. Each entry has exactly one primary owner. Agent 10 verifies implementation evidence. A collaborating agent supplies a contract; collaboration grants no concurrent write authority. Inventory coverage is not a pixel-level visual acceptance claim. Exact per-screen design contracts (all fields in Agent 01 runbook) are required before each implementation slice.

## Complete inventory

| Stitch ID | Screen / asset | Primary agent | Classification | Collaborators / boundary |
| --- | --- | --- | --- | --- |
| `4608062ebe1e4685ab1f8ea1dced6576` | Close up couple portrait photo of an attractive modern Filipino couple smiling warmly together in soft golden hour light, romantic natural wedding aesthetic, candid joy, warm editorial lighting, high resolution | 01 | RETAIN | Shared visual asset; no feature/data authority |
| `d54ca987052b4c8d9ac039d04b850bbb` | Full-length artistic portrait of an attractive stylish modern Filipino couple in an outdoor garden wedding setting, groom in modern light linen barong, bride in modern romantic lace dress, soft golden sunlight, lush tropical green leaves and sampaguita flowers, editorial luxury magazine style, calm romantic warmth, high resolution photography | 01 | RETAIN | Shared visual asset; no feature/data authority |
| `3dfbe2a0e4344cc786ec71c3b04a439d` | Katipan Interlocking Rings Brandmark | 01 | RETAIN | Shared visual asset; no feature/data authority |
| `fbd7c40da2134e85858ea790d98580a9` | Modern intimate beach wedding setup in the Philippines with bamboo canopy and flowing white linen drapes on pristine white sand, calm turquoise sea in background, sunset golden glow, elegant luxury wedding destination | 01 | RETAIN | Shared visual asset; no feature/data authority |
| `c6e13256bc99425b85a5b6591f523329` | Romantic warm overhead flatlay photo of wedding planning accessories on a warm ivory linen surface: elegant calligraphy vow notebook, wedding rings in velvet box, sprig of olive and sampaguita, warm gold pen, modern stationery with sage green ribbon, soft editorial lighting | 01 | RETAIN | Shared visual asset; no feature/data authority |
| `00b48f1476dc4156bd36a1c9279a2a42` | Scenic open-air romantic garden wedding venue pavilion with wooden arches covered in white flowers and eucalyptus vines, outdoor manicured green lawn in Antipolo Philippines, soft afternoon golden light, luxury intimate venue | 01 | RETAIN | Shared visual asset; no feature/data authority |
| `a7970cf399a44499b12d921b316d9db1` | Coordinator Onboarding | 03 | RETAIN | 01 visual; 02 backend audit |
| `d99ee81c2e8743ce99a87253259dcc35` | Coordinator Wedding Overview | 03 | RETAIN | 01 visual; 02 backend audit |
| `4753b63a91304fac884ec6debf7681c5` | Coordinator-Managed Wedding Overview | 03 | RETAIN | 01 visual; 02 backend audit |
| `f12a02d5acfa435f97c8263961825b61` | Couple & Wedding Details | 03 | RETAIN | 01 visual; 02 backend audit |
| `2689ca94563540339ca1edbd62884161` | Create Client Wedding | 03 | RETAIN | 01 visual; 02 backend audit |
| `d53e9d8d88584c57b5e9999fe1f2fe48` | Create Our Wedding | 03 | RETAIN | 01 visual; 02 backend audit |
| `9f449d0690074bb0bcb0875d288b24a3` | Enhanced My Weddings | 03 | RETAIN | 01 visual; 02 backend audit |
| `72c44d6876884247826048a2bb72f789` | Invite Couple to Katipan / Ownership Transition | 03 | RETAIN | 01 visual; 02 backend audit |
| `586c03b4559547ff994754a861b689ce` | Invite My Katipan | 03 | RETAIN | 01 visual; 02 backend audit |
| `8275da0c147c4648a73cb2e8851e54db` | More / Settings Hub | 03 | RETAIN | 01 visual; 02 backend audit |
| `9df96942a14c4734849671e04b4be370` | My Weddings | 03 | RETAIN | 01 visual; 02 backend audit |
| `2660bcece31b4b8f89ed4b9c361be0d6` | Privacy & Guest Visibility | 03 | RETAIN | 08 website audiences; 06 seating visibility; 02 capabilities; 01 |
| `920e8f16f2ea4434b4b22dde8f086e83` | Wedding Access & Ownership | 03 | RETAIN | 01 visual; 02 backend audit |
| `cc9eb4285dd846fea49152bcc8c4f6e6` | Wedding Motif & Onboarding Complete | 03 | RETAIN | 04 Motif data; 03 owns onboarding progression; 01 |
| `1f25d64a13e74969a684fb476c593388` | Wedding Team & Coordinator Access | 03 | RETAIN | 01 visual; 02 backend audit |
| `40853f07b29042cdb22c49d5bd778dd4` | Welcome to Katipan | 03 | RETAIN | 01 visual; 02 backend audit |
| `a5b765cecc1a448aaed754b1a6ef9f01` | Add Custom Place | 04 | RETAIN | 01 visual; 02 backend audit |
| `0f9939a7102c44be90e46e562eee8944` | Ceremony & Venue Setup | 04 | RETAIN | 01 visual; 02 backend audit |
| `32592b422653485da231c8a52992e638` | Dress Code & Wedding Motif | 04 | RETAIN | 08 sanitized Guide composition; 03 onboarding consumer; 01 |
| `1a677a73dfc74f658dba3bb5e1254615` | Home Dashboard | 04 | RETAIN | 03 root Back/session; 05 Guest summary; 07 canonical totals; 01 |
| `d0145522a0f842ea8f4a573bd4345497` | Notifications & Reminders | 04 | RETAIN | 02 delivery infrastructure; 03 account lifecycle; 01 |
| `9892e26086f6483a860e7623217b63b8` | Our Places | 04 | RETAIN | 01 visual; 02 backend audit |
| `50a8fd7ad4ba46768082e0cfef285dcf` | Place Details | 04 | RETAIN | 01 visual; 02 backend audit |
| `01598b9a511c4bcc96e80056ce9fee56` | Place Search | 04 | RETAIN | 01 visual; 02 backend audit |
| `b6d0688030cc4acabf230818ba872d3c` | Plan Home | 04 | RETAIN | 01 visual; 02 backend audit |
| `9612866f1eda4870b8aa7f837cb05fb6` | Planning Timeline | 04 | RETAIN | 01 visual; 02 backend audit |
| `fd0b0784634044f8bc586af4ef05402c` | Task Details | 04 | RETAIN | 01 visual; 02 backend audit |
| `ba747a6b61b04c68a88a72bc7a1ab316` | Wedding Checklist | 04 | RETAIN | 01 visual; 02 backend audit |
| `6da61dba2f2247bb97b434a85b7d474c` | Entourage Management | 05 | RETAIN | 01 visual; 02 backend audit |
| `831f2ac9eff147c0bb5b44f0af799c45` | Guest List | 05 | RETAIN | 01 visual; 02 backend audit |
| `db3b28b46d7b4d44a4b6574e8367471c` | Guests Home | 05 | RETAIN | 01 visual; 02 backend audit |
| `7d9aed83410a4d099bc210f9963eb4dd` | Household / Invitation Details | 05 | RETAIN | 01 visual; 02 backend audit |
| `7cf62a6980ed4508ac37bc34d467f659` | Individual Guest Details | 05 | RETAIN | 06 Pass capsule; 04 attire; 09 read-only attendance; 01 |
| `dc03c9f7276641759b7dbb6f61a73756` | Katipan Guest RSVP Form | 05 | RETAIN | 01 visual; 02 backend audit |
| `c7664aafdf2c45188bc2f310b06a32c2` | Katipan RSVP Confirmation | 05 | RETAIN | 01 visual; 02 backend audit |
| `2af9a48db3824804b0e4e0a7af812204` | Assign Guests | 06 | RETAIN | 01 visual; 02 backend audit |
| `8a10dd97f2ad437283fea964b0e22f05` | Seat Assignment | 06 | RETAIN | 01 visual; 02 backend audit |
| `37bcf12ade174183b05931169b2ec437` | Seating Overview | 06 | RETAIN | 01 visual; 02 backend audit |
| `d15b81832e8f4eb292e4864a292c8cf5` | Table Details | 06 | RETAIN | 01 visual; 02 backend audit |
| `a1de105df6424e7ba6f1bc15ecd82d86` | Wedding-Day Guest Pass | 06 | RETAIN | 01 visual; 02 backend audit |
| `09298cf0afb04fd1ac7393cfcd2368d5` | Add Expense | 07 | RETAIN | 01 visual; 02 backend audit |
| `67a5ef2348744326a52c46de11780a12` | Budget Categories | 07 | RETAIN | 01 visual; 02 backend audit |
| `9bd119aa583c4d15a03ddc4b64fefbf0` | Budget Dashboard | 07 | RETAIN | 01 visual; 02 backend audit |
| `9b1a1de7722f49fa948b5b90a90fb384` | Budget Dashboard | 07 | RETAIN | 01 visual; 02 backend audit |
| `5fcef1d558b94455a18d05b6ea20c303` | Category Details & Expenses | 07 | RETAIN | 01 visual; 02 backend audit |
| `e1b9851f737541849ee9248c0c29ea3a` | Payment Details | 07 | RETAIN | 01 visual; 02 backend audit |
| `32aabb6540a045cbb16d0593fce47968` | Payment Schedule | 07 | RETAIN | 01 visual; 02 backend audit |
| `a23d06be3ec24409abbb53b330da36fd` | Supplier Details | 07 | RETAIN | 01 visual; 02 backend audit |
| `74509b36726a4eafa2fd8d5d445e61e1` | Suppliers | 07 | RETAIN | 01 visual; 02 backend audit |
| `8ddd56bf814c458ca5614d05a25663e5` | Guest Wedding Invitation | 08 | RETAIN | 05 RSVP CTA/token authorization; retains guest landing, not native designer; 01 |
| `34734c9d38064818b0345ea04f48c6c5` | Invitation / Website Editor | 08 | RETAIN website; SUPERSEDED_BY_CANVA native artwork portion | 08 owns both disposition decisions; 05 authorization; 04 styling; 01 design |
| `7a148a1efc6f450f8e9d60a3e49d0b61` | Personalized Guest Wedding Guide | 08 | RETAIN | 04 Places/attire; 05 RSVP; 06 seating/pass; 09 published Program; 01 |
| `7d0bb3d1cca64d97be9babc32ad866f0` | Preview & Publish | 08 | RETAIN | 01 visual; 02 backend audit |
| `03964055b9864036ace57eb7a51fc725` | Template Gallery | 08 | RETAIN website; SUPERSEDED_BY_CANVA native artwork portion | 08 owns both disposition decisions; 05 authorization; 04 styling; 01 design |
| `40ccf6e508c044c4b642b39e185ea2a8` | Website Sections & Visibility | 08 | RETAIN | 01 visual; 02 backend audit |
| `36b6f94cc77143d3b8b76e0e80113827` | Guest Check-In | 09 | RETAIN | 01 visual; 02 backend audit |
| `28bad6493953451385d2cea86ca36c4f` | QR Scanner & Manual Check-In | 09 | RETAIN | 01 visual; 02 backend audit |
| `68915eefe91d43d2a4141f030b2dc9e6` | Run of Show | 09 | RETAIN | 01 visual; 02 backend audit |
| `767ab615485449b697eb3ee0d49cb030` | Wedding-Day Dashboard | 09 | RETAIN | 01 visual; 02 backend audit |
| `64964af2332c47a994da83d7236ae10a` | Wedding-Day Dashboard | 09 | RETAIN | 01 visual; 02 backend audit |
| `885c999629214018a0d49eb0cbf8553b` | Wedding-Day Dashboard | 09 | RETAIN | 01 visual; 02 backend audit |

## Native invitation design disposition

Live HTML was retrieved with Stitch download_file for Template Gallery (`03964055b9864036ace57eb7a51fc725`), Invitation / Website Editor (`34734c9d38064818b0345ea04f48c6c5`), and Guest Wedding Invitation (`8ddd56bf814c458ca5614d05a25663e5`). Gallery combines invitation-look language with five website themes and links to Website Sections. Editor combines website persona previews, prose/visibility navigation with cover/style/typography/spacing controls. Guest Invitation is a guest-facing RSVP/Guide landing page, not an artwork editor. This mixed usage is why neither entire website screen is removed.

| Former native concept | Disposition | Retained part |
| --- | --- | --- |
| Native invitation template gallery / Customize Design | SUPERSEDED_BY_CANVA | Existing website theme choice and enum; no data deletion |
| Native invitation artwork editor | SUPERSEDED_BY_CANVA | Website title/introduction, persona preview and structured section editing |
| Invitation typography editor | SUPERSEDED_BY_CANVA | Website typography follows approved website theme/shared tokens |
| Invitation visual layout/decoration/photo editor | SUPERSEDED_BY_CANVA | Website presentation baseline; changes require 08/01 contract |

No additional standalone native artwork screens were found in the 67-entry inventory; do not fabricate IDs. If future inspection reveals one, add it with primary 08 and SUPERSEDED_BY_CANVA, preserving its reference. RSVP, Guide, Wedding Website, Pass, Seating and Wedding Day stay RETAIN. No remote Stitch edits or deletion occurred.

## Design contract and variants

Use DESIGN_REQUIRED for invariant composition, DESIGN_OPTIONAL for nonessential presentation, PLATFORM_ADAPTATION for native/accessibility behavior, BACKEND_CONSTRAINT for required contract corrections, and SUPERSEDED_BY_CANVA only for native artwork design. Tokens/prose conflicts follow actual screen usage with documented canonical values in the existing source of truth. Preserve typography, spacing, colors, shapes, hierarchy, imagery and interaction intent; no redesign merely because implementation changes.

Retain both My Weddings variants, both Budget Dashboards, both coordinator overviews, three Wedding-Day Dashboards and both assignment views. Existing feature notes select Enhanced My Weddings (`9f449d0690074bb0bcb0875d288b24a3`), Budget (`9b1a1de7722f49fa948b5b90a90fb384`), Coordinator-Managed Overview (`4753b63a91304fac884ec6debf7681c5`) and Wedding-Day Dashboard (`885c999629214018a0d49eb0cbf8553b`). Preserve those implementation baselines; Agent 01 verifies them against actual variants and records any justified change rather than silently redesigning. Auth, some forms, Guest Program and future Canva connection screens have no dedicated existing screen: adapt the nearest approved baseline and record the gap, never invent a Stitch ID. New design work is a later task.
