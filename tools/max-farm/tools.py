# Moving around and getting a tile ready. Shared by every crop.

def go_to(x, y):
    # the field wraps at the edges, so go whichever way is shorter
    n = get_world_size()
    dx = (x - get_pos_x()) % n
    if dx <= n // 2:
        for i in range(dx):
            move(East)
    else:
        for i in range(n - dx):
            move(West)
    dy = (y - get_pos_y()) % n
    if dy <= n // 2:
        for i in range(dy):
            move(North)
    else:
        for i in range(n - dy):
            move(South)

def soil():
    if get_ground_type() != Grounds.Soil:
        till()

def grass():
    untill()

def clear_for(kind):
    # make room for `kind`: anything else goes (grass simply gets planted over)
    here = get_entity_type()
    if here != None and here != kind and here != Entities.Grass:
        harvest()

def water():
    if get_water() < 0.75 and num_items(Items.Water) > 0:
        use_item(Items.Water)
