# Cactus: once the whole field is sorted (smaller to the west and south),
# one harvest() takes every cactus at once and pays n squared.
# Bubble-sort every row west to east, then every column south to north;
# sorting the columns keeps the rows sorted.
import tools

def run():
    n = get_world_size()
    tools.go_to(0, 0)
    for x in range(n):
        for y in range(n):
            tools.soil()
            tools.clear_for(Entities.Cactus)
            if get_entity_type() != Entities.Cactus:
                plant(Entities.Cactus)
            move(North)
        move(East)
    for y in range(n):
        swapped = True
        while swapped:
            swapped = False
            tools.go_to(0, y)
            for x in range(n - 1):
                if measure() > measure(East):
                    swap(East)
                    swapped = True
                move(East)
    for x in range(n):
        swapped = True
        while swapped:
            swapped = False
            tools.go_to(x, 0)
            for y in range(n - 1):
                if measure() > measure(North):
                    swap(North)
                    swapped = True
                move(North)
    tools.go_to(0, 0)
    while not can_harvest():
        pass
    harvest()
