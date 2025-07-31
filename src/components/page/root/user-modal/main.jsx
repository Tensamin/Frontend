// Package Imports
import { toast } from "sonner"
import Image from "next/image"
import * as Icon from "lucide-react"
import { useEffect, useState } from "react"

// Lib Imports
import {
  cn,
  statusColors,
  convertDisplayNameToInitials,
  capitalizeFirstLetter,
  formatUserStatus,
} from "@/lib/utils"

// Context Imports
import { useUsersContext } from "@/components/context/users"

// Components
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { VoiceControls } from "@/components/page/root/user-modal/voice"
import { VoiceCall } from "@/components/page/voice/call"

// Main
export function UserModal({ display, username, avatar, status }) {
  let [actAvatar, setAvatar] = useState(avatar)
  let { currentCall, shouldCreateCall } = useUsersContext();

  useEffect(() => {
    setAvatar(avatar)
  }, [avatar])

  return (
    <div className="rounded-xl flex flex-col items-center p-3 gap-3 justify-center">
      <div className="flex w-full gap-3 items-center">
        <div className="relative w-[35px] h-[35px]">
          {actAvatar !== "..." ? (
            <Avatar className="bg-accent/50">
              {actAvatar !== "" ? (
                <Image
                  className="w-auto h-auto object-fill"
                  data-slot="avatar-image"
                  width={36}
                  height={36}
                  src={actAvatar}
                  alt=""
                  onError={() => {
                    setAvatar("")
                  }}
                />
              ) : null}
              <AvatarFallback>
                {convertDisplayNameToInitials(username)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Skeleton className="rounded-full size-8" />
          )}
          <Tooltip>
            <TooltipTrigger asChild className="absolute bottom-0 right-0 w-[15px] h-[15px]">
              <div onClick={() => toast("Huhu")} className={cn("cursor-pointer rounded-full border-3 border-card", statusColors[status] || "bg-white")} />
            </TooltipTrigger>
            <TooltipContent className="border-1">
              <p>{formatUserStatus(status)}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="w-full">
          <div className="text-[14px] font-bold">{display !== "..." ? (
            <p>{display}</p>
          ) : (
            <Skeleton className="mr-20"><p className="invisible">🥴</p></Skeleton>
          )}</div>
          <div className="text-[12px] font-bold text-foreground/67">{username !== "..." ? (
            <p>{username}</p>
          ) : (
            <Skeleton className="mr-8 mt-1"><p className="invisible">🥴</p></Skeleton>
          )}</div>
        </div>
      </div>
      {currentCall.connected ? (
        <VoiceControls />
      ) : null}
      {shouldCreateCall ? (
        <VoiceCall />
      ) : null}
    </div>
  )
}

export function SmallUserModal({ display, username, avatar, status, state, showIotaStatus }) {
  let [actAvatar, setAvatar] = useState(avatar)

  return (
    <div className="rounded-xl flex items-center h-12 pl-3 gap-3">
      {avatar !== "notAllowed" ? (
        <div className="flex-shrink-0">
          <div className="relative w-[27px] h-[27px] mb-2">
            <Avatar className="bg-accent/50">
              <Image
                className="w-auto h-auto object-fill"
                data-slot="avatar-image"
                width={36}
                height={36}
                src={actAvatar}
                alt=""
                onError={() => {
                  setAvatar("")
                }}
              />
              <AvatarFallback>
                {convertDisplayNameToInitials(username)}
              </AvatarFallback>
            </Avatar>
            <Tooltip>
              <TooltipTrigger asChild className="absolute -bottom-2 -right-2 w-[15px] h-[15px]">
                {state === "none" ? (
                  <div className="cursor-pointer rounded-full border-3 border-card bg-card">
                    <Skeleton className="bg-white w-full h-full" />
                  </div>
                ) : (
                  <div className={cn("cursor-pointer rounded-full border-3 border-card", statusColors[state] || "bg-white")} />
                )}
              </TooltipTrigger>
              <TooltipContent className="border-1">
                <p>{formatUserStatus(state)}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

      ) : null}

      <div className="min-w-0 flex-grow">
        <div className={`${showIotaStatus && state !== "IOTA_OFFLINE" ? "flex" : ""} gap-2 text-[15px] overflow-hidden whitespace-nowrap text-overflow-ellipsis`}>
          <div className="flex flex-col">
            <div className="flex gap-2">
              <p>{display}</p>
              {showIotaStatus && state !== "IOTA_OFFLINE" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-4 text-foreground/20 scale-90">
                      <Icon.Activity />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="border-1">
                    <p>Iota is Online</p>
                  </TooltipContent>
                </Tooltip>

              ) : null}
            </div>
            <div className="flex gap-1">
              {showIotaStatus && state === "IOTA_OFFLINE" ? (
                <div className="text-destructive flex text-xs">
                  <div className="scale-90 origin-top-left overflow-ellipsis"><Icon.Activity /></div> Iota is Offline
                </div>
              ) : (
                <p className="text-xs text-foreground/75">{status}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SmallUserModalSkeleton() {
  return (
    <div className="rounded-xl flex items-center h-12 pl-3 gap-3">
      <div className="flex-shrink-0">
        <div className="relative w-[27px] h-[27px] mb-2">
          <Skeleton className="rounded-full size-8" />
          <Tooltip>
            <TooltipTrigger asChild className="absolute -bottom-2 -right-2 w-[15px] h-[15px]">
              <div className="cursor-pointer rounded-full border-3 border-card bg-card">
                <Skeleton className="bg-white w-full h-full" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="border-1">
              <p>None</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="min-w-0 flex-grow">
        <div className="text-[15px] overflow-hidden whitespace-nowrap text-overflow-ellipsis">
          <Skeleton><p className="invisible">🥴</p></Skeleton>
        </div>
      </div>
    </div>
  );
}

export function VoiceModal({ id }) {
  let [display, setDisplay] = useState("...");
  let [username, setUsername] = useState("...");
  let [avatar, setAvatar] = useState("...");
  let { get } = useUsersContext();

  useEffect(() => {
    get(id)
      .then(data => {
        setDisplay(data.display)
        setUsername(data.username)
        setAvatar(data.avatar)
      })
  }, [id])

  return (
    <div className="rounded-xl flex items-center h-15 pl-3 gap-3 justify-center">
      <div>
        <div className="relative w-[35px] h-[35px]">
          {avatar !== "..." ? (
            <Avatar className="bg-accent/50">
              {avatar !== "" ? (
                <Image
                  className="w-auto h-auto object-fill"
                  data-slot="avatar-image"
                  width={36}
                  height={36}
                  src={avatar}
                  alt=""
                  onError={() => {
                    setAvatar("")
                  }}
                />
              ) : null}
              <AvatarFallback>
                {convertDisplayNameToInitials(username)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Skeleton className="rounded-full size-8" />
          )}
        </div>
      </div>
      <div className="w-full">
        <div className="text-[14px] font-bold">{display !== "..." ? (
          <p>{display}</p>
        ) : (
          <Skeleton className="mr-20"><p className="invisible">🥴</p></Skeleton>
        )}</div>
        <div className="text-[12px] font-bold text-foreground/67">{username !== "..." ? (
          <p>{username}</p>
        ) : (
          <Skeleton className="mr-8 mt-1"><p className="invisible">🥴</p></Skeleton>
        )}</div>
      </div>
    </div>
  )
}