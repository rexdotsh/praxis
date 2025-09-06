import { Calendar } from '@/components/ui/calendar';
import { SidebarGroup, SidebarGroupContent } from '@/components/ui/sidebar';

export function DatePicker() {
  return (
    <SidebarGroup className="px-0">
      <SidebarGroupContent className="flex justify-center">
        <Calendar className="[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[32px] p-2" />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
