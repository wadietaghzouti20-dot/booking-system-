# Clinic Booking System 1

A lightweight, mobile-first appointment request frontend and Google Apps Script backend. The first version intentionally sends requests as **pending clinic approval**. Do not use this with real patient data until the clinic owner has configured, deployed, and tested the backend and reviewed applicable privacy requirements.

## Files

- `index.html`, `styles.css`, `app.js`: patient booking experience with one question per screen.
- `config.js`: public settings; endpoint is blank until you deploy Apps Script.
- `apps-script/Code.gs`: spreadsheet initialization, server-side validation, locked request creation, and notifications.

## GitHub Pages

1. Open repository **Settings → Pages**.
2. Under build and deployment, select **Deploy from a branch**, branch `main`, folder `/ (root)`, then Save.
3. Wait for GitHub Pages to publish the site. Use the HTTPS URL shown in Settings → Pages.
4. Pages can host the public frontend; it does not host the Apps Script backend.

## Google Sheets and Apps Script setup

1. Sign in to the Google account that should own the clinic spreadsheet.
2. Create a new Google Sheet. Open **Extensions → Apps Script**.
3. Replace the starter editor content with the contents of `apps-script/Code.gs`.
4. In Apps Script project settings, set the project timezone to `Africa/Algiers`. In the code, configure the clinic name and administrator email; set the spreadsheet ID in Script Properties as `SPREADSHEET_ID` (the ID is the part between `/d/` and `/edit` in the spreadsheet URL). Do not place that ID in this public repository.
5. Run `setup` from the editor once and approve the requested Google permissions. This initializes missing headers/tabs and settings; it does not intentionally clear existing rows.
6. **Deploy → New deployment → Web app**. Execute as **Me**. Choose access appropriate to the clinic's intended audience and Google Workspace/account policy. A public patient booking page generally needs access for anyone, which means the endpoint is internet-accessible; do not deploy until the owner accepts this risk and tests it.
7. Copy the deployed web app URL ending in `/exec`. Paste it into `endpoint` in `config.js`, commit the change, and wait for Pages to update.
8. Test with a non-real test request. Confirm exactly one row appears in the Appointments sheet and that the returned reference is shown. Verify email delivery from the authorized account before inviting patients.

## Current backend behavior and limitations

- Requests are stored as `PENDING`; no slot is automatically confirmed or advertised as available.
- Spreadsheet writes are protected by a script lock; duplicate submissions with the same client request ID are rejected. The backend does not currently expose an availability feed or an admin approval dashboard.
- Cancellation/rescheduling token columns and audit log are reserved in the schema, but patient self-service token flows are not enabled in this initial implementation. Do not claim those features are available.
- Apps Script and Gmail have quotas and account-specific limits; free service is not unlimited. Check current Google quotas before production use.
- A public GitHub Pages site plus public Apps Script endpoint is not a complete medical-data compliance solution. Limit data collected, restrict spreadsheet access, define retention/deletion procedures, and have the clinic owner review applicable Algerian privacy requirements before handling real patient information.
- GitHub Pages deployment, Google authorization, real spreadsheet writes, and actual email delivery must be verified in the respective accounts; repository files alone cannot prove those integrations work.

## Frontend checks

The form is plain HTML/CSS/JavaScript with no build step or third-party frontend library. The endpoint is intentionally blank by default; the interface will not claim a request was saved until it receives a valid JSON response from the backend.
