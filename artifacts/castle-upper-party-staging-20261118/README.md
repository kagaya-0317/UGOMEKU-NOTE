# Party staging correction

References: Map051 event 6 and Map053 event 4 animate map stand-ins from the
current follower positions. Map012 event 10 hands a stand-in position back to
the actual follower. The correction uses the same character helpers.

Maps 59, 60 and 62 now stage the protagonist, Mii and Yume before the camera
scroll and dialogue. Actor IDs 3 and 4 resolve to the actual spacer-aware
followers, including when their party order is swapped. Native follower
transparency is refreshed at each handoff, as in event command 216.

The two stand-in events on each map store the editable target coordinates.
The protagonist stops half a tile ahead of their midpoint. Initialization
only hides the stand-ins; it never resets their editor coordinates.

| Map | Protagonist | Mii | Yume |
| --- | --- | --- | --- |
| 59 | 10, 18 | 8.5, 18.5 | 11.5, 18.5 |
| 60 | 5.5, 16.5 | 4.5, 17 | 6.5, 17 |
| 62 | 10, 13 | 8.5, 13.5 | 11.5, 13.5 |

Camera framing accounts for the boss graphic height so speech bubbles remain
above the boss and leave the party visible below it. The end-of-event handoff
keeps every visible actor in place and resets the invisible spacer history.
Normal following, movement speed, follower visibility and camera are restored.

No new graphics, variables, items or dialogue were added. The only map-data
changes are the three encounter entry sequences and six party stand-ins.
The earlier delivered walkthrough video is retained as the original version.

Verification: all three encounters, visible sprite counts, actor movement,
battle return, reentry, swapped companions, missing companion and switch 1
blocking autonomous routes. Screenshots show the saved implementation.
