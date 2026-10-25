# Sunflowers: harvesting the one with the MOST petals (with 8 or more planted)
# gives 5 power instead of 1, and power makes the drone twice as fast.
# Remember every flower's petals, always pick the biggest, replant it.
import tools

def run(rounds):
    n = get_world_size()
    petals = {}
    tools.go_to(0, 0)
    for x in range(n):
        for y in range(n):
            tools.soil()
            tools.clear_for(Entities.Sunflower)
            if get_entity_type() != Entities.Sunflower:
                plant(Entities.Sunflower)
            petals[(x, y)] = measure()
            move(North)
        move(East)
    for r in range(rounds):
        best = None
        for spot in petals:
            if best == None or petals[spot] > petals[best]:
                best = spot
        tools.go_to(best[0], best[1])
        tools.water()
        while not can_harvest():
            pass
        harvest()
        plant(Entities.Sunflower)
        petals[best] = measure()
