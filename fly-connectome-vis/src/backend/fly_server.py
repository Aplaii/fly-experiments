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
        elif eating_type == 'toy':
            self.octopamine = min(1.0, self.octopamine + 0.6)
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
        
        # NEURAL DECODER: Identify the "Pleasure Center"
        # If dopamine is high, find the exact 5 neurons firing the absolute hardest
        pleasure_neurons = []
        if self.dopamine > 0.7:
            top_firing = torch.topk(firing_rates, 5)
            pleasure_neurons = top_firing.indices.tolist()
            
        return motor_out, spike_list, self.serotonin, self.octopamine, self.dopamine, pleasure_neurons

async def brain_loop(websocket):
    print("3D Environment Connected! Uploading Brain with Stereo Olfaction & Neural Decoder...")
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    brain = BiologicalConscience(device=device)
    
    try:
        async for message in websocket:
            data = json.loads(message)
            closest_dist = data.get('closestDist', 1000)
            smell_L = data.get('smell_L', 0.0) # Intensity
            smell_R = data.get('smell_R', 0.0) # Intensity
            obstacle_L = data.get('obstacle_L', 1000)
            obstacle_C = data.get('obstacle_C', 1000)
            obstacle_R = data.get('obstacle_R', 1000)
            eating_type = data.get('eating', None)
            
            # Central stimulus (average smell/proximity)
            stimulus = max(0.0, 1.0 - (closest_dist / 800.0))
            
            # Step the biological brain (consciousness & emotions)
            with torch.no_grad():
                motor_out, spikes, serotonin, octopamine, dopamine, pleasure_neurons = brain.step(stimulus, eating_type)
                
            # --- PERIPHERAL NERVOUS SYSTEM (Chemotaxis & Obstacle Reflex) ---
            # 1. Smell Reflex
            # If left intensity is higher, turn left (positive yaw)
            smell_diff = smell_L - smell_R 
            reflex_sensitivity = 0.5 + ((1.0 - serotonin) * 1.0) + (octopamine * 0.5)
            reflex_yaw = smell_diff * reflex_sensitivity
            # Cap the smell steering
            reflex_yaw = max(-3.0, min(3.0, reflex_yaw))
            
            # 2. Obstacle Avoidance (Overrides smell if too close to a wall!)
            avoidance_yaw = 0.0
            fear_spike = 0.0
            
            if obstacle_C < 100:
                # If head-on, randomly pick a direction based on brain noise to break symmetry
                avoidance_yaw += 5.0 if float(motor_out[0].item()) > 0 else -5.0
                fear_spike = 0.5
                
            if obstacle_L < 100: 
                avoidance_yaw -= (100 - obstacle_L) * 0.15 # Hard right turn
                fear_spike = 0.2
                
            if obstacle_R < 100:
                avoidance_yaw += (100 - obstacle_R) * 0.15 # Hard left turn
                fear_spike = 0.2
                
            if fear_spike > 0:
                octopamine = min(1.0, octopamine + fear_spike) # Fear spike!
                
            final_yaw = reflex_yaw + avoidance_yaw
            
            # Extract chaotic brain motor output
            chunk = len(motor_out) // 4
            if chunk == 0: chunk = 1
            brain_dx = float(motor_out[0:chunk].mean()) * 0.01
            brain_dy = float(motor_out[chunk:chunk*2].mean()) * 0.01
            brain_dz = float(motor_out[chunk*2:chunk*3].mean()) * 0.01
            brain_yaw = float(motor_out[chunk*3:].mean()) * 0.05 # Increased brain influence
            
            # Final Kinematics
            # If avoiding, slow down slightly, otherwise arousal dictates speed
            forward_thrust = 40.0 + (octopamine * 30.0)
            if abs(avoidance_yaw) > 0:
                forward_thrust *= 0.3 
            
            response = {
                'kinematics': {
                    'forward': forward_thrust + brain_dz,
                    'drift_x': brain_dx, 
                    'drift_y': brain_dy, 
                    'yaw': final_yaw + brain_yaw
                },
                'spikes': spikes,
                'hormones': {'serotonin': serotonin, 'octopamine': octopamine, 'dopamine': dopamine},
                'decoder': {
                    'liked_item': eating_type if dopamine > 0.7 else None,
                    'pleasure_neurons': pleasure_neurons
                }
            }
            await websocket.send(json.dumps(response))
    except websockets.exceptions.ConnectionClosed:
        print("Environment Disconnected. Brain powering down.")

async def main():
    print("Starting Biologically Accurate Conscience Server on ws://localhost:8769")
    async with websockets.serve(brain_loop, "localhost", 8769):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
