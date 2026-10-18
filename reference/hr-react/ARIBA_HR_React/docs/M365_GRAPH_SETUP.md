# Microsoft 365 / Outlook sender for ARIBA HR

The `ariba-send-email` Edge Function supports Microsoft Graph OAuth2 for company Microsoft 365 mailboxes. It does **not** use the Microsoft account password or SMTP AUTH.

## 1. Microsoft Entra app

1. In Microsoft Entra admin center, create an App Registration for ARIBA HR.
2. Record the **Directory (tenant) ID** and **Application (client) ID**.
3. Create a client secret and copy its **value** immediately. Do not place it in React/HTML or send it in chat.
4. Under API permissions, add **Microsoft Graph → Application permissions → Mail.Send**.
5. Grant admin consent.
6. Restrict the application to the designated company mailbox using Exchange Online Application RBAC / your tenant's approved mailbox-scoping policy. Do not leave app-only mail access broader than necessary.

## 2. Supabase Edge Function secrets

In Supabase Dashboard → Project Settings → Edge Functions → Secrets, add:

- `M365_TENANT_ID` = Entra Directory (tenant) ID
- `M365_CLIENT_ID` = Entra Application (client) ID
- `M365_CLIENT_SECRET` = the client-secret **value**

These values must remain server-side. Never put them in React or standalone HTML.

## 3. ARIBA HR mail settings

In HR ARIBA → Settings → Email and notifications → Company email:

- Provider: Microsoft 365 / Outlook
- SMTP host: `smtp.office365.com` (kept for provider identification)
- Username: full company mailbox address
- Sender address: the same company mailbox address
- Sender display name: e.g. `شركة حلول أريبا لخدمات الأعمال`
- Save, then use **Send test email**.

The password field is not used by Graph. The UI may store the non-secret marker `GRAPH_OAUTH` to satisfy the existing settings schema; the Graph client secret stays in Supabase Secrets only.

## 4. Verification

The function returns success only after Microsoft Graph accepts the `sendMail` request (HTTP 202). Check the test message in the company mailbox Sent Items and recipient Inbox/Junk. If Graph rejects it, the function returns an explicit setup/permission error.

Simple Graph file attachments are limited to 3 MB. Large PDF files need a Graph upload-session implementation; the current sender returns an explicit error rather than silently sending HTML or a broken attachment.
