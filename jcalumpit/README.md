# J. Calumpit Dental Clinic — PHP + MySQL (XAMPP)

## Setup
1. Install **XAMPP** (PHP 7.4 or newer) and start **Apache** and **MySQL**.
2. Copy this `jcalumpit` folder into `C:\xampp\htdocs\`.
3. Open **http://localhost/phpmyadmin** → **Import** tab and import ONE file:
   - **New install →** `database.sql` (creates everything; it DROPS and recreates the tables).
   - **You already imported the first version and want to keep your data →** `migrate_v2.sql` (adds the new columns/tables only).
4. Open **http://localhost/jcalumpit/** — always through `http://localhost/`, never by double-clicking the .html files.
5. Sign in to the admin panel, then change the starter passwords under **Settings → Change password**:

| Role          | Username  | Password     |
|---------------|-----------|--------------|
| Administrator | `admin`   | `Admin@123`  |
| Staff         | `staff`   | `Staff@123`  |
| Dentist       | `dentist` | `Dentist@123`|

If MySQL has a password or another port, edit `api/config.php`.

## What's in the admin panel (`admin.html`)
Dashboard · Appointments · Patients · Records · Treatment · Billing · Reports · Settings · Users (administrators only).
- **Appointments:** approve, reschedule, decline, complete, cancel; staff can also book for a walk-in/phone patient (approved right away).
- **Patients:** add (temporary password is generated), edit, view full profile and balance, reset password.
- **Records:** medical history, prescriptions, X-ray/images, lab results, documents. Files (JPG/PNG/WebP/PDF, max 5 MB) are stored in `storage/records/`, blocked from direct web access, and served only to signed-in staff.
- **Treatment:** treatment plans and ongoing/completed treatments.
- **Billing:** every approved visit is an invoice. Open it to set the fee and record payments (cash, GCash, Maya, card, bank transfer). Due date = invoice date + 7 days (`INVOICE_DUE_DAYS` in `api/config.php`).
- **Reports:** appointments, new patients, revenue (payments received) and top services by period, with CSV export.
- **Users:** add/edit/deactivate staff, dentist and admin accounts, reset passwords.
Only administrators can delete things (patients, appointments, records, treatments, payments).

## What patients see
- Register (now with **Address**) → signed in automatically → landing page shows **Log Out**.
- **My Appointments** (`dashboard.html`): status of each request, clinic messages, cancel upcoming visits, and the **remaining balance** (total billed, total paid, fee/paid/balance per visit, payment history).

## Booking rules (`api/config.php`)
Mon–Fri 9 AM–6 PM, Sat 9 AM–3 PM, closed Sundays, 12 PM lunch, 1-hour slots, bookings from tomorrow up to 90 days ahead, max 3 upcoming requests per patient, one request per time slot.

## Notes
- Needs PHP extensions `pdo_mysql` and `fileinfo` (both on by default in XAMPP).
- "Forgot password" and the landing-page contact form are still not wired up; staff can reset a patient's password from Patients.
- Emails are not sent; patients see status changes and balances on their dashboard.
