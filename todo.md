- figure out how to get migration working for when I deploy new code and the backend fails. last time I had to delete the db file and start over
- make sure timers are working. seems like there's a timer in the seed data, that shouldn't start on opening up the application. Also need to double check that the countdown timer doesn't do the gowing time when attempting to reset. (I think this was a bug in the old setup, but maybe it didn't get translated into the seed data?)
- 


Notes from demo:

- fill vertical bars from bottom to top
- inline editing of status/health widgets. ideally, I'd like to migrate away from the modal for the minor changes. for example, the increase, decrease, and setting the status in the health bar, number, and status widgets. I feel like it should be something like, instead of the edit button when the user clicks on the widget, it should allow the user to edit the number right there in the widget. 
- in the radar widget, when showing the 1K scale, the distance labels show km when they should show meters. 
- admin/gm doesn't see the cooldown animation when a weapon is fired, though everyone else does
- add an option to show the password while typing so that the user can ensure they are typing in the right stuff
- users need a means to manage and reset their own passwords. maybe turning their name under the operator section in the navigation menu into a button that opens up a settings modal to do that.
- there are areas where the text is very small and difficult to read. like in the contact tracker widget, or the crew status widget. the text is also weirdly formatted, and could be done better for legibility and accessibility. contrast needs to be enhanced as well

- readme to have a hero section that states that this application is `An immersive spaceship management system for your sci-fi ttrpg adventures`

- explore using websockets to have things not be polling based
