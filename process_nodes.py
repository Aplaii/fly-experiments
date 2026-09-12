import pandas as pd
import json
import os

print("Loading body annotations...")
df = pd.read_feather('body-annotations-male-cns-v1.0-minconf-0.5.feather')
df = df.dropna(subset=['somaLocation'])

print(f"Found {len(df)} neurons with soma locations.")

nodes = []
# Subsample for very fast rendering if needed, but Three.js can handle 30k Points easily
for idx, row in df.iterrows():
    loc = row['somaLocation']
    nodes.append({
        'id': str(row['bodyId']),
        'type': str(row['type']) if pd.notna(row['type']) else 'Unknown',
        'x': float(loc[0]),
        'y': float(loc[1]),
        'z': float(loc[2])
    })

# Normalize coords to center the brain at (0,0,0)
print("Normalizing coordinates...")
xs = [n['x'] for n in nodes]
ys = [n['y'] for n in nodes]
zs = [n['z'] for n in nodes]

cx, cy, cz = sum(xs)/len(xs), sum(ys)/len(ys), sum(zs)/len(zs)

# Scale down so it fits nicely in the Three.js world
scale = 0.05
for n in nodes:
    n['x'] = (n['x'] - cx) * scale
    n['y'] = (n['y'] - cy) * scale
    n['z'] = (n['z'] - cz) * scale

output_path = os.path.join('fly-connectome-vis', 'public', 'full_brain.json')
with open(output_path, 'w') as f:
    json.dump(nodes, f)
    
print(f"Saved {len(nodes)} neurons to {output_path}")
