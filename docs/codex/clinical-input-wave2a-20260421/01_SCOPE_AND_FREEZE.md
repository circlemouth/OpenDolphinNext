# Wave 2A scope and freeze

## In scope
- diagnosis date/outcome validation and tests
- SOAP performDate validation and tests
- parser logging hardening for ordinary invalid input
- `/karte/document` POST/PUT server audit hooks and tests
- DADS-critical visible labels/support text/error/disabled reason/patient identity visibility in disease/SOAP/document save contexts
- test updates that flip Wave 1 characterization tests from known-bad behavior to desired fail-closed or corrected behavior

## Explicitly out of scope
- order set extended field preservation policy/implementation
- ORCA official compatibility confirmation
- live ORCA mutation
- Phase 3 / Phase 4 / fullflow / reception registration mutation
- full repo CI gate / broad static-analysis verify
- Playwright raw artifact generation
- broad visual redesign beyond DADS-critical minimum fixes

## If blocked by product/spec ambiguity
Do not guess silently. Keep the production change conservative, document the ambiguity, and leave a narrow blocker in the final report.
