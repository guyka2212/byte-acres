# Mazes: goo on a grown bush makes a hedge maze over the whole field, with
# gold hidden in it. Keep your right hand on the wall: in these mazes that
# always reaches the treasure.
import tools

right = {North: East, East: South, South: West, West: North}
left = {North: West, West: South, South: East, East: North}

def run(treasures):
    n = get_world_size()
    for t in range(treasures):
        tools.go_to(n // 2, n // 2)
        tools.clear_for(Entities.Bush)
        if get_entity_type() != Entities.Bush:
            plant(Entities.Bush)
        tools.water()
        while not can_harvest():
            pass
        use_item(Items.Goo, n * 3)
        facing = North
        while get_entity_type() != Entities.Treasure:
            if can_move(right[facing]):
                facing = right[facing]
            while not can_move(facing):
                facing = left[facing]
            move(facing)
        harvest()
