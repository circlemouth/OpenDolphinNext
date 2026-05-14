# P0-D Subagent Prompts

RUN_ID: `20260514T201736Z`

Shared constraints for all subagents:

- Use model `gpt-5.4` with high reasoning.
- Work only in the assigned worktree.
- Do not modify `client/` or `server/` legacy trees.
- Do not preserve unsafe backward compatibility.
- Do not include secrets, raw ORCA body, patient details, `node_modules`, `target`, `dist`, `build`, cache, or IDE settings in reports.
- Treat `web-client/` and `server-modernized/` as the active implementation.
- Final answer/report must be Japanese or concise bilingual where file names/route names require English.
- Commit only your own work in your assigned worktree if requested by the main agent; otherwise leave changes ready for merge.

## Subagent A: Route/API Contract And Legacy Local Write Removal

Worktree: `../worktrees/p0d-route-contract`

Task:

1. Remove old local prescription write routes from production public route inventory:
   - `POST /api/local/prescription-orders`
   - `POST /api/local/prescription-orders/do-import`
   - any `PUT/PATCH/DELETE /api/local/prescription-orders*`
2. Make `LocalPrescriptionOrderResource` production-runtime unreachable for mutation. If retained, it must be read-only cache/projection only.
3. Update `OpenDolphinRestApplication` resource registration as needed.
4. Update `PublicRouteInventoryContractTest` to assert:
   - old local write routes are absent,
   - taxonomy-external `/api/prescriptions` routes are absent,
   - prescription mutation route exists only under `/api/local/prescription-orders/authority`.
5. Update `docs/contracts/orca-route-taxonomy.md`.
6. Run route inventory focused tests.
7. Write report: `docs/implementation/p0d-prescription-authority-unification/subagent-a-route-contract-report.md`.

Forbidden:

- Do not reintroduce aliases, shims, debug routes, import routes, or fallback routes for old local writes.

## Subagent B: DB Repository And Source Boundary

Worktree: `../worktrees/p0d-db-repository-boundary`

Task:

1. Find all insert/update/delete paths into `orca_prescription_orders`.
2. Remove prescription source-of-truth writes into `orca_prescription_orders`.
3. If the table remains, document and enforce it as ORCA-derived cache/projection/read model only.
4. Ensure authority tables and `prescription_order_event` are the only prescription source-of-truth mutation targets.
5. Add migration guard if needed to detect/prevent app misuse of legacy table.
6. Strengthen finalized direct write guard and event append-only tests.
7. Update docs/contracts source boundary.
8. Run repository/schema focused tests.
9. Write report: `docs/implementation/p0d-prescription-authority-unification/subagent-b-db-repository-boundary-report.md`.

Forbidden:

- Do not keep `orca_prescription_orders` as a prescription authority table.
- Do not leave a hash-chain-bypassing mutation.

## Subagent C: Authority Hash Chain And Facility Isolation

Worktree: `../worktrees/p0d-authority-hash-facility`

Task:

1. Review `PrescriptionAuthorityResource`, `PrescriptionAuthorityRepository`, service helpers, and tests.
2. Ensure create/finalize/change/stop/cancel/reissue/resend all append `prescription_order_event` with non-null `previous_event_hash` and `event_hash`.
3. Ensure hash material includes at least order id, event type, actor, timestamp, before payload hash, after payload hash, previous hash. Keep revision id if already used.
4. Change repository mutation/load methods so facility id is required. No mutation may load by order id alone.
5. Resolve facility only from authenticated remote user/session/server-side tenant context. Do not use `X-Facility-Id` as authority.
6. Add tests for spoofed header, cross-facility order id, missing facility, finalized direct write guard, and tamper detection.
7. Run authority/hash/facility focused tests.
8. Write report: `docs/implementation/p0d-prescription-authority-unification/subagent-c-authority-hash-facility-report.md`.

Forbidden:

- Do not leave any authority repository mutation by order id alone.
- Do not allow client-provided facility/owner/role/digest as authority.

## Subagent D: Web Client API Migration And UI Safety

Worktree: `../worktrees/p0d-web-client-prescription-api`

Task:

1. Find all web-client references to:
   - `/api/local/prescription-orders`
   - `do-import`
   - `/api/prescriptions`
   - prescription create/update/finalize/cancel/stop/reissue/resend APIs.
2. Move prescription mutation calls to authority route only.
3. Remove old local write endpoint calls from production source, metadata, mocks, and tests.
4. Add/update web-client API contract tests proving old local write endpoint is not called.
5. If UI changes are needed, follow DADS/medical safety:
   - patient identity repeated in confirm flow,
   - ORCA warning/unmatch/UNKNOWN/failure visible by default,
   - no placeholder-as-instruction,
   - disabled reason shown next to control,
   - cancel/back left and confirm/send right.
6. Run related Vitest/typecheck as feasible.
7. Write report: `docs/implementation/p0d-prescription-authority-unification/subagent-d-web-client-prescription-api-report.md`.

Forbidden:

- Do not keep old local write endpoint as fallback.
- Do not hide medical safety warnings in initially closed accordion/details.

## Subagent E: Tests Docs And Deliverable Support

Worktree: `../worktrees/p0d-tests-docs-deliverable`

Task:

1. Confirm test coverage exists for:
   - route inventory,
   - taxonomy-external route detection,
   - old local write route absence,
   - `do-import` absence,
   - facility header spoofing,
   - cross-facility prescription rejection,
   - finalized write guard,
   - event hash chain,
   - hash tamper detection,
   - `orca_prescription_orders` source write prohibition,
   - web-client old local write endpoint non-use,
   - unauthorized prescription operation.
2. Update docs implementation README with final status sections.
3. Create `route-inventory-after.md`.
4. Create `final-validation-checklist.md`.
5. List deliverable zip include/exclude policy.
6. Run available docs/test checks as feasible.
7. Write report: `docs/implementation/p0d-prescription-authority-unification/subagent-e-tests-docs-deliverable-report.md`.

Forbidden:

- Do not paper over missing code fixes with docs.
- Do not include generated artifacts or secrets in deliverable guidance.
