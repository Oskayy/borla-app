---
target: driver app (Tonight, Account, Earnings)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Projects\\borla-app\\components\\driver\\TonightView.tsx"
target_fingerprint: "sha256:c0299597a3648f8e9c5d3f9c8d71aaec379a4f211f04ce454f5ab283407f1822"
target_path: "C:\\Projects\\borla-app\\components\\driver\\TonightView.tsx"
timestamp: 2026-10-06T10-34-30Z
slug: components-driver-tonightview-tsx
---
# Critique: driver app (Tonight, Account, Earnings), 6 Oct 2026
Method: dual-agent (A: design review · B: detector + browser)
Score 26/40 (Acceptable). Heuristics: 1=2, 2=3, 3=3, 4=2, 5=3, 6=3, 7=3, 8=2, 9=3, 10=2.
Detector: 2 advisory (text-[17px] at TonightView.tsx:111,155); browser: email truncated on /account (intentional ellipsis).
## Priority issues
- [P1] Stops show the customer's price, not the driver's pay (TonightView.tsx:115; driver/page.tsx:93). Fix: show "Your pay GHS X" from PayoutRule and platform fee.
- [P1] Payday and flagged-pickup messages vanish on refresh (ConfirmTripUnload 60-66, confirm-pickup-button 53-60). Fix: keep the result on the trip header / a live region.
- [P1] On phones the accept countdown sits below the status cards (TonightView 241-257). Fix: accept card first; slim online strip; drop duplicate shift chip on mobile.
- [P2] Pending drivers see no approval status in Account/Earnings; only Tonight redirects. Fix: status banner in the driver layout.
- [P2] Decline sheet has 6 options; every accepted stop shows the full action stack. Fix: 4 reasons; live actions only on the current stop.
## Minor
No-Kicker: "Then unload at" uppercase label; Legend: earnings "+GHS"/"Sent" in customer green, map "You" dot #3b82f6; "order(s)" in ConfirmTripUnload; raw Supabase error text; role=switch label contradiction; button nested in link (InfoTip in AccountRow); Communication says SMS though SMS is parked; Privacy "contact Trashit" with no channel; "Balance" vs "Available" wording; Tax documents duplicates statements.
