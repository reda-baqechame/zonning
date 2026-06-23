# ZONNING Quebec Validation Research Plan

Date: 2026-06-21
Scope: validate before building more product

## Goal

Prove or kill the thesis:

> Quebec contractors do not need another tender portal. They need better go/no-go intelligence around permits, SEAO, RBQ/AMP/RENA, municipal signals, and site/property context.

## Validation Streams

### 1. Discovery Interviews

Target: 25 Quebec users.

Quota:

- 8 subcontractors.
- 5 material suppliers.
- 5 GCs/estimators.
- 4 developers/consultants.
- 3 public-sector bid/procurement-adjacent experts.

Output:

- Pain ranking.
- Current workflow map.
- Tool stack.
- Time spent finding/qualifying work.
- Missed-opportunity stories.
- Rejection/compliance patterns.
- Willingness-to-pay evidence.

### 2. Focused Thesis Validation

Target: 15 interviews selected from the highest-pain segments.

Hypotheses:

1. Better go/no-go intelligence is more valuable than another tender feed.
2. Permit-to-lead creates actionable sales/bid opportunities.
3. RBQ/AMP/RENA/Revenu Quebec fit saves time and builds trust.
4. Municipal pre-RFP signals are useful only when filtered and tied to action.
5. Specialty subcontractors and suppliers have the shortest path to payment.

### 3. Live Workflow Observations

Target: 10 observations.

Ask the user to share screen and do a real workflow:

- Find one opportunity for next week.
- Decide whether to chase it.
- Show what tools and tabs they open.
- Show where they get stuck.
- Show how they save or send the opportunity internally.
- Show how they check requirements, documents, license fit, and deadline.

Measure:

- Time to first relevant opportunity.
- Number of tools/tabs.
- Number of manual checks.
- Confidence at chase/no-chase decision.
- What data was missing.

### 4. Paid-Intent Tests

Target: 5 tests.

Use a realistic pilot offer:

"For 30 days, ZONNING will deliver a weekly Quebec opportunity qualification report for your trade, territory, license, and target job size. Each opportunity includes source links, permit/tender context, RBQ/RENA/AMP notes where relevant, and a recommended next action."

Test prices:

- $199/month for small trade/supplier.
- $499/month for estimator/BD team.
- Custom pilot for larger teams only if they ask.

Payment-intent levels:

| Level | Evidence |
|---|---|
| 0 | Says interesting only |
| 1 | Wants follow-up but no company data |
| 2 | Shares real criteria/company data |
| 3 | Asks for pilot/start date |
| 4 | Verbally accepts price |
| 5 | Pays, signs pilot, or authorizes invoice |

### 5. Landing-Page / Message Tests

Target: 5 message tests.

Test message variants:

1. "Quebec construction intelligence before the tender."
2. "Stop wasting estimating time on bids you should not chase."
3. "Permits + SEAO + RBQ fit in one weekly opportunity list."
4. "Find Quebec projects before they show up as public tenders."
5. "A Quebec go/no-go cockpit for contractors and suppliers."

Measure:

- Which message users repeat back naturally.
- Which message creates confusion.
- Which message feels believable.
- Which message makes users ask to see examples.
- Which message sounds like another tender portal and should be rejected.

### 6. Manual Concierge Lead Deliveries

Target: 5 customers.

Process:

1. Collect customer profile:
   - Trade/scope.
   - RBQ license/classes.
   - Territory.
   - Minimum/maximum job size.
   - Target buyers.
   - Excluded work.
   - Capacity and preferred timing.
2. Manually build a weekly list of 10 to 25 opportunities/signals.
3. Include:
   - Source link.
   - Location.
   - Buyer/owner/project context.
   - Permit/tender/status.
   - Deadline or stage.
   - Fit reason.
   - Risk reason.
   - Recommended next action.
4. Review list live with the user.
5. Ask which items they would act on and why.

Success:

- User acts on at least 2 items.
- User identifies at least 1 item they would not have found quickly.
- User says the qualification notes changed priority.
- User wants next week's list.

Failure:

- User says all items were obvious, irrelevant, too late, or impossible to act on.

## Scorecards

### Pain Score

| Score | Meaning |
|---:|---|
| 1 | Mild annoyance |
| 2 | Occasional problem |
| 3 | Weekly inefficiency |
| 4 | Costly missed/wasted opportunity |
| 5 | Budget-worthy urgent pain |

### Current Tool Completeness

| Score | Meaning |
|---:|---|
| 1 | Current tools solve it well |
| 2 | Small gaps only |
| 3 | Several manual checks |
| 4 | Fragmented and slow |
| 5 | Major gap, no trusted workflow |

### Actionability Score

| Score | Meaning |
|---:|---|
| 1 | Interesting but no action |
| 2 | Might save/search later |
| 3 | Would discuss internally |
| 4 | Would contact buyer/owner or prep bid |
| 5 | Would act this week |

## Go Criteria

Proceed to product work only if:

- 8 of 15 focused users call the problem painful and current tools incomplete.
- 5 of 15 share real company data to test matching.
- 3 of 15 show payment intent or accept a pilot price.
- 5 users say ZONNING found or qualified something they would not have found quickly in SEAO/MERX.
- At least 2 concierge customers ask for another delivery.

## Kill Or Pivot Criteria

Pivot if:

- Users only want cheaper MERX/SEAO.
- Users do not trust permit-derived leads.
- Users cannot describe what action they would take.
- Users say the intelligence is interesting but not worth paying for.
- Users insist official tender document/submission workflow is the main need.
- ZONNING cannot produce enough relevant weekly signals for a narrow trade/territory.

## Research Calendar

### Week 1: Setup

- Finalize interview list and recruiting messages.
- Build spreadsheet tracker.
- Build competitor UX scorecards.
- Prepare first 5 concierge sample reports manually.

### Week 2: Discovery

- Run 10 to 12 interviews.
- Run 3 workflow observations.
- Expand Reddit/LinkedIn listening.
- Start competitor first-10-minute recordings.

### Week 3: Validation

- Run remaining interviews.
- Run 7 workflow observations.
- Deliver 5 concierge reports.
- Run message tests.

### Week 4: Decision

- Score hypotheses.
- Decide wedge, segment, and minimum product.
- Delete unverifiable claims.
- Produce feature priority map.

## Interview Script

Use the full guide in `docs/research/INTERVIEW_GUIDE.md`.

Core questions:

1. Walk me through how you found the last opportunity you chased.
2. What tools did you check?
3. How long did it take to decide whether to chase?
4. What made you say yes or no?
5. What compliance or license checks did you need?
6. Tell me about an opportunity you missed.
7. Tell me about a bid you should not have chased.
8. What would make a weekly Quebec opportunity report worth paying for?
9. If I found 10 matching leads this week, what would you need to trust them?
10. What would make you cancel after one month?

## Required Evidence Artifacts

For every participant:

- Segment.
- Company size.
- Region.
- Trade or role.
- Current tools.
- Pain score.
- Tool completeness score.
- Actionability score.
- Payment-intent level.
- Exact phrase that describes the pain.
- One missed/wasted opportunity story.
- One concrete next action they would take from ZONNING.

## Decision Template

After validation, answer:

- Winning segment:
- Main pain:
- Current workaround:
- Strongest willingness-to-pay evidence:
- Strongest product promise:
- First product scope:
- Claims to remove:
- Features to delay:
- Data sources required:
- Next 30-day build target:
