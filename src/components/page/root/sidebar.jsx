// Context Imports
import { useUsersContext } from "@/components/context/users";
import { useThemeProvider } from "@/components/context/theme";

// Components
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserModal } from "@/components/page/root/user-modal/main"
import { Chats } from "@/components/page/root/chats"

// Main
export function AppSidebar(props) {
  let { forceLoad, ownUuid } = useUsersContext();
  let { sidebarRightSide } = useThemeProvider();

  return (
    <Sidebar side={sidebarRightSide ? "right" : "left"} variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="border-1 bg-card rounded-xl">
            <SidebarMenuButton size="lg" asChild>
              <UserModal
                id={ownUuid}
                state="ONLINE"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu className="mt-3 pb-5">
          <SidebarMenuItem>
            <div className="flex w-full justify-center rounded-full bg-card">
              <Button className={`rounded-full rounded-r-none w-1/2 ${forceLoad ? "border-r-0" : ""}`} variant="outline" disabled={forceLoad}>
                Communities
              </Button>
              <Button className={`rounded-full rounded-l-none w-1/2 ${forceLoad ? "" : "border-l-0"}`} variant="outline" disabled={forceLoad}>
                Chats
              </Button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <Chats />
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
      </SidebarContent>
      <SidebarFooter>
      </SidebarFooter>
    </Sidebar>
  );
}