import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import torch
import argparse
from environment import Environment, FlyAgent
from fly_brain import FlyBrain
from evolution import run_generation

def main(args):
    print("Initialize Environment...")
    env = Environment()
    
    print("Loading Baseline Fly Brain Connectome...")
    base_brain = FlyBrain(connectome_path="initial_connectome.pt")
    
    population_size = args.pop_size
    print(f"Spawning population of {population_size} agents...")
    population = [FlyAgent(FlyBrain(connectome_path="initial_connectome.pt")) for _ in range(population_size)]
    
    generations = args.generations
    
    for gen in range(generations):
        print(f"\n--- Generation {gen+1}/{generations} ---")
        
        # Run the simulation loop for this generation
        population, best_fitness = run_generation(population, env, steps=args.steps)
        
        print(f"Best Fitness: {best_fitness:.2f}")
        
        # Checkpoint the best brain
        if (gen + 1) % args.save_freq == 0:
            checkpoint_path = f"checkpoints/gen_{gen+1:03d}.pt"
            os.makedirs("checkpoints", exist_ok=True)
            
            best_brain = population[0].brain
            torch.save({
                'generation': gen + 1,
                'fitness': best_fitness,
                'values': best_brain.values.detach().cpu()
            }, checkpoint_path)
            print(f"Saved checkpoint to {checkpoint_path}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Antigravity Neuroevolution Orchestrator")
    parser.add_argument('--pop_size', type=int, default=10, help='Number of agents in population')
    parser.add_argument('--generations', type=int, default=50, help='Number of generations to evolve')
    parser.add_argument('--steps', type=int, default=200, help='Simulation steps per generation')
    parser.add_argument('--save_freq', type=int, default=5, help='Save checkpoint every N generations')
    
    args = parser.parse_args()
    main(args)
