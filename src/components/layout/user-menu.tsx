"use client";
import Link from "next/link";
import { LogOut, Settings, User as UserIcon, Globe } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/app/(auth)/actions";

export function UserMenu({ user }: { user: { name: string; email: string; avatarUrl: string | null; roleLabel: string } }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Menu da conta">
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel className="pb-2">
          <span className="block truncate text-sm font-semibold text-fg">{user.name}</span>
          <span className="block truncate font-normal">{user.email}</span>
          <span className="mt-1 block font-normal text-primary">{user.roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile"><UserIcon /> Meu perfil</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile/settings"><Settings /> Preferências e segurança</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/"><Globe /> Ver site da Escola</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={() => logoutAction()}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
