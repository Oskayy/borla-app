---
target: ops console
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Projects\\borla-app\\components\\ops\\OpsShell.tsx"
target_fingerprint: "sha256:73f54b9870a830767e0cb99c83f7eefb16bc18175e7cd4a1af7332638416ef98"
target_path: "C:\\Projects\\borla-app\\components\\ops\\OpsShell.tsx"
timestamp: 2026-10-06T10-34-30Z
slug: components-ops-opsshell-tsx
---
# Critique: ops console, 6 Oct 2026
Method: dual-agent (A: design review · B: detector + browser)
Score 27/40 (Acceptable). Heuristics: 1=3, 2=3, 3=3, 4=2, 5=2, 6=3, 7=2, 8=3, 9=3, 10=3.
Detector: 12 advisory (5 AssignMap marker colours: false positives; 7 text-[11px] in OpsShell/AlertBell: badges match the 11px pill spec, uppercase group labels are No-Kicker violations). Browser overlay skipped (no staff session).
## Priority issues
- [P1] Money actions without amount echo or confirm ("Send via Paystack", refund "Confirm", "Approve and pay the driver"). Fix: amount and recipient in the label; two-step confirm for sends.
- [P1] Amber used as a warning/in-progress tone across ops (kit.tsx tone 'driver', health warn, conflicts KPI, refund states) — Legend Rule. Fix: neutral "pending" tone; amber only for driver-held things; replace #22a06b.
- [P1] Assign at scale/phone: a full-driver select per order, map below cards on phone, driver cards not keyboard-selectable. Fix: top-3 eligible + More; card header as button; map/list toggle on phone.
- [P2] Overview lacks time urgency (cutoff, oldest unassigned, expiring accept windows).
- [P2] No-Kicker: uppercase 11px tracked labels in OpsShell (nav groups, Night shift, Operations console, System).
## Minor
Raw payment status "(success)" in Exceptions; AssignMap style fixed at mount (no dark switch); OptimizeForm duplicates PlanBoard; stop numbers amber in list vs green on map; approvals lack side-by-side ID vs photo.
