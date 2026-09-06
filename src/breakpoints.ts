// The one place a breakpoint exists in JS.
//
// Filters.tsx force-opens its <details> above this width, because the
// <summary> that would otherwise toggle it is display:none there -- so if
// this number and the CSS breakpoint ever disagree, there is a band of
// widths where the filter controls are unreachable: CSS hides the summary
// while JS still believes the layout is mobile.
//
// MUST stay equal to --breakpoint-md in src/index.css (48rem = 768px).
export const MD_BREAKPOINT_PX = 768;

// Matches when the viewport is NARROWER than md, i.e. the mobile layout.
export const MOBILE_QUERY = `(max-width: ${MD_BREAKPOINT_PX - 1}px)`;
