# Stitch UI source of truth

Retrieved from Stitch MCP on 2026-09-27. Project **Katipan Wedding Planner UI System** (`13691899610292683671`), design system **Warm Editorial Nuptial** (`assets/abc9492ec46641418007fbb73b75456e`). The project contains **61 mobile UI screens** and **6 visual asset entries**. Route paths below are planned, not implemented in this foundation branch.

## Source precedence and canonical tokens

1. Query the matching Stitch screen and the project design system before each UI task. Inspect its screenshot and structure in context.
2. A screen's actual visual usage wins for that screen; use structured design system tokens for shared semantic roles. Use design prose to explain intent and identify editorial accents. Record exceptions rather than overwriting shared tokens silently.
3. Accessibility, native behavior, and the locked V1 backend/domain contract may require adaptations. Record each intentional deviation with its reason in the relevant feature PR.
4. Stitch HTML is reference material, not React Native implementation code. Components derive from recurring visual patterns.

The structured Stitch palette specifies `primary #485943`, `primary_container #60725A`, `secondary #775A19`, `surface #FFF8F5`, and `on_surface #1E1B19`. Its prose instead calls `#60725A` primary sage, `#C5A059` antique gold, `#FAF8F5` canvas, `#FDFBF7` card, and `#1C1917` text. The shared tokens preserve structured semantic roles and expose the prose values as explicitly named editorial accents. The primary button uses the prose sage `#60725A` because that is the specified button treatment. Screen-specific adoption requires checking actual screenshots. The structured radius scale (4/8/12/16/24 px) also differs from prose card guidance (16/24 px); cards use 24 px and inputs use 12 px. Spacing uses 4/8/16/24/36 px plus the 20 px mobile margin.

## Product-flow grouping

- **Access/onboarding:** Welcome to Katipan → Create Our Wedding → Couple & Wedding Details → Wedding Motif & Onboarding Complete → Invite My Katipan.
- **Coordinator:** Coordinator Onboarding → Create Client Wedding → Invite Couple to Katipan / Ownership Transition → Coordinator-Managed Wedding Overview. Coordinator Wedding Overview is a second overview treatment.
- **Workspace:** My Weddings / Enhanced My Weddings → Home Dashboard → Plan Home, Guests Home, Budget Dashboard, and More / Settings Hub.
- **Planning and places:** checklist, tasks, timeline, Run of Show, notifications, then place search, custom place, place details, and place purposes.
- **Suppliers and finance:** suppliers, supplier details, commitments/payment schedule/details, budget categories, category expenses, and add expense.
- **Guests and website:** individual guests, Household invitation grouping, entourage, dress code, website editing/publishing, guest invitation, token-scoped RSVP, confirmation, and personalized guide.
- **Seating, Guest Pass, Wedding Day:** event/table/assignment views, independent pass, then day dashboard, check-in, and scanner/manual check-in.
- **Settings:** team and coordinator access, ownership, privacy, and guest visibility.

## Complete screen inventory and proposed routes

