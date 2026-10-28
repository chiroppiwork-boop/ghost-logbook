Ghost Logbook
==============
An original "Ghost in the Machine" experiment begun on October 28, 2026.

An offline-first browser explorer for a fictional 1999 archive. It uses a real
scikit-learn Isolation Forest, exported as inspectable trees and evaluated in
JavaScript. It never invents an explanation for an anomaly.

Run
---
Open dist/index.html in a JavaScript-capable browser. All runtime resources
are included: no CDN, remote model, API key, account, analytics or paid service.
Or run: python -m http.server 8876 --bind 127.0.0.1 --directory dist
and open http://127.0.0.1:8876/ .

Try the haunted and quieter examples, inspect a row, and compare the notes.
To analyze your own small CSV, paste it or choose a local file. Data remains
in this page's memory. This app makes no network request for analysis and
does not write to browser storage. A saved report contains the input values;
handle it as carefully as the original file. Clear only removes the working
view; it is not a secure-memory-erasure feature.

CSV schema (exact order)
------------------------
timestamp,source,event,duration_ms,payload_kb,status
1999-10-02T13:20:00Z,terminal-a,read,250,12,ok

ISO timestamps require seconds and Z or an explicit offset. All time features
use UTC. Numeric fields must be non-negative and at most 1e9; status is ok or
error. 1 MB and 2,000 records maximum. Names must contain 1–120 characters.
RFC-style quoted fields, commas, doubled quotes, embedded newlines, BOM and
CRLF are supported. Invalid input preserves the prior results with a warning.

AI / limitations
----------------
train.py builds a 48-tree IsolationForest on 2,048 fictional records, seed
281026, max_samples=256, contamination=0.02. Seven features describe log
duration, log payload, UTC hour sine/cosine, source/event rarity under the
training vocabulary, and status. The all-ok training status is constant and
cannot teach the forest how future error statuses should behave.

The exported decision trees, sample counts, thresholds and feature metadata
are in model.json and dist/data.js. engine.js computes float32 features and
the isolation path-length score. All 250 reference scores and flags match
the Python model in the recorded tests (score tolerance 1e-12).

The quiet held-out synthetic set has 14 flags in 800 records. Three of the
six deliberately altered demo rows appear in its top six. A fixed synthetic
baseline can rank ordinary edge cases highly and miss an obviously large
single-field change. This is a visible limitation, not a real-world accuracy
claim. Scores are not probabilities. Notes compare values with the baseline;
they are not SHAP values, causal explanations or proof of a threat.

No production/security use is promised. No real logs, personal data, customer
material, human play study or human listening check were used. Demo names,
dates and events are invented. This is not a historical archive.

Reproduce
---------
Use Python 3.12 and a project-local virtual environment; install the pinned
requirements.txt, then run python train.py. It writes the model, examples,
browser data and Python reference predictions. No model file is downloaded.
Run node --test test_engine.js with Node 22+ for 27 model/parser tests.
For 19 DOM-event integration tests, install the pinned test-only dependency
with pnpm install --frozen-lockfile --ignore-scripts, then run pnpm test.
See TESTING.txt for the test scope and unverified browser paths.
Development dependencies are excluded from the source distribution and are
not required to run the application.

Browser-agent support
---------------------
When document.modelContext is available, the app registers optional WebMCP
tools for example selection, local CSV analysis, row inspection, row-count
display, reset, state reads and requested report download. They call the
same application helpers as the ordinary interface. Tool inputs are runtime
validated; aggregate outputs avoid returning raw CSV or source/event names.
This is optional: unsupported browsers can use the ordinary interface.
An AI tool caller can still receive whatever data it was asked to submit;
do not send private CSV to an AI assistant without separate authorization.

Licenses
--------
Original application, synthetic data and exported model: MIT (LICENSE).
scikit-learn: BSD-3-Clause. See THIRD_PARTY_NOTICES.txt. The average path-length
formula follows its implementation. No scikit-learn binary is shipped.
The runtime has no third-party fonts, images, trackers or assets.

Development used AI assistance. The model is classical open-source machine
learning; it is not a claim that a proprietary language model runs in-browser.

Contest status
--------------
The Web demo is public and DEV registration is complete. This source release
is prepared for a public DEV contest entry. Tests, registration and a public
demo do not themselves constitute an entry, acceptance or prize. Entry also
requires publishing the tagged DEV article. No partner category is claimed;
no prize has been earned.
