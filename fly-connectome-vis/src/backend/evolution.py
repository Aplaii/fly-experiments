import copy
import torch
from fly_brain import FlyBrain
from environment import Environment, FlyAgent

def evaluate_fitness(agent, env, steps=100):
    agent.brain.reset_state()
    for _ in range(steps):
        agent.step(env)
        if not agent.alive:
            break
            
    # Fitness = Distance traveled while maintaining energy
    # (Forces them to learn to navigate towards optimal temperature zones)
    fitness = agent.distance_traveled + (agent.energy if agent.energy > 0 else 0)
    return fitness

def run_generation(population, env, steps=100):
    fitness_scores = []
    
    # Evaluate all agents
    for agent in population:
        score = evaluate_fitness(agent, env, steps)
        fitness_scores.append(score)
        
    # Sort by fitness
    ranked_indices = sorted(range(len(fitness_scores)), key=lambda i: fitness_scores[i], reverse=True)
    best_agent_idx = ranked_indices[0]
    best_fitness = fitness_scores[best_agent_idx]
    
    # Selection and Reproduction (Elitism + Mutation)
    new_population = []
    
    # Keep the top performer (Elitism)
    best_brain = population[best_agent_idx].brain
    device = best_brain.device
    
    elite_brain = FlyBrain(connectome_path="initial_connectome.pt", device=device)
    elite_brain.load_state_dict(best_brain.state_dict())
    elite_agent = FlyAgent(elite_brain)
    new_population.append(elite_agent)
    
    # Clone and mutate to fill the rest of the population
    for i in range(1, len(population)):
        # We clone from the top 10% performers
        parent_idx = ranked_indices[i % max(1, len(population) // 10)]
        parent_brain = population[parent_idx].brain
        
        child_brain = FlyBrain(connectome_path="initial_connectome.pt", device=device)
        child_brain.load_state_dict(parent_brain.state_dict())
        child_brain.mutate(mutation_rate=0.01, mutation_scale=0.05)
        
        new_population.append(FlyAgent(child_brain))
        
    return new_population, best_fitness
