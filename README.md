# Service Sim Studio

# MASTER BUILD PROMPT — LOVABLE

## Project: AI-Powered Customer Support & Service Automation

Act as a senior full-stack developer, UI/UX designer, software architect, and QA engineer. Build a complete, polished, fully interactive customer support automation platform called **AI-Powered Customer Support & Service Automation**.

The application is being developed for a SkillWallet Salesforce Administrator learning project. It should demonstrate the real-world functionality of Salesforce Service Cloud, Salesforce Flows, Agentforce AI Service Agent, Prompt Builder, case management, approval workflows, security, reporting, and dashboards through a working standalone web application.

**CRITICAL REQUIREMENT: BUILD A FUNCTIONAL END-TO-END APPLICATION, NOT A STATIC MOCKUP.**

Every visible button, navigation item, form, filter, status dropdown, automation action, and dashboard interaction must work. The entire project must be demonstrable in simulation mode without Salesforce credentials, a Salesforce org, a paid AI API, or external integrations.

---

# 1. TECHNOLOGY STACK

Use the following stack:

- Frontend: React + TypeScript.
- Styling: Tailwind CSS.
- UI components: shadcn/ui.
- Icons: Lucide React.
- Charts: Recharts.
- Routing: React Router.
- State management: React Context or a suitable lightweight state-management solution.
- Persistence: localStorage for reliable, standalone simulation mode.
- Optional backend: Supabase can be added later, but the core application must work without it.
- AI: A deterministic mock AI service with configurable templates and realistic responses. If a real AI integration is added later, keep the mock service available as a fallback.

Do not use fake buttons, placeholder pages, dead links, or nonfunctional controls.

Keep the application modular, responsive, maintainable, and easy to extend.

# 2. APPLICATION IDENTITY AND DESIGN

Application name: AI-Powered Customer Support & Service Automation.

Business scenario: An international electronics and gadgets company receives many customer inquiries about product defects, delivery tracking, warranty claims, refunds, returns, and general support.

The company wants to reduce manual work, improve response times, route cases accurately, and monitor customer satisfaction.

Design a premium enterprise SaaS dashboard inspired by Salesforce Lightning Experience.

Design requirements:

- Professional white and light-gray surfaces.
- Deep blue primary actions.
- Subtle borders, shadows, and rounded cards.
- Clear typography and accessible color contrast.
- Left navigation sidebar.
- Top header with global search, notifications, user profile, and a simulation-mode indicator.
- Responsive layouts for desktop, tablet, and mobile.
- Status badges for New, Working, Escalated, Waiting for Customer, Resolved, and Closed.
- Loading states, success messages, confirmation dialogs, and useful error messages.
- Empty states for pages with no records.
- Consistent spacing and reusable components.

Do not copy Salesforce branding or imply that this standalone simulator is an official Salesforce product.

# 3. SIMULATION MODE — MANDATORY

The application must have a persistent and clearly visible badge:

SIMULATION MODE — NO LIVE SALESFORCE CONNECTION

All core functionality must work locally.

Implement a Simulation Service Layer that emulates:

- Salesforce object records.
- Record creation, editing, viewing, and deletion.
- Record-triggered flows.
- Scheduled reminders.
- Case assignment and queue routing.
- Approval processes.
- Prompt Builder and Agentforce responses.
- Reports and dashboard calculations.
- Permission-based interface behavior.
- Activity logs and automation execution history.

All simulated operations must return meaningful success or failure results and update application state.

Never display simulated AI responses, email delivery, or Salesforce API calls as real external operations.

Provide a Settings page with:

1. Simulation mode status.
2. Seed demo data.
3. Reset demo environment.
4. Export all application data as JSON.
5. Import valid JSON data.
6. Clear demo records with confirmation.
7. Show the latest automation execution logs.

Persist changes in localStorage so data survives browser refreshes.

Use versioned storage and safe initialization. Handle invalid or corrupted stored data gracefully.

Add a Reset Demo button that restores the original demo scenario after explicit confirmation.

# 4. APPLICATION NAVIGATION

Create these functional pages:

