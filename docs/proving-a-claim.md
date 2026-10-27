# Proving a claim

How to prove that a new account can still claim a name, end to end, on a real browser.
Read this before claiming that a change to sign-in or to the claim path is safe.

Four separate outages have hidden in this flow, and **every check in `npm run verify`
stayed green through all of them**, because they are all source-level: they read files, and
the failure only exists in a running browser talking to Privy.

- The claim was refused with a sentence about a name, when the wallet had never been asked
  to sign.
- The claim signed through a provider that could not sign typed data.
- Two Privy providers meant the session was revoked on navigation to the app.
- Privy's terms requirement went unrecorded, so every page load revoked the session.

Nothing below is automated on purpose. A script for this rots quietly, and `mail.tm` and
Privy's flow both change; a person following steps notices when the form has moved.

---

## 1. A disposable mailbox, over HTTP

Never use a real inbox, and never type a verification code into a chat, a document or a
commit. The code stays between the mailbox API and the browser field.

```sh
ADDR="probe$(openssl rand -hex 4)@maxxspace.com"   # domain from GET /domains
PW="Probe-$(openssl rand -hex 6)"

curl -s https://api.mail.tm/domains                     # pick the domain it offers
curl -s https://api.mail.tm/accounts \
  -H 'content-type: application/json' \
  -d "{\"address\":\"$ADDR\",\"password\":\"$PW\"}"
curl -s https://api.mail.tm/token \
  -H 'content-type: application/json' \
  -d "{\"address\":\"$ADDR\",\"password\":\"$PW\"}"      # -> token
```

Keep the token in your shell, not in a file you will commit.

## 2. Which origin you are proving

The script takes the origin, and it matters:

| What you are proving | Origin |
| --- | --- |
| a local dev server | `http://localhost:3123` |
| a production build served locally | the same port you served it on |
| the live app | `https://seti.live` |

**A local origin has to be allowed for the app id first**, in the Privy dashboard under
Settings → allowed origins. Without it the sign-in fails with
`this site's origin is not on the app id's allowed origins` and nothing else will tell you
why. The app id itself lives in `web/.env.local`; do not copy it into this document or into
a ticket.

A local dev server also needs a local API (`NEXT_PUBLIC_API_URL`), because the production
API only allows `https://seti.live` and will block the browser with a CORS failure that
looks like "We could not reach Seti".

## 3. The run

1. Open `<origin>/signin`.
2. Tick the terms box. It gates Continue, and it is also the consent Privy records when the
   sign-in succeeds, so skipping it produces a session that dies on the next page load.
3. Enter the disposable address, press **Continue with email**.
4. Read the code out of the mailbox:

   ```sh
   curl -s https://api.mail.tm/messages -H "authorization: Bearer $TOKEN"
   curl -s https://api.mail.tm/messages/<id> -H "authorization: Bearer $TOKEN"
   ```

   Take the six digits from the body of the mail whose subject mentions a login code.
5. Enter it, press **Sign in**. You should land on `/app/onboarding`.
6. **Reload the page three times.** This is the step that catches session bugs; skipping it
   is how a broken session gets shipped.
7. Type a name, press **Continue**, choose **Personal**, press **Sign and continue**.

## 4. What passing looks like

Open DevTools → Network, filter to Fetch/XHR, and confirm these two facts and no others:

```text
POST /handles/claim                          201
POST /api/v1/sessions/logout                 absent
```

On screen, the last step says **Claimed**, with the handle, the address it bound to, and the
link `https://seti.live/u/<name>`.

A claim that fails before signing shows a sentence and **no `POST /handles/claim` at all**.
That combination is the tell for a wallet or session problem, not a name problem.

## 5. Trap: a filtered log lies

Filtering the network log by a word, or reading a truncated list, hides requests and has
already produced one false "verified". Read the **full** request list for the page, or
count the POSTs by hand, before believing a pass.

The other trap: `POST /api/v1/sessions` returning 200 means a refresh succeeded, not that
the session survived. The line that matters is whether a `logout` follows it.

## 6. Clean up what you claimed

A name is permanent and is never reassigned, so anything claimed here stays claimed. Use a
throwaway handle, record it, and take it out with a database action against the environment
you used. There is no release path in the product, by design: see the closed discussion on
issue #258 for why a name must never return to circulation.

---

## When to run this

- Any change to `web/lib/auth/`, the Privy provider tree, or the claim path.
- Any Privy SDK upgrade.
- Before telling anyone that onboarding works.
