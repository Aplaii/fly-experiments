import torch
import torch.nn as nn
import torch.nn.functional as F

class FlyBrain(nn.Module):
    def __init__(self, connectome_path="initial_connectome.pt", device='cpu'):
        super(FlyBrain, self).__init__()
        self.device = device
        
        # Load the biological base connectome
        checkpoint = torch.load(connectome_path, map_location=device, weights_only=False)
        self.num_neurons = checkpoint['num_neurons']
        
        # Original Adjacency Matrix (sparse)
        # Size: (num_neurons, num_neurons)
        base_adj = checkpoint['adjacency'].to(device)
        self.indices = base_adj.indices()
        
        # Make the non-zero values a trainable parameter (so evolution can mutate them)
        # We start exactly with the biological weights.
        self.values = nn.Parameter(base_adj.values().clone())
        
        self.sensory_indices = checkpoint['sensory_indices'].to(device)
        self.motor_indices = checkpoint['motor_indices'].to(device)
        
        # Recurrent state: h_t (membrane potential or firing rate of all neurons)
        self.h = torch.zeros(self.num_neurons, device=self.device)
        
    def reset_state(self):
        """Resets the internal state of the recurrent network."""
        self.h = torch.zeros(self.num_neurons, device=self.device)
        
    def forward(self, sensory_input):
        """
        sensory_input: Tensor of shape (len(sensory_indices)) 
        Represents the current injected into the sensory neurons.
        """
        # Inject current into sensory neurons
        self.h[self.sensory_indices] += sensory_input
        
        # Create the current sparse weight matrix
        W = torch.sparse_coo_tensor(self.indices, self.values, size=(self.num_neurons, self.num_neurons))
        
        # Sparse Matrix Vector Multiplication: W * h
        # In PyTorch, torch.mv works for sparse @ dense
        signal = torch.mv(W, self.h)
        
        # Activation function (Simulating non-linear firing rate, e.g. ReLU or Tanh)
        # Real neurons have a resting potential and a firing threshold. We use LeakyReLU for stability.
        self.h = F.leaky_relu(signal, negative_slope=0.1)
        
        # Extract motor outputs
        motor_out = self.h[self.motor_indices]
        return motor_out

    def mutate(self, mutation_rate=0.01, mutation_scale=0.1):
        """
        Applies a biological mutation (weight perturbation).
        The architecture (sparsity pattern) stays fixed, but synaptic weights evolve.
        """
        with torch.no_grad():
            # Randomly select a percentage of synapses to mutate
            mask = torch.rand_like(self.values) < mutation_rate
            noise = torch.randn_like(self.values) * mutation_scale
            self.values[mask] += noise[mask]
            
            # Clip weights to ensure biological constraints (e.g., no extreme infinite weights)
            self.values.clamp_(-10.0, 10.0)
