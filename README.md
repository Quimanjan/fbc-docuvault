# FBC DocuVault

Student papers and graduation requirements tracker for **Fellowship Baptist College, Kabankalan City**.

Students keep their **Form 137, Form 138, NSTP serial number and PSA birth certificate** in one place, see the status of each requirement (not yet submitted, for review, returned, verified), and store any other document they own in **My documents** (private, or shared with the registrar). The Registrar's Office reviews submitted papers and sees who is cleared, waiting for review, or incomplete.

## Stack
- Static site: `index.html`, `app.js`, `mock.js`, `config.js` (deployed on Vercel)
- Supabase: Auth (email + password), Postgres with row-level security, Storage bucket `papers`, Realtime
- `supabase.sql` creates the tables, policies, storage bucket and four sample students

## Registrar access
Add a registrar's email in the Supabase SQL editor:
```sql
insert into public.registrar_emails (email) values ('registrar@example.com');
```
That account then sees the **Registrar clearance** tab.

## Sample data
Sample students and the "Try with a sample record" / "add sample documents" buttons use papers drawn by `mock.js`, watermarked **SAMPLE ONLY**. They are not real records.