| Flow | Stitch screen | Screen ID | Planned route |
| --- | --- | --- | --- |
| Access/onboarding | Couple & Wedding Details | `f12a02d5acfa435f97c8263961825b61` | `/(access)/wedding-details` |
| Suppliers/finance | Budget Categories | `67a5ef2348744326a52c46de11780a12` | `/(wedding)/[weddingId]/budget/categories` |
| Workspace | Enhanced My Weddings | `9f449d0690074bb0bcb0875d288b24a3` | `/(workspace)/weddings` |
| Coordinator | Coordinator Wedding Overview | `d99ee81c2e8743ce99a87253259dcc35` | `/(coordinator)/[weddingId]/overview` |
| Suppliers/finance | Payment Details | `e1b9851f737541849ee9248c0c29ea3a` | `/(wedding)/[weddingId]/suppliers/[supplierId]/payments/[paymentId]` |
| Website | Dress Code & Wedding Motif | `32592b422653485da231c8a52992e638` | `/(wedding)/[weddingId]/website/dress-code` |
| Guests/RSVP | Household / Invitation Details | `7d9aed83410a4d099bc210f9963eb4dd` | `/(wedding)/[weddingId]/guests/households/[householdId]` |
| Workspace | More / Settings Hub | `8275da0c147c4648a73cb2e8851e54db` | `/(wedding)/[weddingId]/more` |
| Website | Template Gallery | `03964055b9864036ace57eb7a51fc725` | `/(wedding)/[weddingId]/website/templates` |
| Settings | Privacy & Guest Visibility | `2660bcece31b4b8f89ed4b9c361be0d6` | `/(wedding)/[weddingId]/privacy` |
| Seating | Table Details | `d15b81832e8f4eb292e4864a292c8cf5` | `/(wedding)/[weddingId]/seating/tables/[tableId]` |
| Website | Preview & Publish | `7d0bb3d1cca64d97be9babc32ad866f0` | `/(wedding)/[weddingId]/website/preview` |
| Planning | Run of Show | `68915eefe91d43d2a4141f030b2dc9e6` | `/(wedding)/[weddingId]/plan/run-of-show` |
| Access/onboarding | Create Our Wedding | `d53e9d8d88584c57b5e9999fe1f2fe48` | `/(access)/create-wedding` |
| Planning | Notifications & Reminders | `d0145522a0f842ea8f4a573bd4345497` | `/(wedding)/[weddingId]/notifications` |
| Seating | Seating Overview | `37bcf12ade174183b05931169b2ec437` | `/(wedding)/[weddingId]/seating` |
| Guests/RSVP | Katipan RSVP Confirmation | `c7664aafdf2c45188bc2f310b06a32c2` | `web: /w/[slug]/rsvp/confirmation` |
| Workspace | Budget Dashboard | `9b1a1de7722f49fa948b5b90a90fb384` | `/(wedding)/[weddingId]/budget` |
| Guests/RSVP | Guest Wedding Invitation | `8ddd56bf814c458ca5614d05a25663e5` | `web: /w/[slug]/invitation` |
| Workspace | Budget Dashboard | `9bd119aa583c4d15a03ddc4b64fefbf0` | `/(wedding)/[weddingId]/budget` |
| Settings | Wedding Team & Coordinator Access | `1f25d64a13e74969a684fb476c593388` | `/(wedding)/[weddingId]/team` |
| Wedding Day | Wedding-Day Dashboard | `64964af2332c47a994da83d7236ae10a` | `/(wedding)/[weddingId]/day` |
| Guests/RSVP | Individual Guest Details | `7cf62a6980ed4508ac37bc34d467f659` | `/(wedding)/[weddingId]/guests/[guestId]` |
| Guests/RSVP | Entourage Management | `6da61dba2f2247bb97b434a85b7d474c` | `/(wedding)/[weddingId]/guests/entourage` |
| Places | Place Search | `01598b9a511c4bcc96e80056ce9fee56` | `/(wedding)/[weddingId]/places/search` |
| Workspace | Plan Home | `b6d0688030cc4acabf230818ba872d3c` | `/(wedding)/[weddingId]/plan` |
| Seating | Seat Assignment | `8a10dd97f2ad437283fea964b0e22f05` | `/(wedding)/[weddingId]/seating/assign` |
| Planning | Wedding Checklist | `ba747a6b61b04c68a88a72bc7a1ab316` | `/(wedding)/[weddingId]/plan/checklist` |
| Places | Our Places | `9892e26086f6483a860e7623217b63b8` | `/(wedding)/[weddingId]/places` |
| Website | Personalized Guest Wedding Guide | `7a148a1efc6f450f8e9d60a3e49d0b61` | `web: /w/[slug]` |
| Planning | Task Details | `fd0b0784634044f8bc586af4ef05402c` | `/(wedding)/[weddingId]/plan/tasks/[taskId]` |
| Guests/RSVP | Guest List | `831f2ac9eff147c0bb5b44f0af799c45` | `/(wedding)/[weddingId]/guests/list` |
| Coordinator | Coordinator-Managed Wedding Overview | `4753b63a91304fac884ec6debf7681c5` | `/(coordinator)/[weddingId]/overview` |
| Guests/RSVP | Katipan Guest RSVP Form | `dc03c9f7276641759b7dbb6f61a73756` | `web: /w/[slug]/rsvp` |
| Planning | Planning Timeline | `9612866f1eda4870b8aa7f837cb05fb6` | `/(wedding)/[weddingId]/plan/timeline` |
| Website | Invitation / Website Editor | `34734c9d38064818b0345ea04f48c6c5` | `/(wedding)/[weddingId]/website` |
| Suppliers/finance | Add Expense | `09298cf0afb04fd1ac7393cfcd2368d5` | `/(wedding)/[weddingId]/budget/expenses/new` |
| Wedding Day | Wedding-Day Dashboard | `885c999629214018a0d49eb0cbf8553b` | `/(wedding)/[weddingId]/day` |
| Suppliers/finance | Suppliers | `74509b36726a4eafa2fd8d5d445e61e1` | `/(wedding)/[weddingId]/suppliers` |
| Workspace | Home Dashboard | `1a677a73dfc74f658dba3bb5e1254615` | `/(wedding)/[weddingId]/home` |
| Guest Pass | Wedding-Day Guest Pass | `a1de105df6424e7ba6f1bc15ecd82d86` | `web: /w/[slug]/pass` |
| Seating | Assign Guests | `2af9a48db3824804b0e4e0a7af812204` | `/(wedding)/[weddingId]/seating/assign` |
| Settings | Wedding Access & Ownership | `920e8f16f2ea4434b4b22dde8f086e83` | `/(wedding)/[weddingId]/access` |
| Suppliers/finance | Category Details & Expenses | `5fcef1d558b94455a18d05b6ea20c303` | `/(wedding)/[weddingId]/budget/categories/[categoryId]` |
| Workspace | My Weddings | `9df96942a14c4734849671e04b4be370` | `/(workspace)/weddings` |
| Places | Add Custom Place | `a5b765cecc1a448aaed754b1a6ef9f01` | `/(wedding)/[weddingId]/places/new` |
| Suppliers/finance | Supplier Details | `a23d06be3ec24409abbb53b330da36fd` | `/(wedding)/[weddingId]/suppliers/[supplierId]` |
| Wedding Day | Guest Check-In | `36b6f94cc77143d3b8b76e0e80113827` | `/(wedding)/[weddingId]/day/check-in` |
| Access/onboarding | Wedding Motif & Onboarding Complete | `cc9eb4285dd846fea49152bcc8c4f6e6` | `/(access)/motif-complete` |
| Wedding Day | QR Scanner & Manual Check-In | `28bad6493953451385d2cea86ca36c4f` | `/(wedding)/[weddingId]/day/scan` |
| Coordinator | Create Client Wedding | `2689ca94563540339ca1edbd62884161` | `/(coordinator)/create-client-wedding` |
| Workspace | Guests Home | `db3b28b46d7b4d44a4b6574e8367471c` | `/(wedding)/[weddingId]/guests` |
| Coordinator | Coordinator Onboarding | `a7970cf399a44499b12d921b316d9db1` | `/(coordinator)/onboarding` |
| Website | Website Sections & Visibility | `40ccf6e508c044c4b642b39e185ea2a8` | `/(wedding)/[weddingId]/website/sections` |
| Suppliers/finance | Payment Schedule | `32aabb6540a045cbb16d0593fce47968` | `/(wedding)/[weddingId]/suppliers/[supplierId]/schedule` |
| Places | Ceremony & Venue Setup | `0f9939a7102c44be90e46e562eee8944` | `/(wedding)/[weddingId]/places/purposes` |
| Coordinator | Invite Couple to Katipan / Ownership Transition | `72c44d6876884247826048a2bb72f789` | `/(coordinator)/[weddingId]/invite-couple` |
| Places | Place Details | `50a8fd7ad4ba46768082e0cfef285dcf` | `/(wedding)/[weddingId]/places/[placeId]` |
| Access/onboarding | Invite My Katipan | `586c03b4559547ff994754a861b689ce` | `/(access)/invite-partner` |
| Wedding Day | Wedding-Day Dashboard | `767ab615485449b697eb3ee0d49cb030` | `/(wedding)/[weddingId]/day` |
| Access/onboarding | Welcome to Katipan | `40853f07b29042cdb22c49d5bd778dd4` | `/(access)/welcome` |

