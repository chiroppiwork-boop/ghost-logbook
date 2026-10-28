"""Train on a fictional archive and export auditable trees. No external data."""
import csv
import hashlib
import io
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import sklearn
from sklearn.ensemble import IsolationForest

ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)
SEED = 281026
FEATURES = ['log_duration', 'log_payload', 'hour_sin', 'hour_cos', 'source_rarity', 'event_rarity', 'error_status']
SOURCE_P = {'terminal-a': .5, 'terminal-b': .35, 'printer-c': .15}
EVENT_P = {'read': .55, 'index': .3, 'print': .15}

def records(n, seed):
    rng = np.random.default_rng(seed)
    out = []
    start = datetime(1999, 10, 1, tzinfo=timezone.utc)
    for i in range(n):
        # Fictional UTC office archive; no inference about any real workplace.
        hour = min(17.5, max(8.5, float(rng.normal(13, 2))))
        ts = start + timedelta(days=i//40, seconds=hour*3600)
        out.append({'timestamp': ts.isoformat(timespec='seconds').replace('+00:00','Z'),
            'source': str(rng.choice(list(SOURCE_P), p=list(SOURCE_P.values()))),
            'event': str(rng.choice(list(EVENT_P), p=list(EVENT_P.values()))),
            'duration_ms': round(float(rng.lognormal(5.5, .35)), 2),
            'payload_kb': round(float(rng.lognormal(2.5, .45)), 2),
            'status': 'ok'})
    return out

def features(r):
    dt = datetime.fromisoformat(r['timestamp'].replace('Z','+00:00')).astimezone(timezone.utc)
    hour = dt.hour + dt.minute/60 + dt.second/3600
    return [math.log1p(r['duration_ms']), math.log1p(r['payload_kb']),
        math.sin(hour*math.tau/24), math.cos(hour*math.tau/24),
        -math.log(SOURCE_P.get(r['source'], .0001)),
        -math.log(EVENT_P.get(r['event'], .0001)), float(r['status']=='error')]

training = records(2048, SEED)
x = np.asarray([features(r) for r in training], dtype=np.float32)
model = IsolationForest(n_estimators=48, max_samples=256, contamination=.02,
    random_state=SEED, n_jobs=1).fit(x)
quiet = records(180, SEED+1)
haunted = [dict(r) for r in quiet]
odd_positions = [22, 53, 87, 111, 143, 167]
alterations = [
    {'duration_ms': 48000, 'event':'index'},
    {'timestamp':'1999-10-02T03:13:00Z','source':'terminal-00'},
    {'payload_kb': 64000, 'event':'restore'},
    {'timestamp':'1999-10-03T02:02:00Z','duration_ms': 31000},
    {'source':'archive-attic','event':'restore','payload_kb': 14000},
    {'timestamp':'1999-10-05T23:59:00Z','source':'terminal-00','duration_ms': 55000,'payload_kb': 28000},
]
for position, change in zip(odd_positions, alterations):
    haunted[position].update(change)

def csv_text(rows):
    f=io.StringIO(newline='')
    w=csv.DictWriter(f, fieldnames=['timestamp','source','event','duration_ms','payload_kb','status'],lineterminator='\n')
    w.writeheader();w.writerows(rows)
    return f.getvalue()

def export_tree(est, indices):
    t=est.tree_
    return {'left':t.children_left.tolist(),'right':t.children_right.tolist(),
        'feature':[int(indices[z]) if z>=0 else -2 for z in t.feature],
        'threshold':t.threshold.tolist(),'samples':t.n_node_samples.tolist()}

held = records(800, SEED+2)
held_x = np.asarray([features(r) for r in held],dtype=np.float32)
demo_x = np.asarray([features(r) for r in haunted],dtype=np.float32)
scores = -model.score_samples(demo_x)
ranked = np.argsort(-scores).tolist()
held_flags = int(np.sum(model.predict(held_x)==-1))
export = {
    'schemaVersion':1,'library':'scikit-learn','libraryVersion':sklearn.__version__,
    'algorithm':'IsolationForest','seed':SEED,'trainingRows':len(training),
    'features':FEATURES,'sourceProbabilities':SOURCE_P,'eventProbabilities':EVENT_P,
    'unknownFrequency':.0001,'maxSamples':256,'contamination':.02,
    'flagThreshold':float(-model.offset_),
    'featureMedian':np.median(x,axis=0).tolist(),
    'featureIqr':(np.percentile(x,75,axis=0)-np.percentile(x,25,axis=0)).tolist(),
    'trees':[export_tree(e,idx) for e,idx in zip(model.estimators_,model.estimators_features_)],
    'validation':{'syntheticHeldOutRows':800,'syntheticHeldOutFlags':held_flags,
        'craftedOddRows':len(odd_positions),'craftedOddInTopSix':len(set(odd_positions)&set(ranked[:6])),
        'realWorldValidation':False},
    'dataStatement':'Fictional baseline only. No real logs or personal data.',
}
payload={'model':export,'quietCsv':csv_text(quiet),'hauntedCsv':csv_text(haunted)}
(DIST/'data.js').write_text('window.GHOST_DATA = '+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
(ROOT/'model.json').write_text(json.dumps(export,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'examples').mkdir(exist_ok=True)
(ROOT/'examples/quiet-archive.csv').write_text(csv_text(quiet),encoding='utf-8')
(ROOT/'examples/haunted-archive.csv').write_text(csv_text(haunted),encoding='utf-8')
fixtures = haunted + held[:70]
fx = np.asarray([features(r) for r in fixtures],dtype=np.float32)
(ROOT/'reference-predictions.json').write_text(json.dumps({'rows':fixtures,
    'features':fx.tolist(),'anomalyScores':(-model.score_samples(fx)).tolist(),
    'labels':model.predict(fx).tolist()},ensure_ascii=False),encoding='utf-8')
print(json.dumps({'version':sklearn.__version__,'trainingRows':2048,
    'trees':48,'validation':export['validation'],
    'modelSha256':hashlib.sha256((ROOT/'model.json').read_bytes()).hexdigest()},ensure_ascii=False))
