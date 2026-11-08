# Security

## Reporting a vulnerability

Report privately through GitHub Security Advisories ("Report a
vulnerability" on the repository's Security tab). Do not open a public issue.
If that is not possible, email info@afkzonagroup.lt. We acknowledge reports
within 5 working days.

Supported: the latest 0.x release.

## Threat model

### Assets

1. **Integrity of image files** passed to the marker. A bug must never
   corrupt a user's image or drop existing metadata silently.
2. **Integrity of the disclosure log**, which serves as evidence that a
   notice was shown.
3. **Pages that embed the components**: no script injection, no CSP relaxation.
4. **Personal data** of people who see a disclosure (minimised by design).
5. **The HMAC keys** used for keyed logs and session pseudonyms.

### Actors

- A person who uploads a crafted image to a service that runs the marker
  (hostile PNG, JPEG, WebP or XMP).
- A person who controls text placed in component attributes, in JSON-LD or in
  header values (for example a CMS editor or a user-generated title).
- Someone with write access to stored log files who wants to hide, change or
  forge entries.
- A hostile contributor or a compromised dependency.

### Trust boundaries

- Bytes of an image file, and the XMP packet inside it: untrusted.
- Options passed by the calling application: validated at the boundary.
- Attribute values on `<ai-disclosure>` / `<ai-label>`: untrusted text.
- Log file content when it is read back: untrusted until verified.
- CLI arguments and file system paths: validated; file names in messages are
  JSON-quoted.

### Mitigations

**Image parsing (PNG, JPEG, WebP, XMP)**

- Input size limit (default 64 MiB, hard cap 1 GiB) checked before parsing.
- Every length field is checked against the remaining bytes; every loop
  advances by at least one header and has a count cap (PNG and WebP 100,000
  chunks, JPEG 65,536 segments). XMP packets over 12 MiB are not decoded. Searches are bounded to the current chunk.
- All PNG chunk CRCs are verified; data after IEND or after the RIFF chunk is
  rejected; JPEG is parsed only up to Start of Scan and the rest is copied as is.
- The XMP scanner is linear-time, rejects DOCTYPE and unknown entities (no
  entity expansion, no external entities), caps nesting depth (128),
  namespaces in scope (256) and packet size (4 Mi code units).
- Output is built from slices of the input plus one new segment. Tests prove
  that removing the new segment gives back the exact input, and fuzzing
  (TypeScript and Python, plus 400 shared parity cases) checks that only
  `TelltaleError` is thrown and every output re-parses.
- Files with a C2PA manifest are refused unless the caller opts in, because
  any change breaks the manifest. JPEG layouts where a change would shift
  Multi-Picture Format offsets are refused.
- Merging into an existing packet keeps it; conflicting values are refused,
  never overwritten silently.

**Web components**

- No `innerHTML`, `outerHTML` or `insertAdjacentHTML` anywhere (enforced by
  ESLint). All text goes through `textContent`; attributes through `setAttribute`.
- Styles use constructable stylesheets: no `<style>` elements, no `style`
  attributes. Works under `script-src 'self'; style-src 'self'`. Verified in
  Chromium with a strict CSP (`scripts/browser-check.mjs`).
- Override texts are length-capped (1,000 characters).
- Tests feed XSS payloads into every attribute and assert that no element,
  event-handler attribute or style attribute appears.

**Text marking helpers**

- JSON-LD output escapes `<`, `>`, `&`, U+2028 and U+2029, so it cannot close
  a script element.
- Header values accept printable ASCII only, so CR/LF header injection is
  impossible.

**Disclosure log**

- Each entry hashes its canonical JSON and the previous hash. Changing,
  deleting, inserting or reordering entries is detected.
- Cutting entries off the end is detectable only against a head stored
  elsewhere (`expectedHead`). An HMAC key does not detect it, because the
  remaining entries are still correctly keyed. A full rewrite is detectable
  against the head, or with an HMAC key the attacker does not have. Store the
  head outside the log, and keep the key out of the log directory.
- Strict schema with an allow-list of fields; unknown fields (for example an
  email address) are rejected on write and on verify.
- The Node writer refuses unsafe file names and symlinks, opens with
  `O_NOFOLLOW` and `O_APPEND`, creates files with mode 0600 and verifies the
  whole chain on open. An existing file writable by its group or by others is
  refused by default (`permissions: 'fix'` restricts it to 0600). One writer per
  file; there is no cross-process locking.

**CLI**

- Writes are atomic (temporary file with `O_EXCL`, then rename), never through
  a symlink, and never over an existing file without `--force`.
- The HMAC key is read from an environment variable, not from the command line.
- No stack traces are printed; errors show a code and a short message.

**Supply chain**

- Zero runtime dependencies (React and Vue are optional peer dependencies of
  the wrappers). Development dependencies are pinned and locked.
- `npm audit --omit=dev` is clean. The package has no install scripts and a
  `files` allow-list.
- CI uses pinned action SHAs and read-only permissions, and runs only on pull
  requests and by hand.

## Data flows and personal data

- Image marking runs locally. Nothing is sent anywhere.
- The components send nothing over the network. With `remember="session"`
  they store one flag (`telltale:dismissed:<kind>`) in `sessionStorage`.
- The log stores: event, kind, language, SHA-256 of the text shown, a session
  pseudonym, an optional surface name and a timestamp. No names, emails, IP
  addresses or user agents.
- Why a pseudonym: it lets you show that the notice appeared in a given
  session without storing the session id (often a bearer token) or a user id.
  A pseudonym that can be linked back to a person is still personal data under
  Article 4(5) and Recital 26 GDPR. Use `randomSessionPseudonym()` when you
  do not need linkage, or `deriveSessionPseudonym()` with a key you can rotate
  or delete.
- Set a retention period for logs and document it in your records of processing.

## Known limitations

- The log records what the application reports. Any script on the page can
  dispatch a `telltale-shown` event, and a log entry does not prove that a
  person read the notice.
- Metadata marking is trivially removable and forgeable. Do not use
  `readImageMarking` results for access control or as proof.
- C2PA detection is a signature check, not manifest validation.
- The JPEG reader reads the standard XMP packet only, not ExtendedXMP.
