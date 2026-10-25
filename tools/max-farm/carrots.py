# Carrots: on soil, watered so they grow up to three times as fast.
import tools

def run(laps):
    n = get_world_size()
    tools.go_to(0, 0)
    for lap in range(laps):
        for x in range(n):
            for y in range(n):
                tools.soil()
                if can_harvest():
                    harvest()
                tools.clear_for(Entities.Carrot)
                plant(Entities.Carrot)
                tools.water()
                move(North)
            move(East)
