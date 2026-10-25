# Pumpkins: the bigger the square, the bigger the harvest, so grow ONE pumpkin
# as big as the whole field. Replant rotten ones until every tile is ripe,
# then a single harvest() takes the lot (and gives goo for mazes).
import tools

def run():
    n = get_world_size()
    tools.go_to(0, 0)
    ready = 0
    while ready < n * n:
        ready = 0
        for x in range(n):
            for y in range(n):
                tools.soil()
                kind = get_entity_type()
                if kind == Entities.Pumpkin and can_harvest():
                    ready += 1
                elif kind != Entities.Pumpkin:
                    tools.clear_for(Entities.Pumpkin)
                    plant(Entities.Pumpkin)
                    tools.water()
                move(North)
            move(East)
    harvest()
