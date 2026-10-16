# Reservation System Final 1 — setup

The new website lives in this folder and does not use the old Apps Script endpoint.

## Create a new Google Sheet automatically
1. Open https://script.google.com/home and create a **New project**. Name it **Reservation System Final 1**.
2. Open the default Code.gs, delete its contents, and paste the entire contents of this folder's Code.gs.
3. Save the project.
4. Select the function setup from the function dropdown and press **Run**.
5. Approve the Google permissions. The script creates a new spreadsheet called **Reservation System Final 1 — Booking Records**, with Appointments, Settings, and AuditLog tabs. The spreadsheet stays private in your Google account.
6. Open the new spreadsheet and check the Settings tab. Change the Admin Email value if another inbox should receive booking requests.

## Deploy the script
1. In Apps Script click **Deploy → New deployment**.
2. Select the deployment type **Web app**.
3. Set **Execute as** to **Me**.
4. Set access to **Anyone** (or the equivalent public access choice available in your account), so patients do not need to sign in.
5. Click **Deploy**, authorize if prompted, and copy the URL ending in /exec.
6. Open config.js in this folder on GitHub, click the pencil icon, paste the new /exec URL into the endpoint value, then commit the change.
7. Open the website and test using fictional contact details. Confirm exactly one row appears in Appointments and an email arrives.

## Important
- Do not put a spreadsheet ID, passwords, or patient data in public website files.
- Requests are stored as PENDING, not automatically confirmed. The clinic must contact the patient and confirm availability.
- Email delivery depends on Google permissions and quotas.
- If your Google account does not allow public web-app access, tell me the exact message; we will choose another free route.
- GitHub Pages must be enabled before the site is live. The likely folder URL is https://wadietaghzouti20-dot.github.io/booking-system-/reservation-system-final-1/, but verify the actual URL in GitHub Settings → Pages.
