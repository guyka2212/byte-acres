# Wood: trees give the most, but a tree next to a tree grows slower.
# A checkerboard keeps every tree away from the others; bushes fill the gaps.
import tools

def run(laps):
    n = get_world_size()
    tools.go_to(0, 0)
    for lap in range(laps):
        for x in range(n):
            for y in range(n):
                if (x + y) % 2 == 0:
                    kind = Entities.Tree
                else:
                    kind = Entities.Bush
                if can_harvest():
                    harvest()
                tools.clear_for(kind)
                plant(kind)
                tools.water()
                move(North)
            move(East)
