import pandas as pd
import numpy as np
import torch
import os

def ingest_data(annotations_path, weights_path, output_path):
    print("Loading biological annotations...")
    # Read the annotations to get all valid bodyIds
    df_nodes = pd.read_feather(annotations_path)
    # Filter to traced neurons that have a soma
    df_nodes = df_nodes.dropna(subset=['somaLocation'])
    
    body_ids = df_nodes['bodyId'].unique()
    num_neurons = len(body_ids)
    print(f"Total valid neurons: {num_neurons}")
    
    # Create mapping: biological bodyId -> continuous index 0..N-1
    body_to_idx = {int(body_id): i for i, body_id in enumerate(body_ids)}
    
    # Identify sensory and motor neurons
    # In the real dataset, 'superclass' or 'type' indicates functionality.
    # For this simulation, we'll loosely map inputs and outputs.
    # If the dataset lacks clean labels, we pick neurons with high degree.
    sensory_indices = []
    motor_indices = []
    
    for idx, row in df_nodes.iterrows():
        b_id = int(row['bodyId'])
        if b_id not in body_to_idx:
            continue
            
        c_idx = body_to_idx[b_id]
        
        # Example heuristic for inputs/outputs based on string matching
        stype = str(row.get('type', '')).lower()
        sclass = str(row.get('superclass', '')).lower()
        
        if 'sensory' in stype or 'sensory' in sclass or 'visual' in stype or 'optic' in stype:
            sensory_indices.append(c_idx)
        if 'motor' in stype or 'motor' in sclass or 'descending' in stype:
            motor_indices.append(c_idx)
            
    # Fallbacks in case none found via simple string match
    if len(sensory_indices) == 0:
        print("Fallback: assigning first 1000 nodes as sensory.")
        sensory_indices = list(range(1000))
    if len(motor_indices) == 0:
        print("Fallback: assigning last 1000 nodes as motor.")
        motor_indices = list(range(num_neurons-1000, num_neurons))
        
    print(f"Designated {len(sensory_indices)} sensory and {len(motor_indices)} motor neurons.")

    print("Loading synaptic weights (edges)...")
    df_edges = pd.read_feather(weights_path)
    
    # Filter edges to only include nodes we have in our index mapping
    df_edges = df_edges[df_edges['body_pre'].isin(body_to_idx) & df_edges['body_post'].isin(body_to_idx)]
    
    # Map edges to continuous indices
    pre_mapped = df_edges['body_pre'].map(body_to_idx).astype(np.int64).values
    post_mapped = df_edges['body_post'].map(body_to_idx).astype(np.int64).values
    weights = df_edges['weight'].astype(np.float32).values
    
    print(f"Total valid synapses mapped: {len(weights)}")
    
    # Create PyTorch Sparse Tensor
    # Size: (N, N) where N = num_neurons
    indices = torch.tensor(np.vstack((pre_mapped, post_mapped)), dtype=torch.int64)
    values = torch.tensor(weights, dtype=torch.float32)
    
    # We create a dense size, but the tensor is sparse (memory efficient)
    sparse_adj = torch.sparse_coo_tensor(indices, values, size=(num_neurons, num_neurons))
    
    # Normalize weights (Biological weights can be in the 1000s, NN weights prefer small variance)
    # We'll apply a simple log-scaling or max-normalization
    max_w = float(values.max())
    if max_w > 0:
        sparse_adj = sparse_adj / max_w
        
    print("Sparse tensor created.")
    
    # Save checkpoint
    checkpoint = {
        'adjacency': sparse_adj.coalesce(),
        'body_to_idx': body_to_idx,
        'sensory_indices': torch.tensor(sensory_indices, dtype=torch.long),
        'motor_indices': torch.tensor(motor_indices, dtype=torch.long),
        'num_neurons': num_neurons
    }
    
    torch.save(checkpoint, output_path)
    print(f"Biological Connectome exported to {output_path}")

if __name__ == '__main__':
    annotations = "../../../body-annotations-male-cns-v1.0-minconf-0.5.feather"
    weights = "../../../connectome-weights-male-cns-v1.0-minconf-0.5.feather"
    output = "initial_connectome.pt"
    ingest_data(annotations, weights, output)
