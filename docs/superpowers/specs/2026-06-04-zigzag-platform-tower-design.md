# Zigzag Platform Tower Design

## Goal

Build a vertical tower of at least 30 platforms so the player can repeatedly jump upward.

## Chosen Direction

Use a uniform zigzag layout. Platforms alternate between a fixed left lane and a fixed right lane, with a fixed vertical gap between floors.

## Game Changes

- Increase world height from one screen to a tall vertical space.
- Generate platforms from a small configuration instead of hand-writing each platform position.
- Keep the existing stool art and static Arcade physics collider.
- Move the player start near the bottom of the taller world.
- Let the camera follow the player through the full vertical world.

## Testing

Add a small deterministic platform layout generator and test that it creates 30 platforms, alternates lanes, and keeps constant vertical spacing.
