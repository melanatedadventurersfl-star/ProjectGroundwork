# Outpost Communities Lock

The Communities tab inside `OutpostAliveScreen` is the canonical Communities UI.

## Required hierarchy
1. Official Communities: visual image tiles first.
2. Your Communities: joined groups with current activity context.
3. Discover More Communities: visual cards for groups the member has not joined.

Do not replace this hierarchy with a single flat `Your Communities` list.

## Regression guard
The Community tab route must continue to render `OutpostAliveScreen`. Any redesign of Outpost must preserve the Communities hierarchy above unless the product spec is deliberately updated.