1. Overview Dashboard.
2. Cases.
3. Customers.
4. Products.
5. Orders.
6. Warranty Claims.
7. Knowledge Base.
8. AI Assistant / Agentforce Simulator.
9. Automation Center.
10. Approval Requests.
11. Queues & Assignment.
12. Reports & Analytics.
13. User Management & Security.
14. Activity & Audit Logs.
15. Settings.

Use a consistent layout and working sidebar navigation. Every page must have meaningful content and functioning interactions.

# 5. DASHBOARD

Create an executive dashboard containing live calculations from the application's stored records.

Display KPI cards for:

- Total Cases.
- Open Cases.
- Resolved Cases.
- Escalated Cases.
- Cases Created Today.
- Average Resolution Time.
- SLA Breaches.
- Customer Satisfaction Score.

Add charts:

- Cases by Status.
- Cases by Priority.
- Cases by Category.
- Cases Created vs. Resolved Over Time.
- Cases by Support Agent.
- Customer Satisfaction Trends.

Add:

- Recent Cases table.
- Urgent Cases panel.
- Upcoming SLA deadlines.
- Recent Automation Executions.
- AI Activity Summary.
- Quick Actions: Create Case, Add Customer, Generate AI Response, and Run Automations.

All dashboard values and charts must derive from application state. Updating a case must immediately update the relevant dashboard values.

Use a clearly defined calculation for average resolution time and customer satisfaction. Display an appropriate empty state when there is insufficient data.

# 6. DATA MODEL

Create typed models and a centralized data service for the following entities.

## A. Customer

Fields:

- Customer ID.
- Full Name.
- Email.
- Phone.
- Country.
- Customer Type.
- Customer Since.
- Customer Status.
- Created At.

## B. Product

Fields:

- Product ID.
- Product Name.
- SKU.
- Category.
- Brand.
- Price.
- Warranty Duration in Months.
- Stock Quantity.
- Product Status.

## C. Order

Fields:

- Order ID.
- Customer ID.
- Order Number.
- Order Date.
- Product IDs and quantities.
- Order Total.
- Payment Status.
- Shipping Status.
- Tracking Number.
- Estimated Delivery Date.

## D. Support Case

Fields:

- Case ID.
- Case Number.
- Subject.
- Description.
- Customer ID.
- Related Order ID, if applicable.
- Product ID, if applicable.
- Case Origin.
- Case Category.
- Priority.
- Status.
- Assigned Queue.
- Assigned Agent.
- Created At.
- Last Modified At.
- First Response At.
- Resolved At.
- SLA Deadline.
- Escalation Flag.
- AI Summary.
- AI Suggested Response.
- Resolution Notes.
- Customer Satisfaction Rating.

## E. Warranty Claim

Fields:

- Claim ID.
- Claim Number.
- Customer ID.
- Product ID.
- Order ID.
- Purchase Date.
- Claim Date.
- Claim Reason.
- Warranty Status.
- Approval Status.
- Decision Notes.

## F. Knowledge Article

Fields:

- Article ID.
- Title.
- Category.
- Keywords.
- Content.
- Publication Status.
- Last Updated.

## G. Approval Request

Fields:

- Approval ID.
- Related Case ID.
- Request Type.
- Request Reason.
- Requested By.
- Assigned Approver.
- Status.
- Decision Comments.
- Created At.
- Decision Date.

## H. Automation Log

Fields:

- Log ID.
- Automation Name.
- Related Record ID.
- Trigger Event.
- Execution Status.
- Execution Time.
- Execution Details.
- Error Details, if any.

## I. Users and Queues

Create demo users with support roles and queues with names, descriptions, members, and assignment rules.

Implement relationships between customers, orders, products, cases, warranty claims, approvals, and activity logs.

Use stable IDs and enforce referential integrity. Prevent invalid relationships and avoid orphaned records.

# 7. SEED DATA

On first launch, initialize a realistic demo dataset.

Create at least:

- 12 customers.
- 10 products.
- 15 orders.
- 15 support cases with different statuses and priorities.
- 6 warranty claims.
- 10 knowledge articles.
- 4 support agents.
- 4 support queues.
- 4 approval requests.
- Sample automation logs.

Use fictional customer names, fictional contact information, and fictional order data.

Include realistic scenarios:

1. A customer reports a defective wireless headphone.
2. A customer requests an order tracking update.
3. A laptop warranty claim needs review.
4. A delayed shipment requires escalation.
5. A customer requests a refund.
6. A customer reports a faulty Bluetooth speaker.
7. A case is approaching its SLA deadline.
8. An AI-generated response requires agent review.
9. A resolved customer case has a satisfaction rating.
10. A cancellation or refund request awaits approval.

Provide a visible option to restore all seeded records.

# 8. CASE MANAGEMENT — FULL CRUD

Build a complete Cases page.

Features:

- List view with searchable and sortable columns.
- Filters by status, priority, category, queue, agent, and date.
- Pagination or efficient client-side list rendering.
- Create Case form with validation.
- View Case detail page.
- Edit Case.
- Change case status.
- Assign case to an agent or queue.
- Add internal notes.
- Add resolution notes.
- Generate AI summary.
- Generate AI response.
- Escalate case.
- Resolve case.
- Close case.
- Reopen eligible cases.
- View case history and automation logs.
- Link customer, order, and product records.

Validate required fields and foreign-key relationships.

Generate unique case numbers automatically, such as CS-1001, CS-1002, and so on.

Changing a case status must update the stored record and the relevant dashboard values.

When a case is resolved, record the resolution timestamp and calculate its resolution duration.

Require resolution notes when resolving a case.

Show clear confirmation dialogs for destructive or significant actions.

# 9. CUSTOMER MANAGEMENT

Create a complete Customers page.

Features:

- Customer directory.
- Search by name, email, or phone.
- Create, view, edit, and delete customer records when permitted.
- Customer detail page.
- Related cases.
- Related orders.
- Related warranty claims.
- Customer support history.
- Customer satisfaction history.
- Customer profile summary.

Warn the user before deleting a customer with related records. Do not silently delete or corrupt related case and order data.

# 10. PRODUCT, ORDER, AND WARRANTY MANAGEMENT

Products:

- Product listing.
- Product details.
- SKU search.
- Stock information.
- Warranty duration.
- Product status.

Orders:

- Order listing and filtering.
- Order detail page.
- Customer and product associations.
- Order tracking timeline.
- Payment and shipping status.
- Simulated tracking updates.

Warranty claims:

- Create claim.
- Associate customer, product, and order.
- Check the purchase date and warranty duration.
- Determine whether a claim is within the configured warranty period.
- Display eligibility as eligible, ineligible, or requires review.
- Submit eligible claims for approval.
- Approve or reject claims.
- Record the decision and decision notes.

Do not approve an ineligible claim automatically. Make warranty rules configurable and explain the reason for each eligibility result.

# 11. AI ASSISTANT / AGENTFORCE SIMULATOR

Build an interactive AI support workspace that demonstrates the intended behavior of Salesforce Prompt Builder and Agentforce.

Important: This is a simulated implementation, not an actual Salesforce Agentforce connection.

Provide an AI Assistant page with:

- Chat-style interface.
- Case selector.
- Customer context panel.
- Related order and product details.
- Conversation history.
- Suggested questions.
- Generate Summary.
- Generate Response.
- Recommend Next Action.
- Search Knowledge Base.
- Draft Case Update.
- Copy response.
- Apply approved AI output to the selected case.

Create deterministic, context-aware AI simulation functions.

The generated outputs must use the selected case's actual local data.

## AI capability 1: Case Summary

Generate a concise summary containing:

- Customer issue.
- Product and order context.
- Current case status.
- Priority.
- Relevant observations.
- Recommended next action.

## AI capability 2: Suggested Customer Response

Generate a professional, empathetic response that references the actual case details.

Examples:

- Order tracking: provide the simulated tracking number and shipping status.
- Warranty: explain the current claim status and next steps.
- Product defect: acknowledge the issue and explain the return or troubleshooting process.
- Refund request: explain the current approval status without promising an unapproved refund.

Never fabricate delivery confirmations, refund approvals, warranty decisions, or real external actions.

## AI capability 3: Recommended Next Action

Return a structured recommendation such as:

- Request additional information.
- Check order tracking.
- Review warranty eligibility.
- Route to a specialist.
- Submit for approval.
- Escalate due to urgency.
- Resolve after confirmation.

## AI capability 4: Knowledge Assistance

Search local knowledge articles using relevant keywords and case context. Display matching article titles and excerpts.