## Duplicates and variants

- **My Weddings / Enhanced My Weddings:** two selection workspace treatments (4848 px and 4958 px Stitch canvases). They map to one wedding switcher route. Use the enhanced screen for the later workspace treatment after checking its actual content and retain the base screen as an onboarding/reference variant.
- **Coordinator Wedding Overview / Coordinator-Managed Wedding Overview:** two coordinator overview treatments (4396 px versus 5152 px canvases). They map to one coordinator overview route; the latter explicitly names the managed wedding state. Do not infer a different ownership model from the title.
- **Budget Dashboard:** two distinct screen IDs, 4196 px and 3992 px canvases, map to one budget route. Their shared title does not establish which treatment is final. Inspect both screenshots at implementation time and record the selected layout.
- **Wedding-Day Dashboard:** three distinct screen IDs, 4060 px, 4032 px, and 4024 px canvases, map to one day dashboard route. Treat these as visual variants, not separate check-in states or data contracts. Inspect the three screens together before choosing a canonical composition.
- **Assign Guests / Seat Assignment:** two seating task views. Use one assignment flow with an overview/picker state if the screens support it; one active assignment per guest per event remains the contract.

These distinctions are limited to titles, dimensions, and project screen entries returned by Stitch MCP. The MCP response supplies screenshot and HTML download references but no inline image or HTML content. Those download URLs were inaccessible in this environment, so detailed visual differences between identically titled screens remain to be confirmed in Stitch before implementing those screens.

