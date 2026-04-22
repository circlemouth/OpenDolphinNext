# WO-8 Evidence Sanitize Report

## Raw Artifact Policy

- raw ORCA request body recorded: no
- raw ORCA response body recorded: no
- raw patient detail recorded: no
- raw insurance detail recorded: no
- raw credentials/passwords/cookies/tokens/sessions recorded: no
- Authorization values recorded: no
- JSESSIONID values recorded: no
- CSRF values recorded: no
- credential-bearing URLs recorded: no
- HAR recorded: no
- trace recorded: no
- video recorded: no
- screenshot recorded: no
- raw network dump recorded: no

## Evidence Scope

The scan scope for this WO-8 package is the WO-8 output directory and package candidate contents. No full-source clean claim is made.

## Scan Interpretation

Policy words such as `Authorization`, `JSESSIONID`, `CSRF`, `password`, `cookie`, `session`, and `token` appear in reports as forbidden-marker names and required negative statements. The scan did not identify stored raw values in the WO-8 evidence set.

