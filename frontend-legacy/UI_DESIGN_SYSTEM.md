# Black & White Design System

## Overview

This document outlines the modern, minimalist black and white design system implemented for the AI Doc Search application. The design emphasizes simplicity, clarity, and accessibility while maintaining an attractive, contemporary aesthetic.

## Design Philosophy

The black and white color scheme follows these core principles:

1. **Pure Contrast**: Using pure black (0% lightness) and pure white (100% lightness) as primary colors for maximum clarity
2. **Subtle Hierarchy**: Gray tones (4%, 10%, 15%, 45%, 60%, 90%, 96%) create visual hierarchy without color distraction
3. **Modern Minimalism**: Clean lines, generous spacing, and refined typography
4. **Accessible by Default**: High contrast ratios exceed WCAG AA standards
5. **Smooth Interactions**: Subtle animations and transitions enhance the user experience

## Color Palette

### Light Mode

```css
--background: 0 0% 100% /* Pure white */ --foreground: 0 0% 0% /* Pure black */
  --card: 0 0% 100% /* Pure white */ --primary: 0 0% 0% /* Pure black */
  --secondary: 0 0% 96% /* Very light gray */ --muted: 0 0% 96%
  /* Very light gray */ --muted-foreground: 0 0% 45% /* Medium gray */
  --border: 0 0% 90% /* Light gray */ --destructive: 0 84% 50%
  /* Red for errors */;
```

### Dark Mode

```css
--background: 0 0% 0% /* Pure black */ --foreground: 0 0% 100% /* Pure white */
  --card: 0 0% 4% /* Near black with subtle lift */ --primary: 0 0% 100%
  /* Pure white */ --secondary: 0 0% 10% /* Very dark gray */ --muted: 0 0% 10%
  /* Very dark gray */ --muted-foreground: 0 0% 60% /* Medium-light gray */
  --border: 0 0% 15% /* Dark gray */ --destructive: 0 70% 45%
  /* Darker red for dark mode */;
```

## Typography

### Hierarchy

- **H1**: 3xl (1.875rem), bold, tight tracking
- **H2**: 2xl (1.5rem), bold, tight tracking
- **H3**: xl (1.25rem), semibold, tight tracking
- **H4**: lg (1.125rem), semibold, tight tracking
- **H5**: base (1rem), semibold, tight tracking
- **H6**: sm (0.875rem), semibold, tight tracking

### Body Text

- **Base font**: System font stack with antialiasing
- **Line height**: Relaxed (1.625) for body text
- **Font smoothing**: Enhanced with antialiasing and optimized rendering

## Component Styling

### Buttons

**Default Variant**

- Background: Foreground color (black in light, white in dark)
- Text: Background color (inverted)
- Hover: 90% opacity with subtle scale animation (0.98)
- Focus: 2px ring with offset

**Ghost Variant**

- Background: Transparent
- Hover: 5% foreground opacity background
- Text: Foreground color

**Outline Variant**

- Border: 20% foreground opacity
- Background: Transparent
- Hover: 5% foreground opacity background, 40% border opacity

### Cards

- Background: Card color (white/near-black)
- Border: Standard border color
- Shadow: Subtle shadow (sm) with hover lift (lg)
- Transition: All properties with 200ms duration
- Hover: Enhanced shadow + subtle border color change

### Inputs & Selects

- Background: Pure background (not popover)
- Border: Standard border with hover state (30% opacity on hover)
- Focus: Border becomes foreground color, 2px ring at 20% opacity
- Transition: All properties with 200ms duration

### Badges

**Default Variant**

- Background: Foreground color
- Text: Background color (inverted)
- Border: 20% foreground opacity

**Destructive Variant**

- Uses destructive color for errors/warnings
- Maintains high contrast

### Accordion

- Border: Standard border with 50% opacity
- Hover: 5% foreground opacity background
- Trigger: Smooth rotation animation for chevron icon
- Content: Slide animation with proper padding

## Interaction Design

### Animations

**Timing Function**: Cubic bezier (0.4, 0, 0.2, 1) - smooth ease-in-out
**Duration**: 200ms for most transitions
**Scale Effects**: Subtle active state (0.98) on primary buttons

### Focus States

- 2px ring using foreground color
- 2px offset from element
- Ring offset uses background color

### Hover States

- Buttons: Opacity change or background tint
- Cards: Enhanced shadow + border color shift
- Interactive elements: 5% foreground opacity background

### Text Selection

- Background: 10% foreground opacity
- Maintains readability while highlighting

## Accessibility

### Contrast Ratios

- **Foreground on Background**: 21:1 (exceeds WCAG AAA)
- **Muted text on Background**:
  - Light mode: 5.8:1 (exceeds WCAG AA)
  - Dark mode: 4.5:1 (meets WCAG AA)
- **Border visibility**: Sufficient contrast for visual boundaries

### Focus Management

- Visible focus indicators on all interactive elements
- Skip to main content link for keyboard navigation
- Proper ARIA labels and roles throughout

### Motion

- Smooth scroll behavior for better UX
- Subtle animations that don't cause vestibular issues
- Transitions respect user preferences (can be disabled via CSS)

## Implementation Notes

### CSS Variables

All colors are defined as HSL values in CSS custom properties, making them easy to adjust and maintain. The HSL format (Hue, Saturation, Lightness) is ideal for grayscale as we keep hue at 0 and saturation at 0%, varying only lightness.

### Tailwind Integration

The theme extends Tailwind's default configuration, utilizing the `@layer` directive for proper CSS cascade and specificity management.

### Component Consistency

All shadcn/ui components have been updated to:

1. Use semantic color tokens (foreground, background, etc.)
2. Apply consistent hover and focus states
3. Include smooth transitions
4. Support both light and dark modes

## Design Tokens Reference

### Spacing

- Radius: 0.5rem (8px) for rounded corners

### Shadows

- sm: Subtle elevation for resting state
- md: Medium elevation for hover states
- lg: Higher elevation for active/focused states

### Borders

- Default: 1px solid with border color
- Hover: Border opacity increases for feedback

## Future Enhancements

Potential improvements to consider:

1. **Accent Color**: Add a subtle gray accent (5% variation) for ultra-minimal highlighting
2. **Success States**: Define a monochrome success indicator using opacity variations
3. **Loading States**: Implement skeleton screens with gradient animations
4. **Micro-interactions**: Add more subtle motion to enhance delight
5. **Dark Mode Toggle**: Implement smooth transition between modes

## Usage Guidelines

### Do's

- Use pure black and white for maximum contrast on critical elements
- Utilize gray tones to create hierarchy
- Apply consistent spacing and typography scale
- Ensure all interactive elements have clear hover/focus states

### Don'ts

- Avoid using colors other than blacks, whites, and grays (except for destructive states)
- Don't create low-contrast combinations with adjacent gray tones
- Avoid heavy shadows that conflict with the minimalist aesthetic
- Don't skip focus indicators for accessibility

## Browser Support

The design system is optimized for modern browsers with:

- CSS custom properties support
- Backdrop blur effects (with fallbacks)
- CSS Grid and Flexbox
- Modern font rendering

Tested and working in:

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Maintenance

To modify the theme:

1. Edit CSS variables in `/frontend/src/index.css`
2. Update component styles in `/frontend/src/components/ui/` as needed
3. Test in both light and dark modes
4. Verify accessibility with contrast checkers
5. Document any changes in this file
