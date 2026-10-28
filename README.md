# Ghost Logbook

An offline-first explorer for a **fictional 1999 archive**, built for the October 2026 Ghost in the Machine challenge. It uses a real scikit-learn Isolation Forest and an inspectable JavaScript scorer. It reports unusual records without inventing their causes.

**[Try the public demo](https://ghost-logbook.chihiro-20110222.chatgpt.site/)**

## Run without a service

Open `dist/index.html` in a JavaScript-capable browser, or serve the folder locally:

```sh
python -m http.server 8876 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8876/`. No API key, CDN, account, package installation or ongoing inference service is required to run the app. The hosted demo needs an initial connection to load its assets; the downloaded files can run offline.

## Try it

1. Load the quieter archive, then the haunted archive.
2. Inspect a ranked row and its comparisons with the synthetic baseline.
3. Optionally export the report, or analyze a small CSV using the documented schema.

CSV analysis stays in browser memory. The app does not upload the file or write its contents to browser storage. Exported reports contain the input data. Clearing the view is not secure memory erasure. See [the full usage notes](README.txt).

## Actual open-source machine learning

`train.py` trains 48 Isolation Forest trees on 2,048 fictional records using scikit-learn 1.7.2. The exported model and seven-feature transformation are included. All 250 reference predictions agree between Python and JavaScript within `1e-12` in the recorded tests, including threshold flags.

This is not a security product. On a separate 800-row quiet synthetic set, 14 rows are flagged. Only three of six deliberately altered demo rows rank in the top six. The training status is constant. Scores are not probabilities, accuracy estimates or proof of a threat; comparison notes are not causal explanations. No real customer logs or human usability study are included.

## Reproduce and test

For model regeneration, use Python 3.12 in a project-local virtual environment:

```sh
python -m pip install -r requirements.txt
python train.py
```

For tests, use Node 22+ and pnpm:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
```

The suite has 27 engine/parser and 19 DOM-event integration tests. The only JavaScript development dependency is pinned test-only `linkedom`; it is not used by the runtime. See [TESTING.txt](TESTING.txt) for browser verification, regression history and the limits of the test scope.

Optional WebMCP tools call the same application helpers and are not required to use the app. Do not send private CSV to an AI tool caller without separate authorization.

## License and status

Original code, synthetic data and exported model: [MIT](LICENSE). scikit-learn attribution and other notices are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).

Development and verification were AI-led. No human review is claimed. Public availability is not contest acceptance, a security certification or prize income. The project began October 28, 2026. No partner prize category is claimed.
