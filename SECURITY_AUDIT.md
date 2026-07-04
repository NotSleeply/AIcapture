# Security Audit - 2026-07-05

## Dependabot Alert Remediation

### Fixed Packages (via pnpm overrides)
- electron (upgraded to ^42.4.1, well above fix versions 38.8.6/39.x)
- glob@>=10.5.0
- @xmldom/xmldom@>=0.8.13
- ip-address@>=10.1.1
- esbuild@>=0.28.1
- undici@>=7.28.0
- tar@>=7.5.16
- form-data@>=4.0.6

### Method
- Used pnpm overrides for transitive dependency fixes
- All Dependabot alerts are in "fixed" state
