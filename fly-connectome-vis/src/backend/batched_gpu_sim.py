import torch
import time
import os

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

class TrueBiologicalBrain(torch.nn.Module):
    def __init__(self, num_agents, connectome_path="initial_connectome.pt", device='cuda'):
        super().__init__()
        self.device = device
        self.num_agents = num_agents
        
        print(f"Loading True Biological Connectome into {device.upper()}...")
        checkpoint = torch.load(connectome_path, map_location=device, weights_only=False)
        self.num_neurons = checkpoint['num_neurons']
        
        base_adj = checkpoint['adjacency'].to(device)
        self.indices = base_adj.indices()
        
        # WE NO LONGER MUTATE (BRAINWASH) THE WEIGHTS.
        # We strictly use the raw, pure biological synaptic weights from the MANC dataset.
        self.weights = base_adj.values().clone()
        self.W = torch.sparse_coo_tensor(self.indices, self.weights, size=(self.num_neurons, self.num_neurons))
        
        self.sensory_indices = checkpoint['sensory_indices'].to(device)
        self.motor_indices = checkpoint['motor_indices'].to(device)
        
        # --- BIOLOGICAL NEURON MODEL (Leaky Integrate-and-Fire / CTRNN) ---
        # Membrane potential (Voltage) of every neuron
        self.v = torch.zeros((self.num_neurons, self.num_agents), device=device)
        
        # Resting potential and Thresholds
        self.v_rest = -65.0  # mV
        self.v_threshold = -55.0 # mV
        self.tau_m = 10.0 # Membrane time constant (ms)
        self.dt = 1.0 # 1 ms per simulation step
        
        # Initialize at resting potential
        self.v.fill_(self.v_rest)

    def forward(self, sensory_inputs):
        """
        Computes 1 millisecond of true biological brain activity using continuous-time equations.
        """
        # 1. Compute current firing rates of all neurons (Spiking / Continuous Firing)
        # Neurons fire if their voltage is above threshold. 
        # Firing rate is proportional to how far above threshold they are.
        firing_rates = torch.relu(self.v - self.v_threshold)
        
        # 2. Synaptic Transmission (W * firing_rates)
        # Action potentials travel across the biological synapses to target neurons
        synaptic_currents = torch.sparse.mm(self.W, firing_rates)
        
        # 3. Sensory Injection (Current directly injected into sensory receptors)
        # sensory_inputs shape: (num_agents, num_sensory)
        sensory_currents = torch.zeros_like(self.v)
        sensory_currents[self.sensory_indices, :] = sensory_inputs.t()
        
        # 4. Membrane Potential Update (Leaky Integrate equation: dV/dt = -(V - V_rest)/tau + I_syn + I_sensory)
        dv = (-(self.v - self.v_rest) + synaptic_currents + sensory_currents) * (self.dt / self.tau_m)
        self.v += dv
        
        # Extract motor neuron firing rates to drive muscles
        motor_firing_rates = firing_rates[self.motor_indices, :] # (num_motor, num_agents)
        return motor_firing_rates.t() # (num_agents, num_motor)


def main():
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"--- INIT PURE BIOLOGICAL GPU SIMULATION ({device.upper()}) ---")
    
    num_agents = 5000
    num_food = 200
    
    print(f"Instantiating {num_agents} autonomous biological consciences...")
    
    positions = torch.zeros((num_agents, 3), device=device)
    velocities = torch.zeros((num_agents, 3), device=device)
    
    food_positions = (torch.rand((num_food, 3), device=device) - 0.5) * 4000
    food_positions[:, 1] = 0
    
    # Initialize the pure biological brains (No evolution, no backprop!)
    brain = TrueBiologicalBrain(num_agents, device=device)
    
    steps = 1000
    print(f"\nObserving native biological behavior ({steps} milliseconds)...")
    start_time = time.time()
    
    for step in range(steps):
        # Sensory Environment
        dists = torch.cdist(positions, food_positions)
        closest_dist, closest_idx = torch.min(dists, dim=1)
        
        # Sensory transduction (smell)
        sensory_intensity = torch.clamp(20.0 - (closest_dist / 50.0), min=0.0).unsqueeze(1)
        sensory_inputs = sensory_intensity.repeat(1, len(brain.sensory_indices))
        
        # 1 Millisecond of Biological Brain Simulation
        with torch.no_grad():
            motor_out = brain(sensory_inputs)
        
        # Kinematics
        chunk = motor_out.shape[1] // 3
        if chunk == 0: chunk = 1
        
        # Muscle contractions based on motor neuron firing rates
        dx = motor_out[:, 0:chunk].mean(dim=1)
        dy = motor_out[:, chunk:chunk*2].mean(dim=1)
        dz = motor_out[:, chunk*2:chunk*3].mean(dim=1)
        
        velocities[:, 0] = dx
        velocities[:, 1] = dy
        velocities[:, 2] = dz
        
        positions += velocities * 0.01
        positions[:, 1] = torch.clamp(positions[:, 1], min=5.0)
        
        if step % 100 == 0 or step == steps - 1:
            fps = (step + 1) / (time.time() - start_time)
            avg_dist = closest_dist.mean().item()
            mean_v = brain.v.mean().item()
            print(f"ms: {step:04d} | Mean Dist: {avg_dist:.1f} | Avg Brain Voltage: {mean_v:.2f}mV | Speed: {fps:.0f} Hz")

if __name__ == "__main__":
    main()
