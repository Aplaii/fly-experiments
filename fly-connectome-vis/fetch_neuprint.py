# Instructions: 
# 1. Install neuprint-python: pip install neuprint-python pandas
# 2. Get an API token from https://neuprint.janelia.org
# 3. Paste your token below and run the script to generate real JSON data for the Three.js app.

from neuprint import Client
import json
import os

# Your Neuprint auth token
AUTH_TOKEN = '97532f30a25cb73eb5bc29ef173223edc9a8693d07cb52d58128565cb59233e4'

def fetch_manc_connectome():
    # Connect to the Male CNS (MANC) dataset
    print("Connecting to NeuPrint...")
    c = Client('neuprint.janelia.org', dataset='manc:v1.0', token=AUTH_TOKEN)
    
    # Example Cypher query to get a small subset of neurons (e.g., in a specific region)
    # The full connectome is too massive to download as a single JSON (tens of GBs)
    # We'll fetch 1000 prominent neurons and their connections
    
    query = """
    MATCH (n:Neuron)-[e:ConnectsTo]->(m:Neuron)
    WHERE n.status = 'Traced' AND m.status = 'Traced' 
          AND e.weight > 10
    RETURN n.bodyId AS source, m.bodyId AS target, e.weight AS weight, 
           n.type AS sourceType, m.type AS targetType
    LIMIT 5000
    """
    
    print("Fetching data from NeuPrint (this may take a moment)...")
    results = c.fetch_custom(query)
    
    nodes_dict = {}
    links = []
    
    for index, row in results.iterrows():
        src = row['source']
        tgt = row['target']
        
        if src not in nodes_dict:
            nodes_dict[src] = {'id': str(src), 'type': row['sourceType'] or 'unknown'}
        if tgt not in nodes_dict:
            nodes_dict[tgt] = {'id': str(tgt), 'type': row['targetType'] or 'unknown'}
            
        links.append({
            'source': str(src),
            'target': str(tgt),
            'weight': row['weight']
        })
        
    graph_data = {
        'nodes': list(nodes_dict.values()),
        'links': links
    }
    
    # Save to JSON
    output_path = os.path.join(os.path.dirname(__file__), 'public', 'manc_subset.json')
    with open(output_path, 'w') as f:
        json.dump(graph_data, f)
        
    print(f"Successfully saved {len(graph_data['nodes'])} neurons and {len(links)} synapses to {output_path}")
    print("You can now update main.js to load this JSON file using fetch('manc_subset.json')")

if __name__ == '__main__':
    if AUTH_TOKEN == 'YOUR_NEUPRINT_AUTH_TOKEN_HERE':
        print("Please replace AUTH_TOKEN with your actual NeuPrint token from https://neuprint.janelia.org")
    else:
        fetch_manc_connectome()
