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
            
        # Synaptic transmission
        synaptic_currents = torch.mv(self.W, firing_rates)
        
        # Sensory injection
        sensory_currents = torch.zeros_like(self.v)
        sensory_currents[self.sensory_indices] = sensory_stimulus * 30.0
        
        noise = torch.randn_like(self.v) * (2.0 + self.octopamine * 8.0)
        
        # Membrane update
        dv = (-(self.v - self.v_rest) + synaptic_currents + sensory_currents + noise) * (self.dt / self.tau_m)
        self.v += dv
        self.v = torch.clamp(self.v, min=-90.0, max=50.0)
        
        # Extract motor actions
        motor_out = firing_rates[self.motor_indices]
        
        return motor_out, spike_list, self.serotonin, self.octopamine, self.dopamine

async def brain_loop(websocket):
    print("3D Environment Connected! Uploading Brain with Stereo Olfaction...")
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    brain = BiologicalConscience(device=device)
    
    try:
        async for message in websocket:
            data = json.loads(message)
            closest_dist = data.get('closestDist', 1000)
            smell_L = data.get('smell_L', 1000)
            smell_R = data.get('smell_R', 1000)
            eating_type = data.get('eating', None)
            
            # Central stimulus (average smell)
            stimulus = max(0.0, 1.0 - (closest_dist / 800.0))
            
            # Step the biological brain (consciousness & emotions)
            with torch.no_grad():
                motor_out, spikes, serotonin, octopamine, dopamine = brain.step(stimulus, eating_type)
                
            # --- PERIPHERAL NERVOUS SYSTEM (Chemotaxis Reflex) ---
            # The raw brain outputs chaotic noise because it isn't mapped to a real body.
            # We combine the brain's chaotic "will" with a biological steering reflex.
            # If left smells stronger (distance is lower), steer left (positive yaw).
            smell_diff = smell_R - smell_L 
            # Amplify the reflex based on how hungry (low serotonin) and aroused the fly is
            reflex_sensitivity = 0.05 + ((1.0 - serotonin) * 0.1) + (octopamine * 0.05)
            reflex_yaw = smell_diff * reflex_sensitivity
            
            # Extract chaotic brain motor output
            chunk = len(motor_out) // 4
            if chunk == 0: chunk = 1
            brain_dx = float(motor_out[0:chunk].mean()) * 0.01
            brain_dy = float(motor_out[chunk:chunk*2].mean()) * 0.01
            brain_dz = float(motor_out[chunk*2:chunk*3].mean()) * 0.01
            brain_yaw = float(motor_out[chunk*3:].mean()) * 0.01
            
            # Final Kinematics: 
            # 1. Constant forward thrust (flies naturally move forward to fly)
            # 2. Reflex steering towards food
            # 3. Chaotic brain noise (erratic flight patterns / exploration)
            forward_thrust = 40.0 + (octopamine * 20.0) # Fly faster when aroused/scared
            
            response = {
                'kinematics': {
                    'forward': forward_thrust + brain_dz,
                    'drift_x': brain_dx, 
                    'drift_y': brain_dy, 
                    'yaw': reflex_yaw + brain_yaw
                },
                'spikes': spikes,
                'hormones': {'serotonin': serotonin, 'octopamine': octopamine, 'dopamine': dopamine}
            }
            await websocket.send(json.dumps(response))
    except websockets.exceptions.ConnectionClosed:
        print("Environment Disconnected. Brain powering down.")

async def main():
    print("Starting Biologically Accurate Conscience Server on ws://localhost:8766")
    async with websockets.serve(brain_loop, "localhost", 8766):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