## AI capability 5: Prompt Builder Simulation

Create a Prompt Templates page or section where the user can:

- View predefined templates.
- Create a template.
- Edit a template.
- Activate or deactivate a template.
- Select an associated record type.
- Preview the prompt using case data.
- Generate a simulated output.

Include these predefined templates:

1. Case Summary Generator.
2. Customer Response Generator.
3. Warranty Eligibility Explanation.
4. Escalation Recommendation.

Use a clearly documented mock AI provider. Keep all prompts and outputs within the local application unless a real integration is explicitly configured.

Do not display fabricated API calls or pretend that a real language model has executed the prompt.

# 12. AUTOMATION CENTER — FUNCTIONAL FLOW SIMULATION

Build an Automation Center with a list of available automations, their status, execution history, and Run Now buttons.

Each automation must have actual application logic and update records or logs.

## Automation A: Case Assignment Flow

Trigger: A case is created or reassignment is requested.

Logic:

1. Inspect the case category.
2. Route order-related cases to Order Support.
3. Route warranty-related cases to Warranty Support.
4. Route technical product issues to Technical Support.
5. Route general inquiries to General Support.
6. Assign an eligible demo agent from the queue when available.
7. Record the assignment in the activity log.

If no suitable agent is available, assign the case to the appropriate queue and display the reason.

## Automation B: Priority and Escalation Flow

Trigger: A high-priority case is created or its priority changes.

Logic:

1. Check priority and current status.
2. Flag urgent cases.
3. Recommend escalation when applicable.
4. Record the automation result.
5. Notify the in-app notification center.

Do not automatically claim that an external email was sent.

## Automation C: SLA Monitoring Flow

Create configurable SLA targets for priority levels.

Suggested defaults:

- Critical: first response within 15 minutes.
- High: first response within 1 hour.
- Medium: first response within 4 hours.
- Low: first response within 8 hours.

These are demo configuration values, not actual contractual service commitments.

Use a configurable clock simulation so overdue and upcoming cases can be demonstrated without waiting for real time to pass.

Display remaining time, overdue duration, and SLA status.

## Automation D: Three-Day Reminder Flow

Simulate reminders for confirmed orders or scheduled follow-up cases when the configured reminder date is reached.

Include:

- Reminder eligibility.
- Simulated execution.
- In-app notification.
- Execution log.
- Duplicate-reminder prevention.

Provide a Demo Clock control or Advance Demo Time button to test this flow.

Do not claim a real email or SMS was delivered.

## Automation E: Case Resolution Flow

Trigger: A case is marked Resolved.

Logic:

1. Validate resolution notes.
2. Record the resolution timestamp.
3. Update resolution metrics.
4. Add a resolution activity entry.
5. Schedule a simulated satisfaction follow-up.
6. Display the case in the resolved-case list.

## Automation F: Refund Approval Flow

Trigger: A refund or cancellation request is submitted.

Logic:

1. Create an approval request.
2. Associate it with the related case.
3. Set status to Pending.
4. Display the request in Approval Requests.
5. Permit an authorized demo approver to approve or reject.
6. Update the request and related case consistently.
7. Record decision comments and audit history.

An AI recommendation must never automatically bypass this approval process.

## Automation G: Warranty Claim Flow

Trigger: A warranty claim is created or updated.

Logic:

1. Validate the purchase date.
2. Check the product's configured warranty period.
3. Determine eligibility.
4. Route eligible claims to Warranty Support.
5. Route ambiguous claims for manual review.
6. Log the result.

## Automation execution requirements

- Every Run Now button must execute the associated logic.
- Display success, skipped, and failed execution states.
- Write an AutomationLog for every execution.
- Avoid duplicate actions when an automation is run repeatedly.
- Handle invalid records gracefully.
- Provide a Run All Eligible Automations action.
- Clearly distinguish simulated scheduling from a real background scheduler.

# 13. APPROVAL WORKFLOW

Create a fully functional Approval Requests page.

Features:

- Pending, Approved, and Rejected tabs.
- Approval request detail view.
- Related case and customer information.
- Approver identity.
- Request reason.
- Decision comments.
- Approve and Reject buttons.
- Decision timestamps.
- Approval history.

Implement role-based authorization within the simulation.

