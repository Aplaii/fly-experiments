import numpy as np

class Environment:
    def __init__(self, size=1000):
        self.size = size
        
    def get_temperature(self, x, y, z):
        """
        Procedural climate gradient.
        Optimal temperature is in the center, getting extreme at edges.
        """
        dist_from_center = np.sqrt(x**2 + y**2 + z**2)
        # Returns a temperature between 0 (freezing) and 100 (boiling)
        # Center is ~25 degrees (comfortable)
        temp = 25 + (dist_from_center / self.size) * 75
        return np.clip(temp, 0, 100)

class FlyAgent:
    def __init__(self, brain_model):
        self.brain = brain_model
        # Start at the center of the world
        self.x, self.y, self.z = 0.0, 0.0, 0.0
        self.yaw = 0.0
        
        self.energy = 1000.0 # Starting metabolic energy
        self.alive = True
        self.distance_traveled = 0.0
        
    def step(self, env):
        if not self.alive:
            return
            
        # 1. Sensory Transduction (Environment -> Brain)
        temp = env.get_temperature(self.x, self.y, self.z)
        
        # Convert physical temp to sensory neuron firing rates
        # E.g., if temp is extreme, fire pain/thermal receptors high
        thermal_stress = abs(temp - 25.0) / 75.0 
        
        # We broadcast this simple stress signal across all sensory inputs for this minimal implementation
        import torch
        # A biological model would map specific sensors to specific temp gradients
        sensory_input = torch.full((len(self.brain.sensory_indices),), thermal_stress, dtype=torch.float32, device=self.brain.device)
        
        # 2. Brain Forward Pass
        motor_out = self.brain(sensory_input)
        
        # 3. Kinematic Translation (Brain -> Movement)
        # We map the massive motor output vector to simplified dx, dy, dz, dyaw
        # In a real setup, specific motor neurons map to specific leg/wing muscles
        # Here we just take the mean of chunks of the motor vector
        chunk_size = len(motor_out) // 4
        if chunk_size == 0:
            chunk_size = 1 # Fallback
            
        dx = float(torch.mean(motor_out[0:chunk_size])) * 10
        dy = float(torch.mean(motor_out[chunk_size:chunk_size*2])) * 10
        dz = float(torch.mean(motor_out[chunk_size*2:chunk_size*3])) * 10
        dyaw = float(torch.mean(motor_out[chunk_size*3:])) * 0.1
        
        # Update Position
        self.x += dx
        self.y += dy
        self.z += dz
        self.yaw += dyaw
        
        travel = np.sqrt(dx**2 + dy**2 + dz**2)
        self.distance_traveled += travel
        
        # 4. Metabolic Constraints
        # Movement costs energy. Extreme temp costs energy.
        movement_cost = travel * 0.1
        thermal_cost = thermal_stress * 5.0
        
        self.energy -= (movement_cost + thermal_cost + 1.0) # 1.0 is basal metabolic rate
        
        if self.energy <= 0:
            self.alive = False
