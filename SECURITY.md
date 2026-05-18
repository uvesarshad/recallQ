# Security Policy

## Supported versions

Only the latest commit on `main` receives security fixes. There are no versioned releases with independent security support at this time.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email **security@recall.app** (or the maintainer email in the repository) with:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (if safe to share)
- Any suggested mitigations

You will receive an acknowledgement within 48 hours. We aim to release a fix within 14 days for critical issues and 30 days for others.

## Scope

Issues we consider in scope:

- Authentication bypasses or session fixation
- SQL injection or other injection vulnerabilities
- Cross-site scripting (XSS) in stored or reflected form
- Insecure direct object references (IDOR) allowing access to another user's data
- Server-side request forgery (SSRF) in the URL scraper
- Credential exposure via logs or API responses

Out of scope:

- Rate-limit bypass on non-sensitive endpoints
- Denial-of-service attacks requiring large resource consumption
- Issues only reproducible with physical access to the server
- Vulnerabilities in third-party dependencies where no practical exploit path exists in this application (report those upstream)

## Responsible disclosure

We follow coordinated disclosure. Please give us a reasonable time to patch before publishing. We will credit reporters in the changelog unless you prefer to remain anonymous.
