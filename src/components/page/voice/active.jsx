// Context Imports
import { useUsersContext } from "@/components/context/users";

// Components
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useEffect } from "react";

export function GettingCalled() {
    let { gettingCalledData, gettingCalled, setGettingCalled } = useUsersContext();

    useEffect(() => {
        console.log(gettingCalledData)
    }, [gettingCalledData])

    return (
        <CommandDialog
            key={gettingCalled}
            open={gettingCalled} 
            onOpenChange={setGettingCalled}
            className="rounded-lg border shadow-md md:min-w-[450px]"
        >
            <div>
                {JSON.stringify(gettingCalledData)}
            </div>
        </CommandDialog>
    )
    // sender_id
    // call_id
    // call_secret
    // gettingCalledData
}