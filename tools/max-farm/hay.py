# Hay: grass grows back by itself on grassland. Sweep and pick what's ripe.
import tools

def run(laps):
    n = get_world_size()
    tools.go_to(0, 0)
    for lap in range(laps):
        for x in range(n):
            for y in range(n):
                tools.grass()
                if can_harvest():
                    harvest()
                # anything else on the tile makes way, and grass grows back by itself
                tools.clear_for(Entities.Grass)
                move(North)
            move(East)