## Reusable component candidates

Implemented in the mobile foundation: `KatipanScreen`, `KatipanText`, `KatipanButton`, `EditorialCard`, `SectionHeader`, `StatusChip`, `FormField`, `LoadingState`, `EmptyState`, and `ErrorState`. Later screen work can add photo frames, milestone/countdown cards, progress bars, filter and motif chips, checklist rows, supplier cards, individual guest rows, table assignment rows, timeline entries, and pass/check-in presentation. Shared components must keep the semantic Wedding, Guest, Supplier, and finance sources distinct.

## Available visual assets

Stitch has the following visual asset entries. IDs identify source entries; screenshot URLs are transient and are intentionally not committed. No asset is bundled into the app by this foundation branch.

| Asset entry | ID |
| --- | --- |
| Close up couple portrait photo of an attractive modern Filipino couple smiling warmly together in soft golden hour light, romantic natural wedding aesthetic, candid joy, warm editorial lighting, high resolution | `4608062ebe1e4685ab1f8ea1dced6576` |
| Full-length artistic portrait of an attractive stylish modern Filipino couple in an outdoor garden wedding setting, groom in modern light linen barong, bride in modern romantic lace dress, soft golden sunlight, lush tropical green leaves and sampaguita flowers, editorial luxury magazine style, calm romantic warmth, high resolution photography | `d54ca987052b4c8d9ac039d04b850bbb` |
| Modern intimate beach wedding setup in the Philippines with bamboo canopy and flowing white linen drapes on pristine white sand, calm turquoise sea in background, sunset golden glow, elegant luxury wedding destination | `fbd7c40da2134e85858ea790d98580a9` |
| Katipan Interlocking Rings Brandmark | `3dfbe2a0e4344cc786ec71c3b04a439d` |
| Scenic open-air romantic garden wedding venue pavilion with wooden arches covered in white flowers and eucalyptus vines, outdoor manicured green lawn in Antipolo Philippines, soft afternoon golden light, luxury intimate venue | `00b48f1476dc4156bd36a1c9279a2a42` |
| Romantic warm overhead flatlay photo of wedding planning accessories on a warm ivory linen surface: elegant calligraphy vow notebook, wedding rings in velvet box, sprig of olive and sampaguita, warm gold pen, modern stationery with sage green ribbon, soft editorial lighting | `c6e13256bc99425b85a5b6591f523329` |

## Design inconsistencies and locked behavior

- Structured palette and prose disagree on primary, secondary, canvas, card, and text hex values; the resolution above keeps both sources visible and assigns them different roles.
- Native React Native shadows cannot express Stitch's two-layer CSS ambient shadow exactly. The foundation card uses one soft espresso shadow plus a low Android elevation; a future native screenshot review should tune the perceptual match. Frosted backdrop blur and gradient hairlines are deferred until a screen needs them.
- Font files ship through the installed Expo Google Fonts packages and load from the application bundle. The temporary blank layout while local fonts load prevents a fallback-font flash; no font is downloaded at runtime.
- The project contains repeated titles without variant labels or a declared final version. Route mapping consolidates them provisionally and requires screen inspection when those features are built.
- During feature implementation, reconcile screen interactions with the V1 contract: individual responses/check-ins, token-scoped RSVP, independent Guest Pass, explicit schedule review, and independent client acceptance. Document any screen-level correction in its feature PR.
- The guest guide, invitation, RSVP, and pass are planned for the canonical web route `/w/[slug]`; an Expo route must not replace that URL.