Only the designated approver or a demo administrator may approve or reject a request.

Require decision comments when rejecting a request.

Prevent repeated approval or rejection of a request that has already been decided.

Update associated records and activity logs consistently.

# 14. QUEUES AND CASE ROUTING

Create the following demo queues:

- General Support.
- Order Support.
- Technical Support.
- Warranty Support.

Features:

- Queue directory.
- Queue details.
- Queue members.
- Unassigned case counts.
- Assigned case counts.
- Priority distribution.
- Manual reassignment.
- Auto-assignment.
- Agent workload view.

Implement deterministic routing rules and ensure that queue and agent assignments remain consistent when cases are updated.

# 15. SECURITY AND USER MANAGEMENT

Create simulated user roles:

- Administrator.
- Support Manager.
- Support Agent.
- Warranty Specialist.
- Approver.

Build a demo role switcher so the evaluator can explore the application as different roles.

Define permissions for:

- Viewing records.
- Creating cases.
- Editing cases.
- Assigning cases.
- Viewing customer information.
- Managing warranty claims.
- Approving requests.
- Running automations.
- Managing users and settings.

Use centralized authorization checks for protected actions, not merely hidden buttons.

Display access-denied messages when a role attempts a restricted action.

Clearly explain that client-side role simulation is for demonstration only and is not production-grade security. Real deployments require server-side authentication and authorization.

# 16. KNOWLEDGE BASE

Create a searchable knowledge base with fictional support articles covering:

- Tracking an order.
- Returning a defective product.
- Checking warranty eligibility.
- Troubleshooting Bluetooth connectivity.
- Resolving headphone pairing issues.
- Handling delayed shipments.
- Requesting a refund.
- Updating customer contact information.
- Understanding case statuses.
- Escalating unresolved issues.

Features:

- Search by title, category, and keywords.
- View article details.
- Show relevant articles in the AI Assistant.
- Add and edit articles when authorized.
- Publish or unpublish articles.
- Display related cases when applicable.

# 17. REPORTS AND ANALYTICS

Create working reports with filters and charts.

Required reports:

1. Cases by Status.
2. Cases by Priority.
3. Cases by Category.
4. Cases by Support Agent.
5. Average Resolution Time.
6. SLA Breach Report.
7. Warranty Claims by Status.
8. Refund Approval Outcomes.
9. Customer Satisfaction.
10. Automation Execution Results.

Every report must be calculated from stored application data.

Support date filters, relevant grouping, and CSV export.

Ensure reports update when records change. Handle empty datasets and missing values correctly.

# 18. ACTIVITY AND AUDIT LOGS

Maintain a chronological activity history for important operations:

- Case created.
- Case updated.
- Status changed.
- Case assigned.
- AI summary generated.
- AI response generated.
- Automation executed.
- Approval submitted.
- Approval decided.
- Warranty claim reviewed.
- Case resolved.
- User permission denied.

Each entry should include:

- Timestamp.
- Action.
- Record type.
- Record ID.
- Acting demo user.
- Outcome.
- Details.

Make the audit history searchable and filterable.

# 19. END-TO-END CUSTOMER SUPPORT WORKFLOW

The application must support the following complete journey:

1. Create or select a customer.
2. Create a customer support case.
3. Associate the case with a product or order.
4. Validate required case information.
5. Automatically categorize or route the case.
6. Assign a queue and eligible agent.
7. Generate an AI case summary.
8. Generate a suggested customer response.
9. Retrieve relevant knowledge articles.
10. Review the recommended next action.
11. Escalate the case when required.
12. Submit refund or cancellation requests for approval when applicable.
13. Approve or reject the request using the designated demo role.
14. Record the resolution notes.
15. Resolve the case.
16. Record the simulated satisfaction follow-up.
17. Update dashboards and reports.
18. Display the full case history and automation logs.

The complete workflow must be executable through the user interface without manually editing browser storage or application source code.

# 20. PRECONFIGURED DEMO SCENARIO

Create a scenario named:

"Defective Wireless Headphones — Customer Support Journey"

Seed a fictional customer named Priya Sharma with a fictional order for wireless headphones.

The scenario should begin with a New support case describing a headphone that will not connect over Bluetooth.

Provide a button called "Load Demo Scenario" that loads or selects the relevant customer, order, product, and case without creating duplicate records each time.

