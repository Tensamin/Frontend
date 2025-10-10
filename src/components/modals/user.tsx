// Package Imports
import { useEffect } from "react";

// Context Imports
import { useUserContext } from "@/context/user";
import { usePageContext } from "@/context/page";

// Components
import * as RawModal from "@/components/modals/raw";
import { fallbackUser } from "@/lib/types";

// Main
export function UserModal({
  uuid,
  size,
}: {
  uuid: string;
  size: "big" | "medium" | "profile";
}) {
  const { get, ownState, ownUuid, fetchedUsers } = useUserContext();
  const { setPage } = usePageContext();

  useEffect(() => {
    get(uuid, false);
  }, [uuid, get]);

  const user = fetchedUsers.get(uuid) ?? fallbackUser;

  const props = {
    title: user.display,
    description: user.username || "",
    icon: user.avatar || undefined,
    loading: user.loading,
    state: user.uuid === ownUuid ? ownState : user.state,
  };

  switch (size) {
    case "big":
      return <RawModal.BigModal key={user.uuid} {...props} />;
    case "medium":
      return (
        <RawModal.MediumModal
          key={user.uuid}
          {...props}
          description={user.status || ""}
          onClick={() => {
            setPage("chat", user.uuid);
          }}
        />
      );
    case "profile":
      return (
        <RawModal.Profile
          {...props}
          description={user.about || ""}
          state={user.state || "NONE"}
        />
      );
    default:
      return null;
  }
}
