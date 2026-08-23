# Stamp Detail — Memory-first UX v2

Implementation notes for the memory-first stamp detail experience.

- My Memory is the default and primary tab.
- Memory cards are content-sized journal entries. Photos are full-width on phone layouts, with metadata and controls below.
- Photo taps open a full photo viewer. Overflow opens a branded Memory Options bottom sheet.
- Owned photo states are explicit: Private, Pending, Event Gallery, Not Approved.
- The member's pending public event submissions appear immediately on the Event tab, while other members see only approved gallery content.
- People from the adventure are supporting context and appear after memory content.
- Native platform action dialogs are not used for memory management; destructive delete confirmation stays inside the branded sheet.
