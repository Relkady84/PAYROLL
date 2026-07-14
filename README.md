# Payroll System

A multi-tenant payroll and staff-management web app for Lebanese schools. Built with vanilla JavaScript ES modules + Firebase (Auth, Firestore, Hosting). No build step — edit and reload.

## Live URLs

| URL | Purpose |
|---|---|
| `https://payroll-10a48.web.app` | Central signup / super-admin entry point |
| `https://payroll.lycee-montaigne.edu.lb` | Lycée Montaigne admin app (lane-locked) |
| `https://portal.lycee-montaigne.edu.lb` | Lycée Montaigne staff portal (Microsoft sign-in only) |

## Features

### Multi-tenant architecture
- One codebase serves multiple schools; data isolated per company under `/companies/{X}/…`
- Each tenant can bind branded subdomains (`payroll.school.tld` + `portal.school.tld`)
- Auto-redirect: owners/employees land on their company's branded URL after sign-in
- Lane-locked URLs prevent cross-tenant data access even for super admin

### Admin app (owner + Service Financier)
- **Dashboard**: monthly totals, per-role breakdowns, alert badges for pending items
- **Employees**: CRUD, CSV/Excel import (with Role column auto-mapping), sortable table
- **Payroll table**: live per-month view with Type + Role columns, manual day overrides, published-month indicators
- **Reports & exports**: PDF, Excel, CSV for any month
- **Attendance Requests**: two-step approval workflow with per-status pending/approved/rejected tabs, undo for accidental decisions
- **Settings** (tabbed, sticky bar): Company profile & branding, Display colors, Calendar (weekends/holidays), Academic Year & Roles (with drag-to-reorder), Global tax/NFS rates, Backup, Language
- **Announcements**: post company-wide news with audience targeting (Teachers / Admin / Everyone)
- **Publish Pay Slip per month**: gate visibility to employees; delegate to Service Financier via `paySlipPublishers` list

### Employee portal (Microsoft-only sign-in)
- **Home**: greeting, monthly-days stats, Quick Tools (Pronote, Outlook, SharePoint, Padlet, school website — customizable icons), Quick Actions
- **Attendance**: submit absence / permanence requests with routing preview, History tab with rich status pills and Cancel-if-still-pending
- **Pay Slip**: hierarchical month picker (published months only), live calc, styled PDF download
- **My Notes**: private personal notes (Firestore-per-user)
- **Announcements**: audience-filtered feed with read tracking
- **Notification bell (🔔)**: unified counter for unread announcements, new pay-slip months, pending supervisor approvals
- **Team Approvals** (auto-shown if user is a supervisor for any role): approve/reject direct reports' requests
- **Publish Pay Slips** (auto-shown for designated publishers)

### Two-step approval workflow
- Each role has an optional `supervisorEmail` (searchable employee picker)
- Employee submits → status routed based on role:
  - Supervisor configured → `pending_supervisor` → Team Approvals queue
  - No supervisor → `pending_financier` → admin queue
- Supervisor approves → `pending_financier`; Service Financier approves → `approved`
- Real-time notifications at every transition (bell + inline banner)
- Employee can cancel only while awaiting supervisor
- Admin can undo any final decision

### PWA + real-time
- Installable on iOS / Android / desktop with per-mode manifest
- Offline shell + Firestore offline persistence
- Aggressive service-worker update flow with "Update available" toast
- Live sync via Firestore `onSnapshot` for absence requests, announcements, published months
- Cross-device state sync (announcement read state, seen pay-slip months, etc.)

### Dark mode
- Light / Dark / Auto toggle in Settings (admin) and drawer (portal)
- Preference persisted per device in `localStorage`
- CSS variables + `[data-theme="dark"]` overrides throughout
- Meta `color-scheme` set for native form widgets (date picker icon, scrollbars)

### Backup & restore
- Full per-company JSON export (settings, calendar, employees, absence requests, etc.)
- Smart diff-based restore with per-record apply and normalized comparison

## Tech stack

- **Frontend**: Vanilla ES modules, no framework/build step
- **Auth**: Firebase Auth (Google + Microsoft OAuth)
- **Database**: Cloud Firestore with strict per-company + role-based security rules
- **Hosting**: Firebase Hosting with custom domains + auto-provisioned SSL
- **CI/CD**: GitHub Actions auto-deploys `main` branch on push
- **Libraries** (CDN): jsPDF, jspdf-autotable, SheetJS (xlsx), PapaParse

## Local development

```powershell
firebase serve
```

Opens on `http://localhost:5000`. Edit any file → refresh browser. No build step.

To test the portal split locally without DNS setup:
- `http://localhost:5000/?mode=portal` → portal mode (Microsoft only)
- `http://localhost:5000/` → admin mode (default)

## Deployment

Push to `main`:

```powershell
git push origin main
```

GitHub Actions auto-deploys the app to Firebase Hosting.

Firestore rules must be deployed manually after edits to `firestore.rules`:

```powershell
firebase deploy --only firestore:rules
```

Cache version in `service-worker.js` (`CACHE_VERSION`) must be bumped on every deploy so returning users get the new version.

## Project structure

```
├── index.html                    # Login, onboarding, super-admin, portal shells
├── manifest.json                 # PWA manifest
├── service-worker.js             # Offline cache + update flow
├── firestore.rules               # Security rules (per-company + role-scoped)
├── firebase.json                 # Hosting config + rewrites + headers
├── css/
│   ├── variables.css             # Design tokens + dark-theme overrides
│   ├── layout.css                # Sidebar / app-shell layout
│   ├── components.css            # Buttons, forms, tables, modals, badges
│   ├── responsive.css            # Mobile breakpoints
│   └── employeePortal.css        # Portal-only styles
├── js/
│   ├── main.js                   # Auth flow + route registration
│   ├── router.js                 # Hash-based router
│   ├── firebase.js               # Firebase init
│   ├── auth.js                   # Google + Microsoft sign-in
│   ├── i18n.js + i18n/*.js       # EN / FR translations
│   ├── pwa.js                    # SW registration + install prompt + update toast
│   ├── appMode.js                # Portal vs admin detection + hostname → companyId map
│   ├── data/store.js             # Firestore CRUD + in-memory cache + live listeners
│   ├── models/                   # Data-model helpers (employee, role, calendar, academicYear, absenceRequest, settings)
│   ├── services/                 # Business logic (payroll calc, import/export services)
│   └── views/                    # UI modules (dashboard, employees, payroll, settings, reports, portal, etc.)
```

## Onboarding a new school

1. Create the company: new owner visits `payroll-10a48.web.app` → sign in → onboarding form
2. (Optional) Custom domain: add `portal.<school>.tld` + `payroll.<school>.tld` in Firebase Console Hosting → add DNS records
3. Register the mapping in `js/appMode.js`:
   ```js
   HOSTNAME_COMPANY_MAP: { 'portal.<school>.tld': '<companyId>', 'payroll.<school>.tld': '<companyId>' }
   COMPANY_ADMIN_URL:    { '<companyId>': 'https://payroll.<school>.tld' }
   COMPANY_PORTAL_URL:   { '<companyId>': 'https://portal.<school>.tld' }
   ```
4. Add each staff member (Employees → Add) — importing a CSV/Excel with First Name, Last Name, Email, Role, Salary works too
5. In Settings → Academic Year & Roles, define custom roles (Teacher Primaire, Service Financier, etc.) and assign supervisor emails
6. Announce the portal URL to staff

## License

Proprietary — © Raed Elkady / Lycée Montaigne.
