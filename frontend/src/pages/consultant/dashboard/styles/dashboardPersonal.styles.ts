export const dashboardPersonalOverviewGridClass =
  'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]';
/** Two columns by default, four once the column itself is wide (container query, not viewport). */
export const dashboardPersonalStatGridClass =
  'grid grid-cols-1 gap-4 min-[30rem]:grid-cols-2 @[52rem]:grid-cols-4';
export const dashboardPersonalSplitLayoutClass =
  'animate-fade-up grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]';
export const dashboardPersonalTwoColumnClass = 'grid gap-6 xl:grid-cols-2';
/** Quick entry stays in view while the left column scrolls (xl and up only). */
export const dashboardPersonalSidebarClass =
  'order-first space-y-6 xl:order-none xl:sticky xl:top-3 xl:max-h-[calc(100vh-1.5rem)] xl:self-start xl:overflow-y-auto xl:pr-1';
