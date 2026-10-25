# A field with everything at its top level. Each crop has its own file with
# its best strategy; this goes round all of them, for ever.
import tools
import pumpkins
import sunflowers
import cactus
import carrots
import wood
import hay
import maze

change_hat(Hats.Gold_Crown)
flip()
while True:
    sunflowers.run(12)   # power first: it doubles the drone's speed
    pumpkins.run()
    cactus.run()
    maze.run(3)
    carrots.run(2)
    wood.run(2)
    hay.run(3)
