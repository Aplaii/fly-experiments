import torch
import torch.nn.functional as F
import time
import os

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

class BatchedFlyBrain(torch.nn.Module):
    def __init__(self, num_agents, connectome_path="initial_connectome.pt", device='cuda'):
        super().__init__()
        self.device = device
        self.num_agents = num_agents
        
        print(f"Loading Biological Connectome into {device.upper()}...")
        checkpoint = torch.load(connectome_path, map_location=device, weights_only=False)
        self.num_neurons = checkpoint['num_neurons']
        
        base_adj = checkpoint['adjacency'].to(device)
        self.indices = base_adj.indices()
        self.values = torch.nn.Parameter(base_adj.values().clone())
        
        self.sensory_indices = checkpoint['sensory_indices'].to(device)
        self.motor_indices = checkpoint['motor_indices'].to(device)
        
        # GPU CALCULUS UPGRADE:
        # Instead of 1 fly with a 1D tensor, we run thousands of flies simultaneously 
        # as a 2D matrix (num_neurons, num_agents) to fully saturate the GPU cores!
        self.h = torch.zeros((self.num_neurons, self.num_agents), device=device)

    def forward(self, sensory_inputs):
        # sensory_inputs: (num_agents, num_sensory)
        # Inject directly into state matrix
        self.h[self.sensory_indices, :] += sensory_inputs.t()
        
        W = torch.sparse_coo_tensor(self.indices, self.values, size=(self.num_neurons, self.num_neurons))
        
        # BATCHED MATRIX MULTIPLICATION (The Ultimate GPU Optimization)
        # W (141k, 141k) @ h (141k, 10,000 flies) -> Instantly computes the neural pass for all flies!
        signal = torch.sparse.mm(W, self.h)
        
        self.h = F.leaky_relu(signal, negative_slope=0.1)
        
        motor_out = self.h[self.motor_indices, :] # (num_motor, num_agents)
        return motor_out.t() # (num_agents, num_motor)


def main():
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"--- INIT PURE GPU SIMULATION ({device.upper()}) ---")
    
    # 1. Initialize Massive Batched Environment on the GPU
    # Moving all calculus away from CPU loops into pure Tensor math!
    num_agents = 5000
    num_food = 200
    
    print(f"Spawning {num_agents} flies and {num_food} food sources inside VRAM...")
    
    # Pre-allocate physics state directly on GPU
    positions = torch.zeros((num_agents, 3), device=device)
    velocities = torch.zeros((num_agents, 3), device=device)
    
    # Random food scattered across a 4000x4000 field
    food_positions = (torch.rand((num_food, 3), device=device) - 0.5) * 4000
    food_positions[:, 1] = 0 # Keep food on the ground (Y=0)
    
    brain = BatchedFlyBrain(num_agents, device=device)
    
    # Optimizers can be used on brain.values directly here to train the population
    
    steps = 100
    print(f"\nStarting physics and neural simulation loop ({steps} steps)...")
    start_time = time.time()
    
    for step in range(steps):
        # --- BATCHED CALCULUS ---
        
        # 1. Distance Calculation (Instant GPU operation using cdist)
        # Calculates the distance from EVERY fly to EVERY piece of food in one operation.
        dists = torch.cdist(positions, food_positions)
        closest_dist, closest_idx = torch.min(dists, dim=1)
        
        # 2. Sensory Transduction
        # Flattens the distance into a neural stimulus curve (1.0 = close, 0.0 = far)
        sensory_intensity = torch.clamp(1.0 - (closest_dist / 150.0), min=0.0).unsqueeze(1)
        
        # Broadcast stimulus to all sensory neurons for all agents
        sensory_inputs = sensory_intensity.repeat(1, len(brain.sensory_indices))
        
        # 3. Mass Neural Forward Pass
        # 5000 brains compute 23-million synapses simultaneously
        motor_out = brain(sensory_inputs)
        
        # 4. Kinematics & Physics Integration
        chunk = motor_out.shape[1] // 3
        if chunk == 0: chunk = 1
        
        # Mean pooling motor outputs into 3D acceleration vectors
        dx = motor_out[:, 0:chunk].mean(dim=1)
        dy = motor_out[:, chunk:chunk*2].mean(dim=1)
        dz = motor_out[:, chunk*2:chunk*3].mean(dim=1)
        
        velocities[:, 0] = dx
        velocities[:, 1] = dy
        velocities[:, 2] = dz
        
        # Update positions
        positions += velocities * 0.1
        
        # Keep flies above ground
        positions[:, 1] = torch.clamp(positions[:, 1], min=5.0)
        
        if step % 20 == 0 or step == steps - 1:
            fps = (step + 1) / (time.time() - start_time)
            vram = torch.cuda.memory_allocated() / 1e9 if device == 'cuda' else 0
            avg_dist = closest_dist.mean().item()
            print(f"Step {step:03d} | VRAM: {vram:.2f} GB | Mean Dist to Food: {avg_dist:.1f} | Speed: {fps:.1f} steps/sec")

    print(f"\nSimulation complete! {num_agents} brains simulated for {steps} ticks in {time.time()-start_time:.2f} seconds.")

if __name__ == "__main__":
    main()
