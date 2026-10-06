import { redirect } from "next/navigation";

export default function PocketPage() {
  redirect("/orders?tab=pocket");
}
