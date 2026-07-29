# docs.keepclub.app handoff

Audience: the agent or operator with Namecheap DNS and GitHub Pages
administration. This repository change does **not** alter DNS, Pages settings,
or production.

## Shipped topology

- One source repository: `0xkkonrad/keepclub`.
- One flattened Pages deployment: `0xkkonrad/keepclub-pages`, `main` / root.
- One Pages custom domain: `keepclub.app`.
- The app stays at `/`; the creator docs are part of the same deployed tree at
  `https://keepclub.app/docs/`.
- The immutable schema is deployed at
  `https://keepclub.app/docs/schema/course-v2.schema.json`.
- Runtime diagnostic links use
  `https://docs.keepclub.app/reference/errors/#…`, and schema v2's historical
  `$id` is `https://docs.keepclub.app/schema/course-v2.schema.json`. The vanity
  host therefore needs a path-preserving HTTPS redirect to the canonical
  `/docs/` tree.

This is deliberately not a second documentation repository or an independent
docs deployment. `scripts/deploy-to-keepclub.sh` copies the whole `web/` tree
once and refuses to proceed if the generated schema/error reference has
drifted from `schema/`.

## Before touching DNS

1. Merge the docs commit into the source deployment branch.
2. Run:

   ```sh
   node scripts/build-docs.mjs --check
   cd tests && node docs-site.mjs
   ```

3. Deploy through the existing source-controlled script only:

   ```sh
   ./scripts/deploy-to-keepclub.sh --commit
   ```

4. Confirm all three canonical resources return `200` before creating the
   vanity hostname:

   ```sh
   curl -fsSIL https://keepclub.app/docs/
   curl -fsSIL https://keepclub.app/docs/reference/errors/
   curl -fsSIL https://keepclub.app/docs/schema/course-v2.schema.json
   ```

## GitHub Pages: leave these settings unchanged

In `0xkkonrad/keepclub-pages` → Settings → Pages:

- Source: deploy from branch `main`, folder `/ (root)`.
- Custom domain: `keepclub.app`.
- Enforce HTTPS: on.
- Repository root `CNAME`: exactly `keepclub.app`.

Do **not** replace the custom domain with `docs.keepclub.app`. A GitHub Pages
site cannot use the apex and an arbitrary custom subdomain together (the
special alternate is `www`). Do **not** add a nested `web/docs/CNAME`; Pages
does not create a second site from a directory.

At the GitHub account level, verify `keepclub.app` and retain GitHub's
`_github-pages-challenge-0xkkonrad` TXT record. Verification also protects its
immediate subdomains from Pages takeover.

Preserve the existing Namecheap records:

| Type | Host | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `0xkkonrad.github.io.` |

Keep all unrelated TXT/MX records as they are.

## The required redirect behavior

The redirector must:

1. terminate TLS with a valid certificate for `docs.keepclub.app`;
2. redirect with permanent status `301` or `308`;
3. preserve every source path and query string;
4. prefix the path with `/docs/` at the canonical origin;
5. never frame or proxy the application as a second copy.

Required mappings:

| Request | Final URL |
| --- | --- |
| `https://docs.keepclub.app/` | `https://keepclub.app/docs/` |
| `https://docs.keepclub.app/reference/errors/#card-front-empty` | `https://keepclub.app/docs/reference/errors/#card-front-empty` |
| `https://docs.keepclub.app/schema/course-v2.schema.json` | `https://keepclub.app/docs/schema/course-v2.schema.json` |

Fragments are retained by the browser and are not sent to the redirect server.

### DNS record

Use the exact target assigned by the selected HTTPS redirect service:

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| CNAME | `docs` | `<redirect service's assigned hostname>` | 5 min / automatic |

Copy the provider target verbatim; do not invent it and do not point
`docs` directly at `0xkkonrad.github.io` or `keepclub.app`. A bare Pages CNAME
would have a Host/custom-domain mismatch and no Pages certificate covering the
`docs` name.

Namecheap BasicDNS offers a `URL Redirect Record`, but Namecheap documents that
an HTTPS source still needs a certificate for that source hostname.
`keepclub.app` is HSTS-preloaded, so browsers will not fall back to an
HTTP-only forwarding endpoint. Use Namecheap forwarding only if the account
can explicitly activate a certificate/HTTPS automation for
`docs.keepclub.app` **and** it passes every verification below. Otherwise use
an HTTPS edge redirect service; that service is redirect infrastructure, not a
second docs site.

If moving the zone to an edge DNS provider is proposed to obtain such a
redirect, pause for owner approval first. Recreate and compare every existing
A, AAAA, CNAME, MX, TXT, and CAA record before changing nameservers. A whole
zone migration is materially broader than adding the docs hostname.

## Verification

Wait for DNS and certificate issuance, then run from a clean network:

```sh
dig +short CNAME docs.keepclub.app
curl -fsSI https://docs.keepclub.app/
curl -fsSIL https://docs.keepclub.app/reference/errors/#card-front-empty
curl -fsSIL https://docs.keepclub.app/schema/course-v2.schema.json
```

Acceptance:

- the first response is `301` or `308`, not `200`, a frame, or a TLS error;
- every `Location` is HTTPS and stays on the expected canonical path;
- the final three responses are `200`;
- the schema response bytes equal the source schema:

  ```sh
  curl -fsSL https://docs.keepclub.app/schema/course-v2.schema.json \
    | sha256sum
  sha256sum schema/course-v2.schema.json
  ```

- the browser shows no certificate warning on a fresh profile;
- `https://keepclub.app/` still opens the app, and `www.keepclub.app`
  still redirects according to the existing Pages configuration.

Also check the GitHub Pages settings page: the certificate for the app remains
healthy and HTTPS remains enforced. The redirect service, not Pages, owns the
certificate for `docs.keepclub.app`.

## Rollback

If TLS, path preservation, or the canonical deployment check fails:

1. Remove only the `docs` redirect/CNAME record and the matching redirect rule.
2. Leave the app's apex, `www`, Pages custom domain, `CNAME`, and certificate
   untouched.
3. Confirm `https://keepclub.app/` and `https://keepclub.app/docs/` still
   return `200`.
4. Let the `docs` hostname remain absent until an HTTPS-capable redirect is
   ready. Do not leave a dangling CNAME: it is both confusing and a potential
   takeover surface.

The canonical `/docs/` site needs no rollback when vanity DNS is removed.

## What cannot be automated from this workspace

- Namecheap login and record mutation.
- Selection or purchase of an HTTPS redirect service.
- Certificate issuance for `docs.keepclub.app`.
- GitHub account domain verification and Pages admin settings.
- DNS propagation from networks outside this workspace.
- Owner approval for a nameserver/zone-provider migration.

Report the chosen redirect provider, exact created record, certificate state,
curl output, and rollback target in the deployment handoff. Do not report the
vanity host live until all acceptance checks pass.

## Provider references

- [GitHub Pages: troubleshooting custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages)
- [GitHub Pages: verifying a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [GitHub Pages: HTTPS and required DNS records](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Namecheap: URL redirects and HTTPS requirements](https://www.namecheap.com/support/knowledgebase/article.aspx/385/2237/how-to-set-up-a-url-redirect-for-a-domain/)
