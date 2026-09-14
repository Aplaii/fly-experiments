import torch
import asyncio
import websockets
import json
import time
import os

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

class BiologicalConscience:
    def __init__(self, connectome_path="initial_connectome.pt", device='cuda'):
        print("Loading Original Scan (Zero Evolution)...")
        checkpoint = torch.load(connectome_path, map_location=device, weights_only=False)
        self.device = device
        self.num_neurons = checkpoint['num_neurons']
        
        base_adj = checkpoint['adjacency'].to(device)
        self.W = torch.sparse_coo_tensor(base_adj.indices(), base_adj.values(), size=(self.num_neurons, self.num_neurons))
        
        self.sensory_indices = checkpoint['sensory_indices'].to(device)
        self.motor_indices = checkpoint['motor_indices'].to(device)
        
        # Leaky Integrate-and-Fire properties
        self.v = torch.full((self.num_neurons,), -65.0, device=device)
        self.v_rest = -65.0
        self.v_threshold = -55.0
        self.tau_m = 10.0
        self.dt = 1.0
        
        # HORMONES (Neuromodulators)
        self.serotonin = 0.5 # Satiety / Mood (low = hungry, high = full)
        self.octopamine = 0.0 # Arousal / Flight-or-Fight (adrenaline equivalent)
        self.dopamine = 0.0 # Reward / Pleasure
        
    def step(self, sensory_stimulus, eating_type):
        # Update hormones based on environment
        if eating_type == 'fruit':
            self.serotonin = min(1.0, self.serotonin + 0.1)
            self.octopamine = max(0.0, self.octopamine - 0.05)
            self.dopamine = min(1.0, self.dopamine + 0.2)
        elif eating_type == 'sugar':
            # Sugar causes a massive dopamine spike!
            self.serotonin = min(1.0, self.serotonin + 0.05)
            self.octopamine = min(1.0, self.octopamine + 0.2) # Sugar rush!
            self.dopamine = min(1.0, self.dopamine + 0.8)
        else:
            self.serotonin = max(0.0, self.serotonin - 0.001) # Slowly gets hungry
            self.dopamine = max(0.0, self.dopamine - 0.01) # Dopamine fades
            
        # Octopamine (arousal) spikes if suddenly stimulated
        if sensory_stimulus > 0.5:
            self.octopamine = min(1.0, self.octopamine + 0.05)
        else:
            self.octopamine = max(0.0, self.octopamine - 0.01)
            
        # Hormones physically alter brain chemistry parameters
        # Low serotonin (hungry) & high octopamine (aroused) = lower firing threshold
        hunger = 1.0 - self.serotonin
        current_threshold = self.v_threshold - (hunger * 8.0) - (self.octopamine * 5.0) + (self.dopamine * 2.0)
        
        # Calculate firing rates
        firing_rates = torch.relu(self.v - current_threshold)
        
        # Identify spiking neurons for the UI
        spikes = torch.nonzero(firing_rates).squeeze()
        if spikes.dim() == 0 and spikes.numel() > 0:
            spikes = spikes.unsqueeze(0)
            
        spike_list = spikes.tolist()
        if len(spike_list) > 5000:
            import random
            spike_list = random.sample(spike_list, 5000)
            
        # Synaptic transmission (The native 23 million edge biological matrix)
        # FIX: PyTorch sparse-dense matrix vector multiplication is torch.mv
        synaptic_currents = torch.mv(self.W, firing_rates)
        
        # Sensory injection
        sensory_currents = torch.zeros_like(self.v)
        sensory_currents[self.sensory_indices] = sensory_stimulus * 30.0 # Amplify input
        
        # Baseline noise (ambient thought / consciousness) affected by Octopamine
        noise = torch.randn_like(self.v) * (2.0 + self.octopamine * 8.0)
        
        # Membrane update (LIF differential equation)
        dv = (-(self.v - self.v_rest) + synaptic_currents + sensory_currents + noise) * (self.dt / self.tau_m)
        self.v += dv
        
        # Normalize voltage to prevent explosion
        self.v = torch.clamp(self.v, min=-90.0, max=50.0)
        
        # Extract motor actions
        motor_out = firing_rates[self.motor_indices]
        
        return motor_out, spike_list, self.serotonin, self.octopamine, self.dopamine

async def brain_loop(websocket):
    print("3D Environment Connected! Uploading Brain...")
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    brain = BiologicalConscience(device=device)
    
    try:
        async for message in websocket:
            data = json.loads(message)
            closest_dist = data.get('closestDist', 1000)
            eating_type = data.get('eating', None) # 'fruit', 'sugar', or None
            
            # Convert physical distance to sensory stimulus (0.0 to 1.0)
            stimulus = max(0.0, 1.0 - (closest_dist / 800.0))
            
            # Step the biological brain
            with torch.no_grad():
                motor_out, spikes, serotonin, octopamine, dopamine = brain.step(stimulus, eating_type)
                
            # Average out motor clusters for basic kinematics
            chunk = len(motor_out) // 4
            if chunk == 0: chunk = 1
            
            # True biological motor mappings
            dx = float(motor_out[0:chunk].mean())
            dy = float(motor_out[chunk:chunk*2].mean())
            dz = float(motor_out[chunk*2:chunk*3].mean())
            yaw = float(motor_out[chunk*3:].mean())
            
            # Send the biological truth back to the 3D environment
            response = {
                'kinematics': {'dx': dx, 'dy': dy, 'dz': dz, 'yaw': yaw},
                'spikes': spikes,
                'hormones': {'serotonin': serotonin, 'octopamine': octopamine, 'dopamine': dopamine}
            }
            await websocket.send(json.dumps(response))
    except websockets.exceptions.ConnectionClosed:
        print("Environment Disconnected. Brain powering down.")

async def main():
    print("Starting Biologically Accurate Conscience Server on ws://localhost:8765")
    async with websockets.serve(brain_loop, "localhost", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
