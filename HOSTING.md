# Hosting behind a login (Cloudflare Pages + Access)

GitHub Pages cannot restrict access: the site is static and public, so any
passcode or OTP typed into the page sits in the source for anyone to read. If
only certain people should be able to open the engine, the gate has to live in
front of the site, not inside it. Cloudflare Access does that on the free plan —
a visitor gets a one-time PIN by email, and only allow-listed addresses get in.

Nothing about the engine changes; it stays a static site.

## 1. Deploy to Cloudflare Pages

You need a Cloudflare account (free). Sign in yourself — these commands open a
browser for you to approve.

```bash
cd ~/Documents/Cityflo/captain-certificate-engine
npx wrangler login
```

```bash
npx wrangler pages project create captain-certificate-engine --production-branch main
```

```bash
npx wrangler pages deploy . --project-name captain-certificate-engine --commit-dirty=true
```

The last command prints the URL, something like
`https://captain-certificate-engine.pages.dev`. Re-run just that command to ship
future changes.

## 2. Put Access in front of it

In the Cloudflare dashboard:

1. **Zero Trust** (left sidebar) → follow the one-time setup if prompted, choosing
   the **Free** plan.
2. **Access → Applications → Add an application → Self-hosted**.
3. Application name: `Captain Certificate Engine`.
   Public hostname: the `*.pages.dev` hostname from step 1.
4. **Add policy**: name it `Cityflo Ops`, action **Allow**, and under *Include*
   pick **Emails** (or **Emails ending in** → `@cityflo.com` for the whole team)
   and list the addresses that should have access.
5. Leave the identity provider as **One-time PIN** unless the org has SSO. Save.

Now every visitor is asked for their email, gets a 6-digit code, and only
allow-listed addresses reach the page. Sessions last as long as you configure
(24h by default).

## 3. Turn off the public GitHub Pages copy

While the GitHub Pages URL is live, the Access gate is pointless — anyone with
that link bypasses it. Once Cloudflare is working:

```bash
gh api -X DELETE repos/pranavtaware21/captain-certificate-engine/pages
```

The repo itself stays public (it holds no captain data — only the template and
the fonts). Make it private too if you would rather the code not be readable:

```bash
gh repo edit pranavtaware21/captain-certificate-engine --visibility private
```

## The passcode gate that is on the page now

`js/gate.js` asks for a mobile number and a 4-digit code before the tool
appears, and remembers the unlock in `localStorage` (add `?lock` to the URL to
sign out). Only a PBKDF2-SHA256 hash of the pair is in the source — 210,000
iterations, random salt — so the number itself is not published, and the code
slows down after three wrong tries.

Be clear about what it is: **a speed bump, not access control.** The check runs
in the visitor's own browser, so anyone who opens DevTools can skip it, and a
4-digit code is only 10,000 guesses. It stops a stranger who lands on the URL
from using the tool; it does not keep out anyone who is trying. The page holds
no captain data either way — the CSV never leaves the browser — so what is
behind the gate is the tool, not the records.

Use Cloudflare Access above when the requirement is real access control.

## Why a passcode alone is not enough

Worth being explicit, since it is the obvious first instinct: a phone number and
OTP hardcoded in the page would be visible to anyone who opens View Source, is
bypassable by turning off JavaScript, and would publish a personal number in a
public repo. It looks like a login without being one.
