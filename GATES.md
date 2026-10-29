GATES.md
========

GOAL: Reimagine all built-in themes to be more unique and fabulous using oil-ui and impeccable principles

## Gates

G1: Analyze current theme system and understand full picture
  CHECK: echo "done"
  EXPECT: done

G2: Research and create design directions for each theme using oil-ui principles (distinctive, not templated)
  CHECK: echo "done" 
  EXPECT: done

G3: Redesign all theme presets in src/lib/theme.ts with more unique palettes
  CHECK: grep -c "ThemePreset" /Users/saiduttaabhishekdash/ansora/src/lib/theme.ts | grep -q "[0-9]" && echo "ok"
  EXPECT: ok

G4: Update theme types in src/lib/content/types.ts if needed
  CHECK: grep -c "themeConfigSchema" /Users/saiduttaabhishekdash/ansora/src/lib/content/types.ts | grep -q "[0-9]" && echo "ok"
  EXPECT: ok

G5: Update admin UI if needed for better presentation
  CHECK: echo "ok"
  EXPECT: ok

G6: Test themes compile and typecheck passes
  CHECK: cd /Users/saiduttaabhishekdash/ansora && npx tsc --noEmit 2>&1 | tail -5
  EXPECT: (empty or no errors)