The evaluator must be able to:

1. Open the case.
2. View customer and order details.
3. Run case assignment.
4. Generate an AI summary.
5. Generate a professional response.
6. Open a relevant knowledge article.
7. Change the case status.
8. Add resolution notes.
9. Resolve the case.
10. View the updated dashboard and activity log.

Provide a second optional scenario for a delayed order requiring escalation and a pending refund approval.

Every scenario must be deterministic and repeatable after a reset.

# 21. TESTING AND QUALITY ASSURANCE

Build the project with testable business logic and verify the following behaviors:

- Create, edit, view, and delete eligible records.
- Required-field validation.
- Correct customer and order relationships.
- Unique case number generation.
- Correct category-based routing.
- Priority-based escalation.
- AI summaries based on the selected record.
- AI responses using real simulated order and warranty data.
- Approval authorization.
- Prevention of duplicate approval decisions.
- Warranty eligibility calculation.
- SLA status calculations.
- Resolution timestamps.
- Dashboard metric updates.
- Automation execution logs.
- Persistence after page refresh.
- Reset and restore behavior.
- JSON export and import validation.
- CSV report export.
- Role-based access restrictions.
- Responsive navigation.
- Empty states and error handling.

Add unit tests for important business rules and integration-style tests for the main workflow where practical.

Fix runtime errors, TypeScript errors, broken routes, and failing tests before considering the project complete.

Do not fabricate test results. Only report tests as passed when they have actually been executed successfully.

# 22. TWO-MINUTE PROJECT DEMO MODE

Add a dedicated "Demo Mode" feature with a guided presentation flow.

The demo should have these stages:

1. Dashboard Overview.
2. Customer and Case Details.
3. Automated Case Assignment.
4. AI Summary and Suggested Response.
5. Knowledge Base Recommendation.
6. Approval or Escalation Workflow.
7. Case Resolution.
8. Updated Reports and Audit History.

Add a Next Demo Step button and a Reset Demo button.

Provide contextual guidance on each step, but do not force the evaluator through a locked sequence.

Preload the demo scenario so it can be presented immediately.

Create a clean, professional demo layout suitable for screen recording. Avoid pop-ups or animations that distract from the presentation.

Do not create a fake video recording or pretend the application can record the screen automatically.

# 23. FINAL ACCEPTANCE CRITERIA

The application is complete only when:

- All listed pages are implemented.
- All navigation works.
- Core CRUD operations work.
- Data persists across refreshes.
- All main automations execute their business logic.
- AI simulation produces context-aware output.
- Approval workflows enforce the configured demo permissions.
- Dashboards and reports use actual application state.
- The main end-to-end case workflow succeeds.
- Demo scenarios can be loaded repeatedly without duplicate data.
- The app clearly identifies its simulation-only capabilities.
- No major controls are decorative or nonfunctional.
- The application is responsive and suitable for a professional evaluation.
- A user can complete the entire demo without configuring a real Salesforce account.

# 24. IMPLEMENTATION INSTRUCTIONS

Work in phases rather than generating a large collection of disconnected screens.

Phase 1: Establish the architecture, design system, routing, data models, persistence, and seed data.

Phase 2: Implement customer, product, order, case, and warranty management.

Phase 3: Implement queues, routing, approval workflows, and automation services.

Phase 4: Implement the AI Assistant, Prompt Builder simulator, and Knowledge Base.

Phase 5: Implement dashboards, reports, security simulation, and audit history.

Phase 6: Implement Demo Mode, the guided demo scenario, and reset functionality.

Phase 7: Execute tests, fix issues, and verify the complete customer support workflow.

Begin by creating the working application structure and implementing Phase 1. Then continue through the remaining phases, preserving existing working functionality.

Do not stop after creating the dashboard or initial UI. Continue until the application meets the acceptance criteria.

If an external integration is unavailable, implement and clearly label a working local simulation instead of leaving the feature broken.

At the end, provide a concise implementation summary, identify any remaining limitations honestly, and explain how to launch the app and run the two-minute demonstration.

**Build the complete, working AI-Powered Customer Support & Service Automation application now.**

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://service-sim-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/28983181-84e9-4c44-a81a-aedc24df6042).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
