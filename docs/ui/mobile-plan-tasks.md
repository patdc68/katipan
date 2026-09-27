# Mobile Plan and Tasks

## Stitch source review

Inspected the exact screens in the Katipan Wedding Planner UI System and the Warm Editorial Nuptial design system:

- Plan Home — b6d0688030cc4acabf230818ba872d3c
- Wedding Checklist — ba747a6b61b04c68a88a72bc7a1ab316
- Task Details — fd0b0784634044f8bc586af4ef05402c

The implementation keeps the shared Wedding tab shell, warm ivory canvas, Playfair Display headings, Plus Jakarta Sans body copy, sage actions, compact status pills, soft card borders, and generous mobile spacing. It uses the existing reusable EditorialCard, SectionHeader, StatusChip, FormField, and WeddingDateField components.

## Screen behavior

- **Plan Home** summarizes live Wedding task progress and shows categories, overdue tasks, upcoming tasks, recently completed tasks, and a Checklist shortcut.
- **Wedding Checklist** groups tasks by their saved Wedding category. Category, status, priority, and due-date filters work together. Rows show status, priority, due state, and assignee names.
- **Task Details** shows task content, category, status, priority, dates, assignees, dependencies, and available private notes. Authorized users can edit details, change status, assign active members, and manage dependencies.
- Create and edit use the existing Wedding task contract. Date selection follows the native Wedding date picker on iOS and Android and the calendar input on web. Dates are kept as YYYY-MM-DD calendar values.

## Intentional deviations

- Stitch screenshots contain illustrative tasks, progress, categories, and people. The app shows only records returned for the selected Wedding and never inserts sample planning data.
- Planning Timeline and Run of Show actions are omitted from Plan Home and navigation in this slice.
- The Checklist adds explicit priority and due-date filters to meet the requested V1 behavior.
- Task write actions appear for active Owners and Full Coordinators, matching can_manage_wedding_planning and the existing RPCs. Day-of and Guest Coordinators can view planning data but cannot write it.
- Existing task SELECT RLS makes private_notes readable to active Wedding members. The app shows saved notes under that contract; only Owners and Full Coordinators can edit them through the task update RPC.
- The Task Details screen exposes dependency links without cascading later task dates or statuses. Cycle validation remains in the database RPC and trigger.

## Backend and security

The live project and repository migration contain the requested task_categories, planning_tasks, planning_task_assignees, and planning_task_dependencies contracts, the four task statuses and four priority values, and all seven requested RPCs. No migration was needed.

Every planning read is filtered by the active route Wedding. Task mutations first confirm that task IDs, category IDs, assignee memberships, and dependency task IDs belong to the selected Wedding. Writes use the existing RPCs; the client does not directly insert, update, or delete task workflow records. The existing workspace cache revision and keyed Wedding tab shell invalidate Plan state when Wedding context changes.

The client keeps task dates as local calendar strings and converts picker selections using local calendar fields, avoiding timezone date shifts. Completion timestamps and dependency cycle checks remain backend-owned.

## Verification

- Repository lint and typecheck passed.
- All 49 Vitest tests passed.
- The root build passed; Expo exports passed for Android, iOS, and web.
- A high-confidence credential-pattern scan found no matches in the feature files. Gitleaks and TruffleHog are not installed in this environment.
- Cached and working diff checks passed.
- The three Stitch screenshots were reviewed directly. This environment had no connected browser or device surface for capturing the running app, so a runtime screenshot comparison was unavailable.
